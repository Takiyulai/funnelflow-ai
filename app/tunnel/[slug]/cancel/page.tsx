// app/tunnel/[slug]/cancel/page.tsx
//
// Page affichée quand le prospect ABANDONNE le paiement Stripe (cancel_url).
// Aucune écriture en base : la commande reste "pending". On propose simplement
// de revenir à la page de vente pour réessayer.

export const dynamic = "force-dynamic";

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
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
          ↩
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
          Paiement annulé
        </h1>
        <p style={{ color: "#94A3B8", lineHeight: 1.6, margin: "0 0 22px" }}>
          Aucun montant n&apos;a été débité. Vous pouvez réessayer quand vous le
          souhaitez.
        </p>
        <a
          href={`/tunnel/${slug}`}
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
          Revenir à l&apos;offre
        </a>
      </div>
    </main>
  );
}
