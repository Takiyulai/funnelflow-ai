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
import { getCinetpayCredentials, initCinetpayPayment } from "@/lib/billing/cinetpay";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

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
  // 🆕 Anti-abus : limite par IP (création de sessions de paiement publiques).
  const rl = await rateLimit(`checkout:${clientIp(req)}`, 20, 60);
  if (!rl.ok) return tooManyRequests();

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

  // 🆕 Prix lu sur la PAGE d'où vient le clic (upsell/downsell ont leur propre
  // montant) ; repli sur l'offre principale si la page n'a pas de prix propre.
  const pageSlug = payload.pageSlug ?? null;
  const priceInfo = extractFunnelPrice(funnel.published_content, pageSlug);
  if (!priceInfo) {
    return NextResponse.json(
      { ok: false, error: "no_price", message: "Aucun prix payant n'a été trouvé sur ce tunnel." },
      { status: 422 },
    );
  }

  const base = baseUrl(req);
  const slug = funnel.published_slug || funnel.slug;

  // 🆕 Compte Connect du créateur : on encaisse SUR SON compte (Direct charge)
  // s'il est connecté et habilité aux paiements ; sinon repli sur la plateforme.
  const { data: prof } = await admin
    .from("profiles")
    .select("stripe_connect_account_id, connect_charges_enabled, payment_provider, cinetpay_status")
    .eq("user_id", funnel.user_id)
    .maybeSingle();
  const connectAccountId =
    prof?.connect_charges_enabled && prof?.stripe_connect_account_id
      ? (prof.stripe_connect_account_id as string)
      : null;

  // 🆕 Réglages paiement du tunnel (devise forcée + redirection perso).
  const payCfg =
    ((funnel.published_content as
      | { payment?: { currency?: string; postPurchaseUrl?: string } }
      | null)?.payment) ?? {};
  const currency =
    typeof payCfg.currency === "string" && payCfg.currency.trim()
      ? payCfg.currency.trim().toLowerCase()
      : priceInfo.currency;

  // 🆕 Redirection post-achat (le MIX) : URL perso si fournie, sinon chaînage de
  // pages (qui aboutit au « merci » auto).
  let nextUrl: string;
  const custom =
    typeof payCfg.postPurchaseUrl === "string" ? payCfg.postPurchaseUrl.trim() : "";
  if (custom) {
    nextUrl = custom;
  } else {
    try {
      const normalized = normalizeFunnel(funnel.published_content);
      nextUrl = resolvePostPurchaseUrl(normalized, pageSlug, slug);
    } catch {
      nextUrl = `/tunnel/${slug}/merci`;
    }
  }

  // 🆕 FOURNISSEUR CINETPAY : si le créateur a choisi CinetPay et l'a connecté,
  // on initialise un paiement CinetPay (ses propres clés → l'argent va chez lui)
  // et on renvoie l'URL du comptoir. Le front (PublicFunnelRuntime) redirige sur
  // `url` de façon agnostique au fournisseur.
  if (prof?.payment_provider === "cinetpay" && prof?.cinetpay_status === "active") {
    const creds = await getCinetpayCredentials(funnel.user_id);
    if (!creds) {
      return NextResponse.json(
        { ok: false, error: "cinetpay_not_connected", message: "Le compte CinetPay du vendeur n'est pas connecté." },
        { status: 503 },
      );
    }
    // CinetPay refuse localhost en notify/return_url.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(base)) {
      return NextResponse.json(
        {
          ok: false,
          error: "cinetpay_localhost",
          message:
            "CinetPay refuse les URL localhost. Teste via une URL publique (ngrok) ou en déploiement.",
        },
        { status: 400 },
      );
    }
    // Montant en devise LOCALE CinetPay : on prend la valeur entière du prix
    // (priceInfo.amount est en centimes) et la devise du compte CinetPay.
    const cpAmount = Math.round(priceInfo.amount / 100);
    const transactionId = `ff${Date.now()}${Math.random().toString(36).slice(2, 8)}`.replace(
      /[^a-zA-Z0-9]/g,
      "",
    );
    const init = await initCinetpayPayment({
      apikey: creds.apikey,
      siteId: creds.siteId,
      currency: creds.currency,
      transactionId,
      amount: cpAmount,
      description: priceInfo.productName,
      notifyUrl: `${base}/api/cinetpay/notify`,
      returnUrl: `${base}/tunnel/${slug}/success?cpm_trans_id=${transactionId}`,
      customer: payload.email ? { email: payload.email } : undefined,
      metadata: JSON.stringify({ funnelId: funnel.id, userId: funnel.user_id, pageSlug: pageSlug ?? "" }),
    });
    if (!init.ok || !init.paymentUrl) {
      return NextResponse.json(
        { ok: false, error: "cinetpay_init_failed", message: init.error ?? "Échec de l'initialisation CinetPay." },
        { status: 502 },
      );
    }
    await createPendingOrder({
      userId: funnel.user_id,
      funnelId: funnel.id,
      amount: cpAmount,
      currency: creds.currency.toLowerCase(),
      productName: priceInfo.productName,
      customerEmail: payload.email ?? null,
      pageSlug,
      nextUrl,
      redirectUrl: nextUrl,
      provider: "cinetpay",
      cinetpayTransactionId: transactionId,
    });
    return NextResponse.json({ ok: true, url: init.paymentUrl, nextUrl }, { status: 200 });
  }

  try {
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
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
          connectAccountId: connectAccountId ?? "",
        },
        payment_intent_data: {
          metadata: {
            type: "funnel_purchase",
            funnelId: funnel.id,
            userId: funnel.user_id,
            funnelSlug: slug,
          },
        },
      },
      // 🆕 Direct charge : si le créateur a un compte Connect actif, la session
      // est créée SUR son compte (l'argent va chez lui). Sinon, repli plateforme.
      connectAccountId ? { stripeAccount: connectAccountId } : undefined,
    );

    await createPendingOrder({
      userId: funnel.user_id,
      funnelId: funnel.id,
      amount: priceInfo.amount,
      currency,
      productName: priceInfo.productName,
      customerEmail: payload.email ?? null,
      stripeSessionId: session.id,
      pageSlug,
      nextUrl,
      stripeConnectAccountId: connectAccountId,
      redirectUrl: nextUrl,
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
