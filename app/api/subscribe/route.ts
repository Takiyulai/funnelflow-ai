// app/api/subscribe/route.ts
//
// Crée une session Stripe Checkout en mode ABONNEMENT (récurrent) pour que
// l'utilisateur connecté souscrive à un plan AutoFunnel (starter|pro|agency).
//
// ⚠️ Distinct de /api/checkout (paiement one-time du client FINAL d'un tunnel).
// Ici c'est l'utilisateur de la plateforme qui paie son abonnement mensuel.
//
// Le webhook /api/stripe/webhook activera le profil à la réception de
// `checkout.session.completed` (mode subscription).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/billing/stripe";
import { getStripePriceId, isPlanId } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  plan: z.string().refine(isPlanId, "plan invalide"),
});

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers.get("host");
  return host ? `https://${host}` : "";
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", message: "Les abonnements ne sont pas encore activés (clé Stripe manquante)." },
      { status: 503 },
    );
  }

  // 1) Utilisateur connecté requis.
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) Plan valide + price_id configuré.
  let plan: "starter" | "pro" | "agency";
  try {
    plan = bodySchema.parse(await req.json()).plan as typeof plan;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
  }
  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "price_not_configured", message: `Le prix Stripe du plan ${plan} n'est pas configuré (env manquante).` },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdmin();
  const stripe = createStripeClient();
  const base = baseUrl(req);

  try {
    // 3) Réutiliser / créer le client Stripe rattaché à l'utilisateur.
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = (profile?.stripe_customer_id as string | null) ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await admin
        .from("profiles")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
    }

    // 4) Session Checkout en mode subscription.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/dashboard?subscribed=1`,
      cancel_url: `${base}/abonnement?canceled=1`,
      allow_promotion_codes: true,
      metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
    });

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (e) {
    console.error("[api/subscribe] stripe error", e);
    return NextResponse.json(
      { ok: false, error: "stripe_error", message: e instanceof Error ? e.message : undefined },
      { status: 500 },
    );
  }
}
