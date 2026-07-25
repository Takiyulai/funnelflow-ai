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
import { processDueScheduledEmails } from "@/lib/crm/deliverScheduled";
import { executeActions } from "@/lib/workflows/engine";
import { getWorkflow } from "@/lib/workflows/repository";
import type { WorkflowActionConfig } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 100;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas de secret configuré → on refuse par sécurité
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

// 🆕 CORRECTIF EMAILS — Le traitement de la file vit désormais dans
// lib/crm/deliverScheduled.ts (partagé avec l'envoi IMMÉDIAT déclenché après
// une capture de lead / un enrôlement). Le cron reste le filet de sécurité
// pour les emails programmés dans le futur. Claim atomique par ligne → aucun
// double envoi possible entre le cron et les envois immédiats.
function processDue(): Promise<{ processed: number; sent: number; failed: number }> {
  return processDueScheduledEmails({ limit: BATCH });
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
  // 🆕 Seconde passe : les workflows différés ci-dessus viennent peut-être de
  // déposer des emails à délai 0 — on les envoie dans CE run plutôt que
  // d'attendre le passage suivant du cron.
  try {
    result.emailsSecondPass = await processDue();
  } catch (e) {
    result.emailsSecondPassError = e instanceof Error ? e.message : "cron_failed";
  }
  return NextResponse.json({ ok: true, ...result });
}

// Permet aussi un déclenchement manuel/POST (même protection).
export async function POST(request: Request) {
  return GET(request);
}
