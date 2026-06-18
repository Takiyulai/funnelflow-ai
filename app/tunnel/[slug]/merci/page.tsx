// app/tunnel/[slug]/merci/page.tsx
//
// Page de succès après paiement Stripe Checkout (success_url). Volontairement
// autonome et neutre (pas de dépendance au rendu du tunnel) pour s'afficher
// instantanément quel que soit le thème du tunnel.

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
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
        padding: "24px",
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
            background: "linear-gradient(135deg,#31845C,#08498D)",
            fontSize: 32,
          }}
        >
          ✓
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px" }}>
          Paiement confirmé&nbsp;!
        </h1>
        <p style={{ color: "#94A3B8", lineHeight: 1.6, margin: "0 0 20px" }}>
          Merci pour votre confiance. Votre commande est bien enregistrée&nbsp;;
          vous allez recevoir un email de confirmation avec les détails d&apos;accès
          à votre offre.
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
          Retour
        </a>
      </div>
    </main>
  );
}
