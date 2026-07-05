// app/tunnel/[slug]/merci/page.tsx
//
// Page de succès après paiement Stripe Checkout (success_url). Volontairement
// autonome et neutre (pas de dépendance au rendu du tunnel) pour s'afficher
// instantanément quel que soit le thème du tunnel.
// Restylée d'après le design "Pages Secondaires" (icône SVG animée cercle→check,
// palette harmonisée avec la landing, CTA shimmer). Animations 100 % CSS afin de
// rester un Server Component. `prefers-reduced-motion` respecté.

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
        @keyframes af-fade-up { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes af-cta { 0%,100% { transform:scale(1); box-shadow:0 10px 26px -12px rgba(199,164,54,.5) } 50% { transform:scale(1.05); box-shadow:0 22px 50px -10px rgba(199,164,54,.95) } }
        @keyframes af-shine { 0% { transform:translateX(-160%) skewX(-18deg) } 55%,100% { transform:translateX(360%) skewX(-18deg) } }
        .af-card { animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) both }
        .af-ring { stroke-dasharray:207; stroke-dashoffset:207; transform:rotate(-90deg); transform-origin:center; animation: af-ring-draw .55s cubic-bezier(.5,0,.2,1) forwards }
        .af-check { stroke-dasharray:48; stroke-dashoffset:48; animation: af-check-draw .4s cubic-bezier(.5,0,.2,1) .5s forwards }
        .af-burst { animation: af-burst .6s ease-out .85s }
        .af-s1 { opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .7s forwards }
        .af-s2 { opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .82s forwards }
        .af-cta { position:relative; overflow:hidden; isolation:isolate; opacity:0; animation: af-fade-up .5s cubic-bezier(.16,.84,.44,1) .94s forwards, af-cta 2.6s ease-in-out 1.5s infinite }
        .af-cta::after { content:""; position:absolute; top:0; left:0; width:34%; height:100%; z-index:-1; background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent); animation: af-shine 2.8s ease-in-out 1.5s infinite; pointer-events:none }
        @media (prefers-reduced-motion: reduce) {
          .af-ring, .af-check { stroke-dashoffset:0 !important; animation:none !important }
          .af-burst { display:none }
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
          Merci pour votre confiance. Votre commande est bien enregistrée&nbsp;; vous
          allez recevoir un email de confirmation avec les détails d&apos;accès à votre
          offre.
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
          Accéder à mon offre →
        </a>
      </div>
    </main>
  );
}
