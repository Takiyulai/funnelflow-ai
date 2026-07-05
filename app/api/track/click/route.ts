// app/api/track/click/route.ts
// 🆕 LOT 2 — Proxy de redirection pour les liens d'emails (séquences,
// workflows, livraison). Journalise le clic (déclencheur Workflow
// `email.link_clicked`) PUIS redirige vers l'URL réelle. Best-effort : toute
// erreur de tracking n'empêche jamais la redirection.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runWorkflowsForEvent } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dest = searchParams.get("u");
  const contactId = searchParams.get("c");
  const userId = searchParams.get("uid");

  // Lien de secours si la destination est absente/invalide : on ne redirige
  // jamais vers un schéma arbitraire (javascript:, data:…), http(s) uniquement.
  if (!dest || !/^https?:\/\//i.test(dest)) {
    return NextResponse.redirect(new URL("/", request.url));
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
