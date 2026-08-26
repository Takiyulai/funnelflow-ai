"use client";

// Patterns STATS (zip Claude Design) → composants React color-aware.
// 3 variantes : stats-cards-4-suffix-badge, stats-cards-4-percent-icons,
// stats-bar-horizontal-no-card.
// Données = section.bullets ("Chiffre | Label", ex "12K+ | Clients servis").
// Couleurs de démo → variables du tunnel (--ff-accent, --ff-ink, --ff-card-bg,
// --ff-card-border). Contenu SEUL : la <section>, le fond et le padding viennent
// du wrapper de FunnelPreview (data-ff-section + data-ff-pattern).

import type { ComponentType, CSSProperties } from "react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { RichText } from "@/components/funnel/RichText";

export type StatItem = { value: string; label: string };

export type StatsPatternProps = {
  section: FunnelSection;
  items: StatItem[];
  funnel?: Funnel;
  mode?: "preview" | "public";
};

function Header({ section, center }: { section: FunnelSection; center?: boolean }) {
  if (!section.eyebrow && !section.headline && !section.subheadline) return null;
  return (
    <div
      data-ff-anim="fade-up"
      style={{ textAlign: center ? "center" : "left", maxWidth: center ? 640 : 620, margin: center ? "0 auto" : undefined }}
    >
      {section.eyebrow && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "color-mix(in srgb, var(--ff-accent) 12%, transparent)",
            color: "var(--ff-accent)",
            marginBottom: 16,
          }}
        >
          {section.eyebrow}
        </span>
      )}
      {section.headline && (
        <RichText as="h2" className="ff-headline" text={section.headline} />
      )}
      {section.subheadline && (
        <div style={{ marginTop: 12 }}>
          <RichText as="p" className="ff-subheadline" text={section.subheadline} />
        </div>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--ff-card-bg, #fff)",
  border: "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))",
  borderRadius: 16,
  padding: "28px 24px",
  boxShadow: "0 10px 30px rgba(0,0,0,.08)",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "center",
};

function StatValue({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, color: "var(--ff-accent)", fontVariantNumeric: "tabular-nums" }}>
      {children}
    </span>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <span style={{ fontSize: 14.5, lineHeight: 1.4, color: "var(--ff-ink)", opacity: 0.78 }}>
      {children}
    </span>
  );
}

// ── Pattern 1 : 4 cartes ombrées, badge d'intro, chiffres à suffixe ───────────
function StatsCards4SuffixBadge({ section, items }: StatsPatternProps) {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Header section={section} center />
      <div
        className="ff-stats-grid2"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 40 }}
      >
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={cardStyle}>
            <StatValue>{it.value}</StatValue>
            <StatLabel>{it.label}</StatLabel>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 2 : 4 cartes ombrées, orienté "impact" (icône + %) ────────────────
function StatsCards4PercentIcons({ section, items }: StatsPatternProps) {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Header section={section} center />
      <div
        className="ff-stats-grid2"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 40 }}
      >
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={cardStyle}>
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
                fontSize: 20,
                marginBottom: 4,
              }}
            >
              ★
            </span>
            <StatValue>{it.value}</StatValue>
            <StatLabel>{it.label}</StatLabel>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 3 : bande horizontale sans carte + bloc narratif (valeurs) ────────
function StatsBarHorizontalNoCard({ section, items }: StatsPatternProps) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div
        className="ff-stats-bar"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`,
          gap: 24,
          textAlign: "center",
          paddingBottom: section.headline || section.body ? 40 : 0,
          borderBottom:
            section.headline || section.body
              ? "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))"
              : undefined,
        }}
      >
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <StatValue>{it.value}</StatValue>
            <StatLabel>{it.label}</StatLabel>
          </div>
        ))}
      </div>
      {(section.headline || section.body) && (
        <div
          data-ff-anim="fade-up"
          style={{ maxWidth: 720, margin: "40px auto 0", textAlign: "center" }}
        >
          {section.headline && (
            <RichText as="h2" className="ff-headline" text={section.headline} />
          )}
          {section.body && (
            <div style={{ marginTop: 14 }}>
              <RichText as="p" className="ff-subheadline" text={section.body} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const STATS_PATTERNS: Record<string, ComponentType<StatsPatternProps>> = {
  "stats-cards-4-suffix-badge": StatsCards4SuffixBadge,
  "stats-cards-4-percent-icons": StatsCards4PercentIcons,
  "stats-bar-horizontal-no-card": StatsBarHorizontalNoCard,
};
