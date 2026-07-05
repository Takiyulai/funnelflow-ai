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
        background: "#080E1A",
        color: "#E6EDF7",
        fontFamily: "'Instrument Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
        @keyframes af-ring-draw { from { stroke-dashoffset:207 } to { stroke-dashoffset:0 } }
        @keyframes af-check-draw { from { stroke-dashoffset:48 } to { stroke-dashoffset:0 } }
        @keyframes af-burst { 0% { transform:scale(.4); opacity:.9 } 100% { transform:scale(1.8); opacity:0 } }
        @keyframes af-spin { to { transform:rotate(360deg) } }
        @keyframes af-fade-up { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes af-cta { 0%,100% { transform:scale(1); box-shadow:0 10px 26px -12px rgba(199,164,54,.5) } 50% { transform:scale(1.05); box-shadow:0 22px 50px -10px rgba(199,164,54,.95) } }
        @keyframes af-shine { 0% { transform:translateX(-160%) skewX(-18deg) } 55%,100% { transform:translateX(360%) skewX(-18deg) } }
        .af-card { animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) both }
        .af-ring { stroke-dasharray:207; stroke-dashoffset:207; transform:rotate(-90deg); transform-origin:center; animation: af-ring-draw .55s cubic-bezier(.5,0,.2,1) forwards }
        .af-check { stroke-dasharray:48; stroke-dashoffset:48; animation: af-check-draw .4s cubic-bezier(.5,0,.2,1) .5s forwards }
        .af-burst { animation: af-burst .6s ease-out .85s }
        .af-spinner { transform-box:fill-box; transform-origin:center; animation: af-spin 1s linear infinite }
        .af-s1 { opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .7s forwards }
        .af-s2 { opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .82s forwards }
        .af-cta { position:relative; overflow:hidden; isolation:isolate; opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .94s forwards, af-cta 2.6s ease-in-out 1.5s infinite }
        .af-cta::after { content:""; position:absolute; top:0; left:0; width:34%; height:100%; z-index:-1; background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent); animation: af-shine 2.8s ease-in-out 1.5s infinite; pointer-events:none }
        @media (prefers-reduced-motion: reduce) {
          .af-ring, .af-check { stroke-dashoffset:0 !important; animation:none !important }
          .af-burst { display:none }
          .af-spinner { animation:none !important }
          .af-card, .af-s1, .af-s2, .af-cta { opacity:1 !important; animation:none !important }
        }
      `}</style>
      <div
        className="af-card"
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: "#0D1628",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: "44px 28px",
          boxShadow: "0 24px 64px -28px rgba(0,0,0,0.6)",
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
        <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 24px" }}>
          <svg viewBox="0 0 96 96" width={96} height={96}>
            <circle cx={48} cy={48} r={42} stroke="rgba(255,255,255,.08)" strokeWidth={7} fill="none" />
            <circle
              className="af-spinner"
              cx={48}
              cy={48}
              r={42}
              stroke="url(#afb)"
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              style={{ strokeDasharray: "70 264" }}
            />
            <defs>
              <linearGradient id="afb" x1="0" y1="0" x2="96" y2="96">
                <stop offset="0" stopColor="#08498D" />
                <stop offset="1" stopColor="#31845C" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="af-s1" style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", margin: 0 }}>
          Vérification du paiement…
        </h1>
        <p className="af-s2" style={{ fontSize: 14.5, color: "#9aa6ba", lineHeight: 1.6, margin: "12px 0 22px" }}>
          Si vous venez de payer, votre confirmation arrive par email d&apos;ici
          quelques instants. Vous pouvez continuer dès maintenant.
        </p>
        <a
          href={continueUrl}
          className="af-cta"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'Archivo', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "#080E1A",
            background: "#C7A436",
            padding: "13px 24px",
            borderRadius: 11,
          }}
        >
          Continuer →
        </a>
      </>,
    );
  }

  // Paiement confirmé → on continue le tunnel (auto-redirection + bouton).
  return shell(
    <>
      <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 24px" }}>
        <span
          className="af-burst"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(49,132,92,.5), transparent 70%)",
          }}
        />
        <svg viewBox="0 0 84 84" width={84} height={84} fill="none" style={{ position: "relative" }}>
          <circle cx={42} cy={42} r={33} stroke="url(#afg)" strokeWidth={5} strokeLinecap="round" className="af-ring" />
          <path d="M27 43.5 L37 53 L58 31" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" className="af-check" />
          <defs>
            <linearGradient id="afg" x1="0" y1="0" x2="84" y2="84">
              <stop offset="0" stopColor="#31845C" />
              <stop offset="1" stopColor="#08498D" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1 className="af-s1" style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>
        Paiement confirmé&nbsp;!
      </h1>
      <p className="af-s2" style={{ fontSize: 14.5, color: "#9aa6ba", lineHeight: 1.6, margin: "12px 0 22px" }}>
        Merci pour votre confiance. Vous allez être redirigé vers la suite
        automatiquement…
      </p>
      <a
        href={continueUrl}
        className="af-cta"
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "'Archivo', sans-serif",
          fontWeight: 700,
          fontSize: 14,
          color: "#080E1A",
          background: "#C7A436",
          padding: "13px 24px",
          borderRadius: 11,
        }}
      >
        Continuer maintenant →
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
