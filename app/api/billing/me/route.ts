// app/api/billing/me/route.ts
// Résumé d'abonnement de l'utilisateur connecté (pour l'UI : Sidebar, etc.).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/billing/subscription";
import { PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // On renvoie le plan RÉELLEMENT souscrit (profil), pas le plan « effectif »
  // de getAccess (qui retombe sur Agency quand le gating est désactivé) — sinon
  // la Sidebar afficherait « Plan Agency » à tout le monde.
  const profile = await getProfile(user.id);
  const planId = profile?.plan ?? null;
  const status = profile?.status ?? "inactive";
  const active = status === "active" || status === "trialing";
  return NextResponse.json({
    ok: true,
    planId,
    planName: planId ? PLANS[planId].name : null,
    status,
    active,
  });
}
