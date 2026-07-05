"use client";

// Patterns TRUSTBAR / LOGOS-CONFIANCE (léger, rendu sur les sections "proof").
// 3 variantes : trustbar-logos-marquee, trustbar-stats-inline-no-card,
// trustbar-press-quote-strip. Données = section.bullets ("Gauche | Droite") :
//  - logos-marquee     → left = nom de marque/média (chips défilants)
//  - stats-inline      → left = chiffre, right = label
//  - press-quote-strip → left = média, right = citation courte
// Contenu SEUL : la <section>, le fond et le padding viennent du wrapper de
// FunnelPreview. Couleurs via variables du tunnel (--ff-accent, --ff-ink).

import type { ComponentType } from "react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";

export type TrustPair = { left: string; right: string };

export type TrustbarPatternProps = {
  section: FunnelSection;
  items: TrustPair[];
  funnel?: Funnel;
  mode?: "preview" | "public";
};

// ── Pattern 1 : marquee de "logos" textuels (sans assets image) ───────────────
function TrustbarLogosMarquee({ items }: TrustbarPatternProps) {
  const labels = items.map((it) => it.left).filter(Boolean);
  if (labels.length === 0) return null;
  // Duplication pour un défilement continu sans saut.
  const loop = [...labels, ...labels];
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", overflow: "hidden", position: "relative" }} data-ff-anim="fade-up">
      <style>{"@keyframes af-trustbar-marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}"}</style>
      <div
        style={{
          display: "flex",
          width: "max-content",
          gap: 48,
          alignItems: "center",
          animation: "af-trustbar-marquee 26s linear infinite",
        }}
      >
        {loop.map((label, i) => (
          <span
            key={i}
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "var(--ff-ink)",
              opacity: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 2 : stats inline, sans carte ──────────────────────────────────────
function TrustbarStatsInlineNoCard({ items }: TrustbarPatternProps) {
  return (
    <div
      data-ff-anim="fade-up"
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`,
        gap: 24,
        textAlign: "center",
      }}
    >
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: "var(--ff-accent)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {it.left}
          </span>
          {it.right && (
            <span style={{ fontSize: 13.5, color: "var(--ff-ink)", opacity: 0.7 }}>{it.right}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pattern 3 : bande de citations presse ─────────────────────────────────────
function TrustbarPressQuoteStrip({ items }: TrustbarPatternProps) {
  return (
    <div
      data-ff-anim="fade-up"
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {i > 0 && (
            <span aria-hidden="true" style={{ width: 1, height: 34, background: "color-mix(in srgb, var(--ff-ink) 16%, transparent)" }} />
          )}
          <div style={{ maxWidth: 300 }}>
            {it.right && (
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: "var(--ff-ink)", opacity: 0.82, fontStyle: "italic" }}>
                “{it.right}”
              </p>
            )}
            {it.left && (
              <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700, color: "var(--ff-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {it.left}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export const TRUSTBAR_PATTERNS: Record<string, ComponentType<TrustbarPatternProps>> = {
  "trustbar-logos-marquee": TrustbarLogosMarquee,
  "trustbar-stats-inline-no-card": TrustbarStatsInlineNoCard,
  "trustbar-press-quote-strip": TrustbarPressQuoteStrip,
};
