// app/tunnel/[slug]/cancel/page.tsx
//
// Page affichée quand le prospect ABANDONNE le paiement Stripe (cancel_url).
// Aucune écriture en base : la commande reste "pending". On propose simplement
// de revenir à la page de vente pour réessayer.
// Restylée d'après le design "Pages Secondaires" (flèche retour SVG animée,
// palette harmonisée). Animations 100 % CSS (Server Component). reduced-motion OK.

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
        background: "#080E1A",
        color: "#E6EDF7",
        fontFamily: "'Instrument Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
        @keyframes af-arrow-draw { from { stroke-dashoffset:60 } to { stroke-dashoffset:0 } }
        @keyframes af-arrow-swing { 0%,100% { transform:translateX(0) } 50% { transform:translateX(-5px) } }
        @keyframes af-fade-up { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes af-cta { 0%,100% { transform:scale(1); box-shadow:0 10px 26px -12px rgba(199,164,54,.5) } 50% { transform:scale(1.05); box-shadow:0 22px 50px -10px rgba(199,164,54,.95) } }
        @keyframes af-shine { 0% { transform:translateX(-160%) skewX(-18deg) } 55%,100% { transform:translateX(360%) skewX(-18deg) } }
        .af-card { animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) both }
        .af-arrow-wrap { animation: af-arrow-swing 1.8s ease-in-out 1s infinite }
        .af-arrow-path { stroke-dasharray:60; stroke-dashoffset:60; animation: af-arrow-draw .5s ease-out forwards }
        .af-arrow-head { stroke-dasharray:24; stroke-dashoffset:24; animation: af-arrow-draw .35s ease-out .35s forwards }
        .af-s1 { opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .7s forwards }
        .af-s2 { opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .82s forwards }
        .af-cta { position:relative; overflow:hidden; isolation:isolate; opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .94s forwards, af-cta 2.6s ease-in-out 1.5s infinite }
        .af-cta::after { content:""; position:absolute; top:0; left:0; width:34%; height:100%; z-index:-1; background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent); animation: af-shine 2.8s ease-in-out 1.5s infinite; pointer-events:none }
        @media (prefers-reduced-motion: reduce) {
          .af-arrow-path, .af-arrow-head { stroke-dashoffset:0 !important; animation:none !important }
          .af-arrow-wrap { animation:none !important }
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
        <div
          style={{
            width: 84,
            height: 84,
            margin: "0 auto 24px",
            borderRadius: "50%",
            background: "rgba(199,164,54,.1)",
            border: "1px solid rgba(199,164,54,.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg viewBox="0 0 48 48" width={42} height={42} fill="none" className="af-arrow-wrap">
            <path d="M30 14 H18 a8 8 0 0 0 0 16 H26" stroke="#C7A436" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="af-arrow-path" />
            <path d="M22 8 L16 14 L22 20" stroke="#C7A436" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="af-arrow-head" />
          </svg>
        </div>

        <h1 className="af-s1" style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", margin: 0 }}>
          Paiement annulé
        </h1>
        <p className="af-s2" style={{ fontSize: 14.5, color: "#9aa6ba", lineHeight: 1.6, margin: "12px 0 22px" }}>
          Aucun montant n&apos;a été débité. Vous pouvez réessayer quand vous le
          souhaitez.
        </p>
        <a
          href={`/tunnel/${slug}`}
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
          Revenir à l&apos;offre →
        </a>
      </div>
    </main>
  );
}
