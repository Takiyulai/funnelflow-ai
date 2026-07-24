// app/api/cron/send-scheduled-emails/route.ts
// 🆕 ÉTAPE 6 — CRON d'envoi des emails programmés (newsletters ET séquences).
// Lit la file `scheduled_emails` (status=pending, scheduled_at<=now) via le
// client ADMIN (service role, tous utilisateurs) et envoie via Resend.
//
// 🆕 LOT 2 — Le MÊME cron traite aussi `workflow_pending_runs` (déclencheur
// Workflow `time.elapsed`) : pas de nouveau job Vercel Cron à configurer. Les
// deux traitements sont indépendants (chacun dans son propre try/catch) :
// un échec de l'un n'impacte jamais l'autre.
//
// SÉCURITÉ : route protégée par un secret. Vercel Cron envoie automatiquement
// l'en-tête `Authorization: Bearer <CRON_SECRET>` quand la variable CRON_SECRET
// est définie. On refuse toute requête sans ce secret.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/crm/email";
import { getFunnelMarketingSender } from "@/lib/email/userSender";
import type { Sender } from "@/lib/email/sender";
import {
  wrapEmailLinksForTracking,
  appendOpenTrackingPixel,
} from "@/lib/crm/emailTracking";
import { appendUnsubscribeFooter } from "@/lib/crm/unsubscribe";
import { executeActions } from "@/lib/workflows/engine";
import { getWorkflow } from "@/lib/workflows/repository";
import type { WorkflowActionConfig } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 100;

