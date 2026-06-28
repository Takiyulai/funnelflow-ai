// app/api/stripe/webhook/route.ts
//
// Palier 2 — webhook Stripe. À enregistrer dans Stripe (Dashboard → Developers
// → Webhooks) sur l'URL https://VOTRE_DOMAINE/api/stripe/webhook avec l'event
// `checkout.session.completed`. La clé de signature va dans STRIPE_WEBHOOK_SECRET.
//
// Sur paiement réussi :
//   1) la commande passe à "paid" ;
//   2) le contact (lead) devient "client" avec le montant ;
//   3) un email de confirmation/livraison part (Resend).

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/billing/stripe";
import {
  markOrderPaidBySession,
  markOrderPaidByPaymentIntent,
  markOrderFailedByPaymentIntent,
} from "@/lib/billing/orders";
import { syncSubscriptionToProfile, markPastDueByCustomer } from "@/lib/billing/subscriptionSync";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, resendConfigured } from "@/lib/crm/email";

export const dynamic = "force-dynamic";

/** Upsert d'un contact "client" payant (création ou promotion d'un lead). */
async function markContactAsClient(params: {
  userId: string;
  funnelId: string | null;
  email: string;
  amount: number;
  currency: string;
}): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const email = params.email.toLowerCase().trim();

  const { data: existing } = await admin
    .from("leads")
    .select("id, metadata")
    .eq("user_id", params.userId)
    .eq("email", email)
    .maybeSingle();

  const purchase = {
    last_purchase_amount: params.amount,
    last_purchase_currency: params.currency,
    last_purchase_at: new Date().toISOString(),
  };

  if (existing) {
    const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
    await admin
      .from("leads")
      .update({ status: "client", metadata: { ...meta, ...purchase } })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: inserted } = await admin
    .from("leads")
    .insert({
      user_id: params.userId,
      funnel_id: params.funnelId,
      email,
      status: "client",
      source: "stripe_checkout",
      metadata: purchase,
    })
    .select("id")
    .maybeSingle();
  return (inserted?.id as string | undefined) ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  // Corps BRUT requis pour la vérification de signature.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = createStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error("[stripe/webhook] signature invalide", e);
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  // ───────────────────────────────────────────────────────────────────────
  // ABONNEMENTS PLATEFORME (mode subscription).
  // ───────────────────────────────────────────────────────────────────────
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    try {
      await syncSubscriptionToProfile(sub);
    } catch (e) {
      console.error("[stripe/webhook] syncSubscription échoué:", e);
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      try {
        await markPastDueByCustomer(customerId);
      } catch (e) {
        console.error("[stripe/webhook] markPastDue échoué:", e);
      }
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ───────────────────────────────────────────────────────────────────────
  // PAIEMENTS TUNNEL (one-time) — traçabilité via PaymentIntent.
  // Filet de sécurité + suivi des échecs. N'agit que sur des commandes
  // existantes (achats de tunnel) → jamais sur les abonnements.
  // ───────────────────────────────────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    if (pi.metadata?.type === "funnel_purchase") {
      try {
        await markOrderPaidByPaymentIntent(pi.id);
      } catch (e) {
        console.error("[stripe/webhook] markOrderPaidByPI échoué:", e);
      }
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    try {
      await markOrderFailedByPaymentIntent(pi.id);
    } catch (e) {
      console.error("[stripe/webhook] markOrderFailedByPI échoué:", e);
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Abonnement à la plateforme : activer le profil et s'arrêter là (ne PAS
    // exécuter le flux "commande one-time" ci-dessous).
    if (session.mode === "subscription") {
      const subId =
        typeof session.subscription === "string" ? session.subscription : null;
      if (subId) {
        try {
          const stripe = createStripeClient();
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscriptionToProfile(sub);
        } catch (e) {
          console.error("[stripe/webhook] activation abonnement échouée:", e);
        }
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentIntent =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    // 🆕 Email collecté par Stripe Checkout → on le persiste sur la commande
    // (sinon « Clients » reste à 0) et on l'utilise pour le contact/email.
    const sessionEmail =
      session.customer_details?.email || session.customer_email || null;

    const order = await markOrderPaidBySession(session.id, paymentIntent, sessionEmail);

    // Si la commande n'existe pas/déjà payée, on s'arrête (idempotence).
    if (order) {
      const email = order.email || sessionEmail;

      if (email) {
        try {
          await markContactAsClient({
            userId: order.userId,
            funnelId: order.funnelId,
            email,
            amount: order.amount,
            currency: order.currency,
          });
        } catch (e) {
          console.warn("[stripe/webhook] markContactAsClient échoué:", e);
        }

        // Email de confirmation / livraison (non bloquant).
        if (resendConfigured()) {
          const montant = (order.amount / 100).toFixed(2);
          try {
            await sendEmail({
              to: email,
              subject: "Merci pour votre achat 🎉",
              html: `<p>Bonjour,</p><p>Votre paiement de <strong>${montant} ${order.currency.toUpperCase()}</strong> a bien été reçu.</p><p>Vous recevrez les détails d'accès à votre offre très prochainement.</p><p>Merci de votre confiance.</p>`,
            });
          } catch (e) {
            console.warn("[stripe/webhook] email livraison échoué:", e);
          }
        }
      }
    }
  }

  // Toujours 200 pour éviter les retentatives Stripe sur événements ignorés.
  return NextResponse.json({ received: true }, { status: 200 });
}
