"use client";

// Pattern hero « hero-video-centered-funnel » (zip Claude Design) → composant
// COLOR-AWARE : centré, bloc vidéo (embed réel si section.video, sinon lecteur
// placeholder animé), CTA, et cartes de preuve issues des puces. Couleurs de
// démo (cyan) → variables du tunnel (--ff-accent, --ff-ink, --ff-bg).

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { CtaButton } from "@/components/funnel/CtaButton";
import { RichText } from "@/components/funnel/RichText";
import { getVideoEmbed } from "@/lib/funnels/video";

type Props = {
  section: FunnelSection;
  funnel?: Funnel;
  mode?: "preview" | "public";
};

export function HeroVideoCenteredFunnel({ section, mode = "public" }: Props) {
  const embedUrl = section.video?.url ? getVideoEmbed(section.video.url).embedUrl : null;
  const bullets = (Array.isArray(section.bullets) ? section.bullets : []).slice(0, 3);

  return (
    <section
      id={section.id || "hero"}
      data-ff-section="hero"
      data-ff-pattern="hero-video-centered-funnel"
      className="ff-section ff-hero"
      style={{ position: "relative", overflow: "hidden", background: "var(--ff-bg)", color: "var(--ff-ink)" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -120,
          left: "50%",
          marginLeft: -380,
          width: 760,
          height: 520,
          background: "radial-gradient(circle, color-mix(in srgb, var(--ff-accent) 18%, transparent), transparent 64%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "48px 28px 88px", textAlign: "center" }}>
        {section.eyebrow && (
          <RichText as="span" className="ff-eyebrow" text={section.eyebrow} dataAnim="fade-up" />
        )}
        {section.headline && (
          <RichText as="h1" className="ff-headline ff-hero-headline" text={section.headline} dataAnim="fade-up" />
        )}
        {section.subheadline && (
          <RichText as="p" className="ff-subheadline" text={section.subheadline} dataAnim="fade-up" />
        )}

        {/* Bloc vidéo */}
        <div data-ff-anim="fade-up" style={{ marginTop: 40 }}>
          <div
            style={{
              position: "relative",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid color-mix(in srgb, var(--ff-ink) 14%, transparent)",
              background: "color-mix(in srgb, var(--ff-ink) 90%, #000)",
              aspectRatio: "16 / 9",
              boxShadow: "0 50px 100px -40px color-mix(in srgb, var(--ff-ink) 70%, transparent)",
            }}
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Vidéo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--ff-accent) 16%, transparent), transparent 60%)",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: "50%",
                      background: "var(--ff-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 26,
                      paddingLeft: 6,
                      animation: "hp-pulse-ring 2.4s ease-out infinite",
                    }}
                  >
                    ▶
                  </div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "color-mix(in srgb, var(--ff-ink) 55%, transparent)" }}>
                    Aperçu vidéo
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {section.cta && (
          <div className="ff-cta-wrap" data-ff-anim="fade-up" style={{ marginTop: 34 }}>
            <CtaButton cta={section.cta} className="ff-btn ff-cta-attn" disabled={mode === "preview"} />
          </div>
        )}

        {bullets.length >= 2 && (
          <div data-ff-anim="fade-up" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 46 }}>
            {bullets.map((b, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 210,
                  background: "color-mix(in srgb, var(--ff-ink) 5%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--ff-ink) 10%, transparent)",
                  borderRadius: 14,
                  padding: "18px 20px",
                  textAlign: "left",
                  fontSize: 14,
                  color: "color-mix(in srgb, var(--ff-ink) 80%, transparent)",
                  lineHeight: 1.45,
                }}
              >
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
