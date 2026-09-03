"use client";

// Patterns BÉNÉFICES (zip Claude Design) → composants React color-aware.
// 4 variantes : benefits-grid-numbered-flat, benefits-cards-4-shadow-longtext,
// benefits-horizontal-steps-arrow, benefits-cards-6-shadow-classic.
// Données = section.bullets ("Titre | Description"). Couleurs de démo → variables
// du tunnel (--ff-accent, --ff-ink, --ff-card-bg, --ff-card-border).
// Contenu SEUL : la <section>, le fond et le padding viennent du wrapper de
// FunnelPreview (data-ff-section="benefits" + data-ff-pattern).

import type { ComponentType, CSSProperties } from "react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { RichText } from "@/components/funnel/RichText";

export type BenefitItem = { title: string; desc: string };

export type BenefitsPatternProps = {
  section: FunnelSection;
  items: BenefitItem[];
  funnel?: Funnel;
  mode?: "preview" | "public";
};

function Header({ section, center }: { section: FunnelSection; center?: boolean }) {
  if (!section.headline && !section.subheadline && !section.body) return null;
  return (
    <div
      data-ff-anim="fade-up"
      style={{ textAlign: center ? "center" : "left", maxWidth: center ? 640 : 620, margin: center ? "0 auto" : undefined }}
    >
      {section.headline && (
        <RichText as="h2" className="ff-headline" text={section.headline} />
      )}
      {section.subheadline && (
        <div style={{ marginTop: 12 }}>
          <RichText as="p" className="ff-subheadline" text={section.subheadline} />
        </div>
      )}
      {section.body && (
        <RichText as="p" className="ff-body" text={section.body} style={{ marginTop: 16 }} />
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--ff-card-bg, #fff)",
  border: "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))",
  borderRadius: 16,
  padding: "26px 24px",
  boxShadow: "0 10px 30px rgba(0,0,0,.08)",
};

function AccentBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 12,
        background: "color-mix(in srgb, var(--ff-accent) 14%, transparent)",
        color: "var(--ff-accent)",
        fontWeight: 800,
        fontSize: 18,
      }}
    >
      {children}
    </span>
  );
}

function ItemTitle({ children }: { children: string }) {
  return (
    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ff-ink)", lineHeight: 1.25 }}>
      <RichText as="span" text={children} />
    </h3>
  );
}

function ItemDesc({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ff-ink)", opacity: 0.78 }}>
      <RichText as="span" text={children} />
    </p>
  );
}

// ── Pattern 1 : grille numérotée plate (pas de carte) ─────────────────────────
function BenefitsGridNumberedFlat({ section, items }: BenefitsPatternProps) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <Header section={section} center />
      <div
        className="ff-benefits-grid2"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "34px 48px", marginTop: 40 }}
      >
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <span
              aria-hidden="true"
              style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: "var(--ff-accent)", opacity: 0.9 }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ItemTitle>{it.title}</ItemTitle>
              <ItemDesc>{it.desc}</ItemDesc>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 2 : 4 cartes ombrées, texte long ──────────────────────────────────
function BenefitsCards4ShadowLongtext({ section, items }: BenefitsPatternProps) {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Header section={section} />
      <div
        className="ff-benefits-grid2"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 40 }}
      >
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <AccentBadge>✓</AccentBadge>
            <ItemTitle>{it.title}</ItemTitle>
            <ItemDesc>{it.desc}</ItemDesc>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 3 : étapes horizontales reliées par des flèches ───────────────────
function BenefitsHorizontalStepsArrow({ section, items }: BenefitsPatternProps) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Header section={section} center />
      <div
        className="ff-benefits-steps"
        style={{ display: "flex", alignItems: "stretch", gap: 8, marginTop: 44 }}
      >
        {items.map((it, i) => (
          <div key={i} className="ff-benefits-step" style={{ display: "contents" }}>
            <div data-ff-anim="fade-up" data-ff-anim-index={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center", padding: "0 8px" }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: "color-mix(in srgb, var(--ff-accent) 14%, transparent)",
                  color: "var(--ff-accent)",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {i + 1}
              </span>
              <ItemTitle>{it.title}</ItemTitle>
              <ItemDesc>{it.desc}</ItemDesc>
            </div>
            {i < items.length - 1 && (
              <div
                className="ff-benefits-arrow"
                aria-hidden="true"
                style={{ display: "flex", alignItems: "center", color: "var(--ff-accent)", fontSize: 24, opacity: 0.7 }}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 4 : 6 cartes ombrées, grille 3 colonnes ───────────────────────────
function BenefitsCards6ShadowClassic({ section, items }: BenefitsPatternProps) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Header section={section} center />
      <div
        className="ff-benefits-grid3"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 40 }}
      >
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
            <AccentBadge>✓</AccentBadge>
            <ItemTitle>{it.title}</ItemTitle>
            <ItemDesc>{it.desc}</ItemDesc>
          </div>
        ))}
      </div>
    </div>
  );
}

export const BENEFITS_PATTERNS: Record<string, ComponentType<BenefitsPatternProps>> = {
  "benefits-grid-numbered-flat": BenefitsGridNumberedFlat,
  "benefits-cards-4-shadow-longtext": BenefitsCards4ShadowLongtext,
  "benefits-horizontal-steps-arrow": BenefitsHorizontalStepsArrow,
  "benefits-cards-6-shadow-classic": BenefitsCards6ShadowClassic,
};
