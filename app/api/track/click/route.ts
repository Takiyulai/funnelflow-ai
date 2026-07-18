// app/api/track/click/route.ts
// LOT 2 — Proxy de redirection pour les liens d'emails (séquences,
// workflows, livraison). Journalise le clic (déclencheur Workflow
// `email.link_clicked`) PUIS redirige vers l'URL réelle. Best-effort : toute
// erreur de tracking n'empêche jamais la redirection.
// 🆕 VAGUE 1 / LOT 3 — Journalise AUSSI le clic dans `email_events` (stats
// open/click rate) via les nouveaux paramètres m/t/g/s posés par
// wrapEmailLinksForTracking. Les anciens liens (u/c/uid seulement) restent
// entièrement fonctionnels.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runWorkflowsForEvent } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_TYPES = new Set(["newsletter", "sequence", "workflow", "delivery"]);

function uuidOrNull(v: string | null): string | null {
  return v && UUID_RE.test(v) ? v : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dest = searchParams.get("u");
  const contactId = uuidOrNull(searchParams.get("c"));
  const userId = uuidOrNull(searchParams.get("uid"));
  // 🆕 LOT 3 — identifiants de stats.
  const messageId = uuidOrNull(searchParams.get("m"));
  const campaignId = uuidOrNull(searchParams.get("g"));
  const sequenceId = uuidOrNull(searchParams.get("s"));
  const sequenceEmailId = uuidOrNull(searchParams.get("se"));
  const rawType = searchParams.get("t");
  const sourceType = rawType && SOURCE_TYPES.has(rawType) ? rawType : null;

  // Lien de secours si la destination est absente/invalide : on ne redirige
  // jamais vers un schéma arbitraire (javascript:, data:…), http(s) uniquement.
  if (!dest || !/^https?:\/\//i.test(dest)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 🆕 LOT 3 — Événement de clic (stats). Indépendant du déclencheur workflow.
  if (userId && (messageId || campaignId || sequenceId)) {
    try {
      const admin = getSupabaseAdmin();
      await admin.from("email_events").insert({
        user_id: userId,
        kind: "click",
        source_type: sourceType,
        campaign_id: campaignId,
        sequence_id: sequenceId,
        sequence_email_id: sequenceEmailId,
        message_id: messageId,
        contact_id: contactId,
        url: dest.slice(0, 2000),
      });
    } catch {
      // best-effort : jamais bloquant pour la redirection
    }
  }

  if (contactId && userId) {
    try {
      const admin = getSupabaseAdmin();
      const { data: lead } = await admin
        .from("leads")
        .select("id, email, name")
        .eq("id", contactId)
        .eq("user_id", userId)
        .maybeSingle();
      if (lead) {
        await runWorkflowsForEvent(admin, userId, {
          event: "email.link_clicked",
          lead: { id: lead.id as string, email: lead.email as string, name: lead.name as string | null },
          linkLabel: dest,
        });
      }
    } catch (e) {
      console.warn("[track/click] workflow échoué (non bloquant):", e);
    }
  }

  return NextResponse.redirect(dest);
}
