// app/api/billing/cinetpay/init/route.ts
// 🆕 CinetPay — abonnement AutoFunnel AI (Point 2). Initialise un paiement
// Mobile Money pour l'utilisateur connecté sur le plan demandé, renvoie
// l'URL de paiement CinetPay vers laquelle rediriger le client.
//   POST { planId } → { ok, paymentUrl } | { ok:false, error }

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlanId } from "@/lib/billing/plans";
import { initCinetpaySubscriptionPayment } from "@/lib/billing/cinetpayLicense";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let planId = "";
  try {
    const body = (await request.json()) as { planId?: string };
    planId = (body.planId ?? "").trim();
  } catch {
    /* corps invalide → géré ci-dessous */
  }
  if (!isPlanId(planId)) {
    return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
  }

  // 🆕 CINETPAY_BASE_URL/API_KEY/API_PASSWORD manquants (Point 6, dev local
  // sans config) → erreur explicite plutôt qu'un crash 500 opaque.
  const missing = [
    !process.env.CINETPAY_BASE_URL?.trim() && "CINETPAY_BASE_URL",
    !process.env.CINETPAY_API_KEY?.trim() && "CINETPAY_API_KEY",
    !process.env.CINETPAY_API_PASSWORD?.trim() && "CINETPAY_API_PASSWORD",
  ].filter(Boolean);
  if (missing.length > 0) {
    // 🆕 Journalise PRÉCISÉMENT quelle(s) variable(s) manquent (jamais leur
    // valeur) — indispensable pour diagnostiquer un souci de scope Vercel
    // (Production/Preview/Development) sans avoir à deviner.
    console.error("[cinetpay] variables manquantes en runtime:", missing.join(", "));
    return NextResponse.json(
      { ok: false, error: "cinetpay_not_configured" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.full_name === "string" && meta.full_name.split(" ")[0]) ||
    undefined;
  const lastName =
    (typeof meta.last_name === "string" && meta.last_name) || undefined;

  const result = await initCinetpaySubscriptionPayment({
    userId: user.id,
    planId,
    email: user.email ?? "",
    firstName,
    lastName,
    origin,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, paymentUrl: result.paymentUrl });
}
