"use client";

// Patterns PRIX (zip Claude Design) → composants React color-aware.
// 3 variantes : pricing-single-card-spotlight, pricing-comparison-3tiers,
// pricing-split-guarantee-emphasis. Données normalisées en PriceTier[] par
// PricingRenderer. Contenu SEUL (wrapper = <section>/fond/padding).

import type { ComponentType, CSSProperties } from "react";
import type { CtaConfig, FunnelSection } from "@/lib/funnels/types";
import { RichText } from "@/components/funnel/RichText";

export type PriceTier = {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  cta?: CtaConfig;
};

export type PricingPatternProps = {
  section: FunnelSection;
  tiers: PriceTier[];
  mode?: "preview" | "public";
};

function resolveCta(cta?: CtaConfig): {
  href: string;
  target?: "_blank" | "_self";
  rel?: string;
  label: string;
} {
  let href = "#lead-form";
  let target: "_blank" | "_self" | undefined;
  let rel: string | undefined;
  if (cta) {
    if (cta.mode === "redirect") {
      href = cta.url || "#";
      target = cta.target ?? "_blank";
      rel = target === "_blank" ? "noopener noreferrer" : undefined;
    } else if (cta.mode === "anchor") {
      href = `#${cta.anchorId || "lead-form"}`;
      target = "_self";
    } else if (cta.mode === "popup") {
      href = `#${cta.popupId || "lead-form"}`;
      target = "_self";
    }
  }
  return { href, target, rel, label: cta?.label || "Je choisis cette offre" };
}

function CtaLink({ cta }: { cta?: CtaConfig }) {
  const { href, target, rel, label } = resolveCta(cta);
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      data-ff-cta
      className="ff-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        padding: "13px 18px",
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 14,
        textDecoration: "none",
        marginTop: "auto",
      }}
    >
      {label}
    </a>
  );
}

function Header({ section }: { section: FunnelSection }) {
  if (!section.headline && !section.subheadline) return null;
  return (
    <div data-ff-anim="fade-up" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
      {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} />}
      {section.subheadline && (
        <div style={{ marginTop: 12 }}>
          <RichText as="p" className="ff-subheadline" text={section.subheadline} />
        </div>
      )}
    </div>
  );
}

function Price({ tier }: { tier: PriceTier }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
      <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ff-ink)" }}>
        {tier.price || "—"}
      </span>
      {tier.period && (
        <span style={{ fontSize: 14, color: "var(--ff-ink)", opacity: 0.6 }}>{tier.period}</span>
      )}
    </div>
  );
}

function Features({ features }: { features: string[] }) {
  if (!features || features.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0, display: "flex", flexDirection: "column", gap: 12, flex: 1, textAlign: "left" }}>
      {features.map((f, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: "var(--ff-ink)", opacity: 0.9 }}>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--ff-accent) 14%, transparent)",
              color: "var(--ff-accent)",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            ✓
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{f}</span>
        </li>
      ))}
    </ul>
  );
}

function tierCardStyle(highlighted?: boolean): CSSProperties {
  return {
    background: "var(--ff-card-bg, #fff)",
    border: highlighted
      ? "1px solid var(--ff-accent)"
      : "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))",
    borderRadius: 18,
    padding: "30px 26px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    boxShadow: highlighted
      ? "0 24px 50px -12px color-mix(in srgb, var(--ff-accent) 35%, transparent)"
      : "0 10px 30px rgba(0,0,0,.08)",
    transform: highlighted ? "translateY(-6px)" : undefined,
  };
}

function Badge({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -13,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--ff-accent)",
        color: "var(--ff-accent-ink, #fff)",
        borderRadius: 999,
        padding: "5px 16px",
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

function TierCard({ tier, mode }: { tier: PriceTier; mode?: "preview" | "public" }) {
  void mode;
  return (
    <div style={tierCardStyle(tier.highlighted)}>
      {tier.highlighted && <Badge text={tier.badge || "Populaire"} />}
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ff-ink)" }}>{tier.name}</h3>
      {tier.description && (
        <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ff-ink)", opacity: 0.65 }}>{tier.description}</p>
      )}
      <div style={{ marginTop: 18 }}>
        <Price tier={tier} />
      </div>
      <Features features={tier.features} />
      <CtaLink cta={tier.cta} />
    </div>
  );
}

function pickMain(tiers: PriceTier[]): PriceTier {
  return tiers.find((t) => t.highlighted) || tiers[0];
}

// ── Pattern 1 : carte unique spotlight ────────────────────────────────────────
function PricingSingleCardSpotlight({ section, tiers, mode }: PricingPatternProps) {
  const tier = pickMain(tiers);
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <Header section={section} />
      <div data-ff-anim="fade-up">
        <TierCard tier={{ ...tier, highlighted: true }} mode={mode} />
      </div>
    </div>
  );
}

// ── Pattern 2 : comparaison 3 paliers ─────────────────────────────────────────
function PricingComparison3Tiers({ section, tiers, mode }: PricingPatternProps) {
  const list = tiers.slice(0, 3);
  // Si aucun tier "highlighted", on met celui du milieu en avant.
  const hasHi = list.some((t) => t.highlighted);
  const mid = Math.floor(list.length / 2);
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <Header section={section} />
      <div
        className="ff-pricing-grid3"
        data-ff-anim="fade-up"
        style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(list.length, 3)}, 1fr)`, gap: 20, alignItems: "stretch" }}
      >
        {list.map((t, i) => (
          <TierCard key={i} tier={{ ...t, highlighted: t.highlighted || (!hasHi && i === mid) }} mode={mode} />
        ))}
      </div>
    </div>
  );
}

// ── Pattern 3 : split carte + garantie mise en avant ──────────────────────────
function PricingSplitGuaranteeEmphasis({ section, tiers, mode }: PricingPatternProps) {
  const tier = pickMain(tiers);
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Header section={section} />
      <div
        className="ff-pricing-split"
        data-ff-anim="fade-up"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, alignItems: "center" }}
      >
        <TierCard tier={{ ...tier, highlighted: true }} mode={mode} />
        <div
          style={{
            background: "color-mix(in srgb, var(--ff-accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ff-accent) 26%, transparent)",
            borderRadius: 18,
            padding: "30px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 34 }}>🛡️</span>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ff-ink)" }}>
            Satisfait ou remboursé
          </h3>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ff-ink)", opacity: 0.8 }}>
            Teste sans risque. Si ce n'est pas pour toi, tu es remboursé — aucune
            question. Paiement sécurisé, sans engagement, annulable à tout moment.
          </p>
        </div>
      </div>
    </div>
  );
}

export const PRICING_PATTERNS: Record<string, ComponentType<PricingPatternProps>> = {
  "pricing-single-card-spotlight": PricingSingleCardSpotlight,
  "pricing-comparison-3tiers": PricingComparison3Tiers,
  "pricing-split-guarantee-emphasis": PricingSplitGuaranteeEmphasis,
};
