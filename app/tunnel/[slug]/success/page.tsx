// app/tunnel/[slug]/success/page.tsx
//
// Page de CONFIRMATION après paiement Stripe Checkout (success_url).
// Rôle : vérifier que la session est bien payée, afficher une confirmation,
// puis ENCHAÎNER vers l'étape suivante du tunnel (bonus / upsell / merci).
//
// 🆕 FILET DE SÉCURITÉ : le webhook reste la source de vérité (email de
// livraison, etc.), MAIS si Stripe confirme ici que la session est payée, on
// marque AUSSI la commande "paid" + on promeut le contact en client. Ainsi les
// stats du dashboard se peuplent même quand le webhook local n'est pas branché
// (cas fréquent en dev sans `stripe listen --forward-connect-to`). Les écritures
// sont idempotentes (markOrderPaidBySession ignore une commande déjà payée).

import type { ReactNode } from "react";
import { createStripeClient } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  markOrderPaidBySession,
  markOrderPaidByCinetpayTransaction,
  promoteContactToClient,
} from "@/lib/billing/orders";
import { getCinetpayCredentials, checkCinetpayPayment } from "@/lib/billing/cinetpay";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// On lit d'abord la COMMANDE (Connect-agnostique : elle porte la redirection et,
// si c'est un paiement Connect, l'id du compte connecté). Si le webhook l'a déjà
// marquée "paid", on le sait sans appeler Stripe ; sinon on vérifie la session
// SUR LE BON COMPTE (la session d'un Direct charge vit sur le compte connecté).
async function isSessionPaid(
  sessionId: string,
): Promise<{ paid: boolean; nextUrl: string | null }> {
  const admin = getSupabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("status, redirect_url, next_url, stripe_connect_account_id, user_id, funnel_id, amount, currency")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  const nextUrl =
    (order?.redirect_url as string | null) ||
    (order?.next_url as string | null) ||
    null;

  if (order?.status === "paid") return { paid: true, nextUrl };
  if (!process.env.STRIPE_SECRET_KEY) return { paid: true, nextUrl };

  try {
    const stripe = createStripeClient();
    const acct = (order?.stripe_connect_account_id as string | null) ?? null;
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      undefined,
      acct ? { stripeAccount: acct } : undefined,
    );
    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
    const metaNext =
      typeof session.metadata?.nextUrl === "string" && session.metadata.nextUrl
        ? session.metadata.nextUrl
        : null;

    // 🆕 Filet : si payé, on marque la commande (idempotent) + promeut le client
    // → le dashboard se peuple même sans webhook local.
    if (paid && order) {
      const email =
        session.customer_details?.email || session.customer_email || null;
      const paymentIntent =
        typeof session.payment_intent === "string" ? session.payment_intent : null;
      try {
        const marked = await markOrderPaidBySession(sessionId, paymentIntent, email);
        if (marked && email) {
          await promoteContactToClient({
            userId: marked.userId,
            funnelId: marked.funnelId,
            email,
            amount: marked.amount,
            currency: marked.currency,
          });
        }
      } catch (e) {
        console.error("[success] mark paid fallback échoué", e);
      }
    }

    return { paid, nextUrl: nextUrl || metaNext };
  } catch {
    return { paid: false, nextUrl };
  }
}

// 🆕 Retour CinetPay : on vérifie le statut via l'API (clés du créateur) puis on
// marque la commande payée (filet, idempotent) — même logique que pour Stripe.
async function isCinetpayPaid(
  txnId: string,
): Promise<{ paid: boolean; nextUrl: string | null }> {
  const admin = getSupabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("status, redirect_url, next_url, user_id")
    .eq("cinetpay_transaction_id", txnId)
    .maybeSingle();
  const nextUrl =
    (order?.redirect_url as string | null) || (order?.next_url as string | null) || null;
  if (!order) return { paid: false, nextUrl };
  if (order.status === "paid") return { paid: true, nextUrl };

  const creds = await getCinetpayCredentials(order.user_id as string);
  if (!creds) return { paid: false, nextUrl };
  const check = await checkCinetpayPayment(creds.apikey, creds.siteId, txnId);
  if (check.paid) {
    try {
      const marked = await markOrderPaidByCinetpayTransaction(txnId, null);
      if (marked?.email) {
        await promoteContactToClient({
          userId: marked.userId,
          funnelId: marked.funnelId,
          email: marked.email,
          amount: marked.amount,
          currency: marked.currency,
        });
      }
    } catch (e) {
      console.error("[success] mark paid CinetPay fallback échoué", e);
    }
  }
  return { paid: check.paid, nextUrl };
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sessionId = (Array.isArray(sp.session_id) ? sp.session_id[0] : sp.session_id) ?? "";
  const cpmTrans = (Array.isArray(sp.cpm_trans_id) ? sp.cpm_trans_id[0] : sp.cpm_trans_id) ?? "";

  const fallbackNext = `/tunnel/${slug}/merci`;
  const { paid, nextUrl } = cpmTrans
    ? await isCinetpayPaid(cpmTrans)
    : sessionId
      ? await isSessionPaid(sessionId)
      : { paid: false, nextUrl: null };
  const continueUrl = nextUrl || fallbackNext;

  const shell = (children: ReactNode) => (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0B1220",
        color: "#E6EDF7",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: "#131C2E",
          border: "1px solid #243049",
          borderRadius: 18,
          padding: "40px 28px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </div>
    </main>
  );

  if (!paid) {
    // Paiement non confirmé (session invalide / non payée / Stripe indispo).
    return shell(
      <>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "#243049",
            fontSize: 30,
          }}
        >
          ⏳
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
          Vérification du paiement…
        </h1>
        <p style={{ color: "#94A3B8", lineHeight: 1.6, margin: "0 0 20px" }}>
          Si vous venez de payer, votre confirmation arrive par email d&apos;ici
          quelques instants. Vous pouvez continuer dès maintenant.
        </p>
        <a
          href={continueUrl}
          style={{
            display: "inline-block",
            padding: "12px 22px",
            borderRadius: 10,
            background: "#C7A436",
            color: "#0B1220",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Continuer
        </a>
      </>,
    );
  }

  // Paiement confirmé → on continue le tunnel (auto-redirection + bouton).
  return shell(
    <>
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 20px",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg,#31845C,#08498D)",
          fontSize: 32,
        }}
      >
        ✓
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px" }}>
        Paiement confirmé&nbsp;!
      </h1>
      <p style={{ color: "#94A3B8", lineHeight: 1.6, margin: "0 0 22px" }}>
        Merci pour votre confiance. Vous allez être redirigé vers la suite
        automatiquement…
      </p>
      <a
        href={continueUrl}
        style={{
          display: "inline-block",
          padding: "12px 22px",
          borderRadius: 10,
          background: "#C7A436",
          color: "#0B1220",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Continuer maintenant
      </a>
      {/* Auto-redirection douce après 2,5 s (sécurisée : URL interne au tunnel). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){window.location.href=${JSON.stringify(
            continueUrl,
          )};},2500);`,
        }}
      />
    </>,
  );
}
