// app/api/checkout/route.ts
//
// Palier 2 — crée une session Stripe Checkout pour l'offre d'un tunnel publié.
// Le prix est lu CÔTÉ SERVEUR depuis published_content (pas de montant envoyé
// par le client → pas de falsification). Une commande "pending" est créée ;
// le webhook /api/stripe/webhook la passera à "paid".
//
// ⚠️ Les paiements vont sur le compte Stripe de la PLATEFORME (clé
//    STRIPE_SECRET_KEY). Pour que chaque utilisateur encaisse sur SON compte,
//    il faudra Stripe Connect (Palier 3).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/billing/stripe";
import { extractFunnelPrice, createPendingOrder } from "@/lib/billing/orders";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";
import { resolvePostPurchaseUrl } from "@/lib/funnels/postPurchase";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  funnelSlug: z.string().min(1).max(100),
  // Page d'où vient le clic d'achat → sert à calculer l'étape suivante.
  pageSlug: z.string().max(200).nullable().optional(),
  email: z.string().email().max(255).optional(),
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
      { ok: false, error: "stripe_not_configured", message: "Le paiement par carte n'est pas encore activé (clé Stripe manquante)." },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // Résolution funnel : slug public d'abord, puis slug brouillon.
  let { data: funnel } = await admin
    .from("funnels")
    .select("id, user_id, status, published_slug, slug, published_content")
    .eq("published_slug", payload.funnelSlug)
    .maybeSingle();
  if (!funnel) {
    const byDraft = await admin
      .from("funnels")
      .select("id, user_id, status, published_slug, slug, published_content")
      .eq("slug", payload.funnelSlug)
      .maybeSingle();
    funnel = byDraft.data;
  }

  if (!funnel) {
    return NextResponse.json({ ok: false, error: "funnel_not_found" }, { status: 404 });
  }
  if (funnel.status !== "published") {
    return NextResponse.json({ ok: false, error: "funnel_not_published" }, { status: 403 });
  }

  const priceInfo = extractFunnelPrice(funnel.published_content);
  if (!priceInfo) {
    return NextResponse.json(
      { ok: false, error: "no_price", message: "Aucun prix payant n'a été trouvé sur ce tunnel." },
      { status: 422 },
    );
  }

  const base = baseUrl(req);
  const slug = funnel.published_slug || funnel.slug;
  const pageSlug = payload.pageSlug ?? null;

  // Étape suivante du tunnel après paiement (chaînage de pages configurable).
  let nextUrl: string;
  try {
    const normalized = normalizeFunnel(funnel.published_content);
    nextUrl = resolvePostPurchaseUrl(normalized, pageSlug, slug);
  } catch {
    nextUrl = `/tunnel/${slug}/merci`;
  }

  try {
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: priceInfo.currency,
            unit_amount: priceInfo.amount,
            product_data: { name: priceInfo.productName },
          },
        },
      ],
      customer_email: payload.email,
      success_url: `${base}/tunnel/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/tunnel/${slug}/cancel`,
      // Métadonnées portées par la session ET par le PaymentIntent → traçables
      // côté webhook (checkout.session.completed + payment_intent.*) et
      // exploitables plus tard par n8n / automatisations CRM.
      metadata: {
        type: "funnel_purchase",
        funnelId: funnel.id,
        userId: funnel.user_id,
        funnelSlug: slug,
        pageSlug: pageSlug ?? "",
        nextUrl,
      },
      payment_intent_data: {
        metadata: {
          type: "funnel_purchase",
          funnelId: funnel.id,
          userId: funnel.user_id,
          funnelSlug: slug,
        },
      },
    });

    await createPendingOrder({
      userId: funnel.user_id,
      funnelId: funnel.id,
      amount: priceInfo.amount,
      currency: priceInfo.currency,
      productName: priceInfo.productName,
      customerEmail: payload.email ?? null,
      stripeSessionId: session.id,
      pageSlug,
      nextUrl,
    });

    return NextResponse.json({ ok: true, url: session.url, nextUrl }, { status: 200 });
  } catch (e) {
    console.error("[api/checkout] stripe error", e);
    return NextResponse.json(
      { ok: false, error: "stripe_error", message: e instanceof Error ? e.message : undefined },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