type DueRow = {
  id: string;
  user_id: string;
  funnel_id: string | null;
  contact_id: string | null;
  recipient_email: string;
  subject: string | null;
  content: string | null;
  // 🆕 LOT 3 — identifiants de stats (open/click rate).
  source_type: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  // 🆕 Email précis dans la séquence (permet aux conditions workflow de
  // cibler "cet email" plutôt que "un email quelconque de la séquence").
  sequence_email_id: string | null;
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas de secret configuré → on refuse par sécurité
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function processDue(): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("scheduled_emails")
    .select(
      "id, user_id, funnel_id, contact_id, recipient_email, subject, content, source_type, campaign_id, sequence_id, sequence_email_id",
    )
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DueRow[];
  let sent = 0;
  let failed = 0;

  // 🆕 RGPD : ensemble des contacts DÉSINSCRITS parmi ce lot (un seul lookup).
  // On n'envoie PAS d'email MARKETING à un désinscrit — même s'il l'était
  // programmé avant sa désinscription. Les emails 'delivery' (transactionnels,
  // demandés par le contact) ne sont PAS concernés.
  const marketingContactIds = Array.from(
    new Set(
      rows
        .filter((r) => r.source_type !== "delivery" && r.contact_id)
        .map((r) => r.contact_id as string),
    ),
  );
  const unsubscribed = new Set<string>();
  if (marketingContactIds.length > 0) {
    const { data: unsubRows } = await sb
      .from("leads")
      .select("id")
      .in("id", marketingContactIds)
      .not("unsubscribed_at", "is", null);
    for (const u of unsubRows ?? []) unsubscribed.add((u as { id: string }).id);
  }

  // 🆕 Expéditeur MARKETING résolu PAR (utilisateur, tunnel) : le FROM affiche
  // le businessName du TUNNEL (published_content.meta.businessName), sans
  // « via AutoFunnel ». Cache sur la durée du run pour limiter les lookups.
  const senderCache = new Map<string, Sender>();
  async function senderFor(userId: string, funnelId: string | null): Promise<Sender> {
    const key = `${userId}::${funnelId ?? ""}`;
    const cached = senderCache.get(key);
    if (cached) return cached;
    const resolved = await getFunnelMarketingSender(userId, funnelId);
    senderCache.set(key, resolved);
    return resolved;
  }

  for (const row of rows) {
    // 🔒 FIABILITÉ — chaque ligne est traitée dans son propre try/catch.
    // AVANT ce correctif, une exception inattendue sur UNE ligne (contenu
    // malformé, image cassée, etc.) faisait planter toute la fonction
    // processDue() : le `for` s'arrêtait net, cette ligne restait "pending"
    // pour toujours, et comme elle est toujours la plus ancienne (tri par
    // scheduled_at croissant), elle bloquait TOUT le lot à CHAQUE exécution
    // du cron — plus aucun email (de personne) ne repartait tant qu'elle
    // n'était pas nettoyée à la main. On isole donc chaque envoi : un échec
    // marque juste cette ligne "failed" et le cron continue avec les suivantes.
    try {
      if (!row.recipient_email) {
        await sb
          .from("scheduled_emails")
          .update({ status: "failed", error: "missing_recipient", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        failed++;
        continue;
      }
      // 🆕 RGPD : ne pas envoyer d'email marketing à un désinscrit.
      const isMarketing = row.source_type !== "delivery";
      if (isMarketing && row.contact_id && unsubscribed.has(row.contact_id)) {
        await sb
          .from("scheduled_emails")
          .update({ status: "failed", error: "recipient_unsubscribed", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        failed++;
        continue;
      }
      const sender = await senderFor(row.user_id, row.funnel_id);
      // LOT 2 — Réécrit les liens pour le tracking de clic (déclencheur
      // Workflow `email.link_clicked`).
      // 🆕 LOT 3 — Les mêmes liens portent les identifiants de stats
      // (messageId = ligne scheduled_emails), + pixel d'ouverture. Fonctionne
      // désormais AVEC ou SANS contact_id (le trigger workflow, lui, ne se
      // déclenche que si un contact est identifié — inchangé côté /track/click).
      const tracking = {
        userId: row.user_id,
        contactId: row.contact_id,
        messageId: row.id,
        sourceType: row.source_type,
        campaignId: row.campaign_id,
        sequenceId: row.sequence_id,
        sequenceEmailId: row.sequence_email_id,
      };
      let html = appendOpenTrackingPixel(
        wrapEmailLinksForTracking(row.content || "", tracking),
        tracking,
      );
      // 🆕 RGPD : pied de page « Se désinscrire » sur les emails MARKETING (pas
      // sur les emails transactionnels 'delivery'). Ajouté APRÈS le tracking pour
      // que le lien de désinscription ne soit pas réécrit par le proxy de clic.
      if (isMarketing) html = appendUnsubscribeFooter(html, row.contact_id);
      const result = await sendEmail({
        to: row.recipient_email,
        subject: row.subject || "(sans objet)",
        html,
        from: sender.from,
        replyTo: sender.replyTo,
      });
      await sb
        .from("scheduled_emails")
        .update({
          status: result.ok ? "sent" : "failed",
          error: result.ok ? null : result.error ?? "send_failed",
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (result.ok) sent++;
      else failed++;
    } catch (e) {
      console.error(`[cron send-scheduled-emails] ligne "${row.id}" en erreur, on continue le lot :`, e);
      try {
        await sb
          .from("scheduled_emails")
          .update({
            status: "failed",
            error: e instanceof Error ? e.message.slice(0, 500) : "unexpected_error",
            sent_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } catch {
        // Même la mise à jour de statut échoue : on continue quand même le
        // lot plutôt que de tout bloquer à nouveau.
      }
      failed++;
    }
  }

  return { processed: rows.length, sent, failed };
}

// 🆕 LOT 2 — Traite les exécutions différées `workflow_pending_runs`
// (déclencheur `time.elapsed`). Indépendant de l'envoi d'emails ci-dessus :
// une erreur ici n'empêche jamais les emails de partir, et inversement.
type PendingWorkflowRun = {
  id: string;
  workflow_id: string;
  user_id: string;
  lead_id: string;
  lead_email: string;
  lead_name: string | null;
  // 🆕 Reprise en cours de workflow (condition différée après un wait) : voir
  // lib/workflows/engine.ts, cas "condition". NULL = rejoue workflow.actions
  // depuis le début (comportement historique time.elapsed).
  remaining_actions: WorkflowActionConfig[] | null;
  funnel_id: string | null;
};

async function processPendingWorkflowRuns(): Promise<{
  processed: number;
  ok: number;
  failed: number;
}> {
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("workflow_pending_runs")
    .select("id, workflow_id, user_id, lead_id, lead_email, lead_name, remaining_actions, funnel_id")
    .eq("status", "pending")
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PendingWorkflowRun[];
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const workflow = await getWorkflow(sb, row.workflow_id);
      if (workflow && workflow.status === "active") {
        // 🆕 Si cette ligne reprend une "condition" différée (voir engine.ts),
        // on rejoue UNIQUEMENT les actions restantes capturées au moment du
        // report — pas tout le workflow depuis le début. Sinon (time.elapsed
        // classique), comportement historique : workflow.actions en entier.
        const actionsToRun =
          Array.isArray(row.remaining_actions) && row.remaining_actions.length > 0
            ? row.remaining_actions
            : workflow.actions.map((a) => a.config);
        await executeActions(
          sb,
          row.user_id,
          { id: row.lead_id, email: row.lead_email, name: row.lead_name },
          actionsToRun,
          0,
          0,
          row.funnel_id ?? workflow.trigger.funnelId ?? null,
          workflow.id,
        );
      }
      await sb.from("workflow_pending_runs").update({ status: "done" }).eq("id", row.id);
      ok++;
    } catch (e) {
      console.warn(`[workflows] exécution différée "${row.id}" échouée:`, e);
      await sb.from("workflow_pending_runs").update({ status: "failed" }).eq("id", row.id);
      failed++;
    }
  }

  return { processed: rows.length, ok, failed };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result: Record<string, unknown> = {};
  try {
    result.emails = await processDue();
  } catch (e) {
    result.emailsError = e instanceof Error ? e.message : "cron_failed";
  }
  try {
    result.workflows = await processPendingWorkflowRuns();
  } catch (e) {
    result.workflowsError = e instanceof Error ? e.message : "cron_failed";
  }
  return NextResponse.json({ ok: true, ...result });
}

// Permet aussi un déclenchement manuel/POST (même protection).
export async function POST(request: Request) {
  return GET(request);
}
