// app/api/billing/portal/route.ts
//
// Ouvre le portail de facturation Stripe pour que l'utilisateur gère son
// abonnement (changer de plan, mettre à jour sa carte, annuler).
// Requiert un client Stripe déjà rattaché (profiles.stripe_customer_id).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = (profile?.stripe_customer_id as string | null) ?? null;
  if (!customerId) {
    return NextResponse.json(
      { ok: false, error: "no_customer", message: "Aucun abonnement à gérer pour le moment." },
      { status: 422 },
    );
  }

  try {
    const stripe = createStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl(req)}/abonnement`,
    });
    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (e) {
    console.error("[api/billing/portal] stripe error", e);
    return NextResponse.json(
      { ok: false, error: "stripe_error", message: e instanceof Error ? e.message : undefined },
      { status: 500 },
    );
  }
}
