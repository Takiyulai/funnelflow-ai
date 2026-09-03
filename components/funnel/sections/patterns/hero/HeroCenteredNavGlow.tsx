"use client";

// Pattern hero « hero-centered-nav-glow » (zip Claude Design), converti en
// composant React COLOR-AWARE : les couleurs figées de la démo (violet/rose)
// sont remplacées par les variables du tunnel (--ff-accent, --ff-ink, --ff-bg).
// Textes = données de la section (headline=hook, subheadline=promesse), CTA via
// le CtaButton du projet (liens résolus). Reveal via data-ff-anim (système existant).

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { CtaButton } from "@/components/funnel/CtaButton";
import { RichText } from "@/components/funnel/RichText";
import SectionBackgroundLayer from "@/components/funnel/SectionBackgroundLayer";

type Props = {
  section: FunnelSection;
  funnel?: Funnel;
  mode?: "preview" | "public";
};

export function HeroCenteredNavGlow({ section, mode = "public" }: Props) {
  return (
    <section
      id={section.id || "hero"}
      data-ff-section="hero"
      data-ff-pattern="hero-centered-nav-glow"
      data-ff-text-align={section.style?.align || undefined}
      className="ff-section ff-hero"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--ff-bg, #0A0E27)",
        color: "var(--ff-ink, #E9D5FF)",
      }}
    >
      <SectionBackgroundLayer background={section.background}>
      {/* Halos animés color-aware (décoratif) */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: -140,
            left: "8%",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--ff-accent) 40%, transparent), transparent 66%)",
            filter: "blur(8px)",
            animation: "hp-float-a 13s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            right: "4%",
            width: 560,
            height: 560,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--ff-accent) 26%, transparent), transparent 66%)",
            filter: "blur(8px)",
            animation: "hp-float-b 16s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            right: "30%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--ff-accent) 16%, transparent), transparent 68%)",
            animation: "hp-float-a 18s ease-in-out infinite",
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: 820,
          margin: "0 auto",
          padding: "90px 28px 116px",
          textAlign: "center",
        }}
      >
        {section.eyebrow && (
          <RichText
            as="span"
            className="ff-eyebrow"
            text={section.eyebrow}
            dataAnim="fade-up"
          />
        )}
        {section.headline && (
          <RichText
            as="h1"
            className="ff-headline ff-hero-headline"
            text={section.headline}
            dataAnim="fade-up"
          />
        )}
        {section.subheadline && (
          <RichText
            as="p"
            className="ff-subheadline"
            text={section.subheadline}
            dataAnim="fade-up"
          />
        )}
        {section.cta && (
        <div className="ff-cta-wrap" style={{ marginTop: 34 }}>
            <CtaButton cta={section.cta} className="ff-btn ff-cta-attn" disabled={mode === "preview"} />
          </div>
        )}
      </div>
      </SectionBackgroundLayer>
    </section>
  );
}
