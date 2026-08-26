"use client";

// Pattern hero « hero-split-stats-search-b2b » (zip Claude Design) → composant
// COLOR-AWARE et IMAGE-AWARE : split 50/50, texte + CTA + proof à gauche ; à
// droite la PHOTO du hero si présente, sinon un mock produit décoratif (aux
// couleurs du tunnel). Couleurs de démo (cyan) remplacées par --ff-accent, etc.

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { CtaButton } from "@/components/funnel/CtaButton";
import { RichText } from "@/components/funnel/RichText";
import { resolveImageUrl } from "@/lib/funnels/resolveMedia";

type Props = {
  section: FunnelSection;
  funnel?: Funnel;
  mode?: "preview" | "public";
};

function ProductMock() {
  return (
    <div
      style={{
        transition: "transform .25s ease-out",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      <div
        style={{
          background: "var(--ff-surface, #fff)",
          border: "1px solid color-mix(in srgb, var(--ff-ink) 12%, transparent)",
          borderRadius: 18,
          boxShadow: "0 40px 80px -30px color-mix(in srgb, var(--ff-ink) 35%, transparent)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 16px",
            borderBottom: "1px solid color-mix(in srgb, var(--ff-ink) 8%, transparent)",
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ef6a6a" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#f2c14e" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#5dc98a" }} />
          <span
            style={{
              marginLeft: 10,
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              color: "color-mix(in srgb, var(--ff-ink) 45%, transparent)",
              background: "color-mix(in srgb, var(--ff-ink) 6%, transparent)",
              padding: "4px 12px",
              borderRadius: 6,
            }}
          >
            autofunnel.ai/mon-tunnel
          </span>
        </div>
        <div style={{ padding: 22 }}>
          <div
            style={{
              height: 120,
              borderRadius: 12,
              background: "linear-gradient(120deg, color-mix(in srgb, var(--ff-ink) 88%, #000), color-mix(in srgb, var(--ff-ink) 70%, var(--ff-accent)))",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 22px",
            }}
          >
            <div style={{ width: "54%", height: 13, borderRadius: 6, background: "rgba(255,255,255,.85)" }} />
            <div style={{ width: "38%", height: 9, borderRadius: 5, background: "rgba(255,255,255,.4)", marginTop: 10 }} />
            <div style={{ width: 96, height: 30, borderRadius: 8, background: "var(--ff-accent)", marginTop: 16 }} />
            <div
              style={{
                position: "absolute",
                right: -30,
                top: -30,
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "radial-gradient(circle, color-mix(in srgb, var(--ff-accent) 40%, transparent), transparent 70%)",
              }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 16 }}>
            {[
              { v: "128", l: "leads" },
              { v: "31%", l: "opt-in" },
              { v: "▲ live", l: "statut" },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  background: "color-mix(in srgb, var(--ff-ink) 4%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--ff-ink) 8%, transparent)",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 18, color: i === 2 ? "var(--ff-accent)" : "var(--ff-ink)" }}>{s.v}</div>
                <div style={{ fontSize: 10.5, color: "color-mix(in srgb, var(--ff-ink) 50%, transparent)", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSplitStatsB2b({ section, funnel, mode = "public" }: Props) {
  const imgUrl = resolveImageUrl(section.image, funnel);
  const bullets = (Array.isArray(section.bullets) ? section.bullets : []).slice(0, 3);

  return (
    <section
      id={section.id || "hero"}
      data-ff-section="hero"
      data-ff-pattern="hero-split-stats-search-b2b"
      className="ff-section ff-hero"
      style={{ position: "relative", overflow: "hidden", background: "var(--ff-bg)", color: "var(--ff-ink)" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -180,
          right: -120,
          width: 540,
          height: 540,
          borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--ff-accent) 16%, transparent), transparent 68%)",
          pointerEvents: "none",
        }}
      />
      <div
        className="ff-hero-split"
        style={{
          position: "relative",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "56px 32px 88px",
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 60,
          // 🆕 Colonnes étirées à la même hauteur : la colonne texte occupe
          // toute la hauteur de l'image et répartit son contenu (titre en haut,
          // CTA/preuves en bas) → proportion équilibrée texte/image (au lieu
          // d'un bloc court flottant, centré, avec du vide au-dessus/dessous).
          alignItems: "stretch",
        }}
      >
        {/* 🆕 Répartition verticale : le titre reste EN HAUT, le CTA + preuves
            sont poussés EN BAS (alignés sur le bas de l'image). Fini l'eyebrow/
            hook qui « descendent » quand l'image est haute (avant : tout était
            centré verticalement). */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "clamp(20px, 3vw, 36px)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(14px, 2.6vw, 28px)" }}>
            {section.eyebrow && (
              <RichText as="span" className="ff-eyebrow" text={section.eyebrow} dataAnim="fade-up" />
            )}
            {section.headline && (
              <RichText as="h1" className="ff-headline ff-hero-headline" text={section.headline} dataAnim="fade-up" />
            )}
            {section.subheadline && (
              <RichText as="p" className="ff-subheadline" text={section.subheadline} dataAnim="fade-up" />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {section.cta && (
        <div className="ff-cta-wrap" style={{ justifyContent: "flex-start", display: "flex" }}>
                <CtaButton cta={section.cta} className="ff-btn ff-cta-attn" disabled={mode === "preview"} />
              </div>
            )}
            {bullets.length >= 2 && (
              <div
                style={{ display: "flex", alignItems: "stretch", gap: 26, flexWrap: "wrap" }}
              >
                {bullets.map((b, i) => (
                  <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ display: "flex", alignItems: "center", gap: 26 }}>
                    {i > 0 && <div style={{ width: 1, alignSelf: "stretch", background: "color-mix(in srgb, var(--ff-ink) 14%, transparent)" }} />}
                    <div style={{ fontWeight: 600, fontSize: 15, color: "color-mix(in srgb, var(--ff-ink) 78%, transparent)", maxWidth: 180 }}>{b}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ff-hero-media" data-ff-anim="fade-up" style={{ position: "relative" }}>
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt={section.image?.alt ?? ""}
              style={{
                width: "100%",
                borderRadius: 18,
                boxShadow: "0 40px 80px -30px color-mix(in srgb, var(--ff-ink) 35%, transparent)",
                display: "block",
              }}
            />
          ) : (
            <ProductMock />
          )}
        </div>
      </div>
    </section>
  );
}
