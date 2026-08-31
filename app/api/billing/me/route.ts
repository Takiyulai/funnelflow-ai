// app/api/billing/me/route.ts
// Résumé d'abonnement de l'utilisateur connecté (pour l'UI : Sidebar, etc.).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getProfile, getAccess } from "@/lib/billing/subscription";
import { getActiveChariowLicense } from "@/lib/billing/chariow";
import { PLANS } from "@/lib/billing/plans";
import { isInternalTestAccountEmail } from "@/lib/billing/internalTestAccounts";

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
  let planId = profile?.plan ?? null;
  let status = profile?.status ?? "inactive";
  let active = status === "active" || status === "trialing";
  const internalTestAccount = isInternalTestAccountEmail(user.email);

  // L'abonnement réel reste intact dans profiles, mais l'interface doit refléter
  // les droits Agency effectifs du compte test au lieu d'afficher Starter.
  if (internalTestAccount) {
    planId = "agency";
    status = "active";
    active = true;
  }

  // 🆕 Pas d'abonnement Stripe/CinetPay actif → vérifier une licence Chariow
  // active (même fallback que lib/billing/subscription.ts::getAccess()).
  // Sans ça, la Sidebar affichait "Aucun abonnement actif" alors qu'une
  // licence Chariow active débloquait pourtant bien la plateforme.
  if (!active) {
    try {
      const license = await getActiveChariowLicense(user.id);
      if (license) {
        planId = license.plan;
        status = "active";
        active = true;
      }
    } catch (e) {
      console.error("[billing/me] chariow license check failed", e);
    }
  }

  // 🆕 `hasAccess` = droit EFFECTIF d'agir (respecte BILLING_ENFORCED : quand le
  // gating est désactivé, vaut true pour tous ; quand il est activé, exige un
  // abonnement/licence actif). Sert à gater côté client les actions importantes
  // (ex : publication) qui ne passent pas par une route API gardée.
  const access = await getAccess(user.id, user.email);

  // 🆕 Jours restants avant expiration de la licence (table user_licenses,
  // intégration CinetPay). On prend la licence ACTIVE dont l'expiration est la
  // plus LOINTAINE (max expires_at). Un jour entamé compte comme restant
  // (Math.ceil). Best-effort : indisponible → daysRemaining/expiresAt = null,
  // l'UI retombe alors sur l'affichage simple « Abonnement actif ».
  let expiresAt: string | null = null;
  let daysRemaining: number | null = null;
  try {
    const admin = getSupabaseAdmin();
    const { data: lic } = await admin
      .from("user_licenses")
      .select("expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lic?.expires_at) {
      expiresAt = lic.expires_at as string;
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      daysRemaining = Math.ceil(diffMs / 86_400_000);
    }
  } catch (e) {
    console.error("[billing/me] lecture user_licenses échouée", e);
  }

  return NextResponse.json({
    ok: true,
    planId,
    planName: planId ? PLANS[planId].name : null,
    status,
    active,
    hasAccess: access.hasAccess,
    expiresAt,
    daysRemaining,
  });
}
