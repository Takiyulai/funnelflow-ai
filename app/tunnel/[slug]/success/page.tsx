// app/tunnel/[slug]/success/page.tsx
//
// Page de CONFIRMATION après paiement Stripe Checkout (success_url).
// Rôle : vérifier que la session est bien payée, afficher une confirmation,
// puis ENCHAÎNER vers l'étape suivante du tunnel (bonus / upsell / merci).
//
// ⚠️ Cette page ne MODIFIE PAS la base. La source de vérité reste le webhook
// (/api/stripe/webhook) qui marque la commande payée, promeut le contact en
// client et envoie l'email. Ici on se contente de LIRE le statut Stripe pour
// décider de continuer le parcours. Cela évite toute course/duplication.

import type { ReactNode } from "react";
import { createStripeClient } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function isSessionPaid(
  sessionId: string,
): Promise<{ paid: boolean; nextUrl: string | null }> {
  if (!process.env.STRIPE_SECRET_KEY) return { paid: true, nextUrl: null };
  try {
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
    const nextUrl =
      typeof session.metadata?.nextUrl === "string" && session.metadata.nextUrl
        ? session.metadata.nextUrl
        : null;
    return { paid, nextUrl };
  } catch {
    return { paid: false, nextUrl: null };
  }
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

  const fallbackNext = `/tunnel/${slug}/merci`;
  const { paid, nextUrl } = sessionId
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
