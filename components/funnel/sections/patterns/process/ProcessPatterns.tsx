"use client";

// Patterns FONCTIONNEMENT / ÉTAPES (zip Claude Design) → composants React
// color-aware. 4 variantes : process-grid-numbered-rich,
// process-timeline-vertical-circles, process-faq-numbered-hybrid,
// process-horizontal-steps-arrow.
// Données = section.bullets ("Étape | Description"). Contenu SEUL : la <section>,
// le fond, le padding et le titre viennent du wrapper de FunnelPreview.

import type { ComponentType, CSSProperties } from "react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";

export type StepItem = { title: string; desc: string };

export type ProcessPatternProps = {
  section: FunnelSection;
  items: StepItem[];
  funnel?: Funnel;
  mode?: "preview" | "public";
};

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ff-ink)", lineHeight: 1.25 }}>
      {children}
    </h3>
  );
}

function StepDesc({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ff-ink)", opacity: 0.78 }}>
      {children}
    </p>
  );
}

function Pastille({ children, size = 46 }: { children: React.ReactNode; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--ff-accent) 14%, transparent)",
        color: "var(--ff-accent)",
        fontWeight: 800,
        fontSize: size >= 46 ? 18 : 15,
      }}
    >
      {children}
    </span>
  );
}

// ── Pattern 1 : grille 2x2, numéro géant en filigrane ─────────────────────────
function ProcessGridNumberedRich({ items }: ProcessPatternProps) {
  return (
    <div
      className="ff-process-grid2"
      style={{ maxWidth: 1000, margin: "40px auto 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "36px 40px" }}
    >
      {items.map((it, i) => (
        <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ position: "relative", paddingLeft: 8, overflow: "hidden" }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -18,
              left: -6,
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1,
              color: "var(--ff-accent)",
              opacity: 0.1,
              pointerEvents: "none",
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, paddingTop: 18 }}>
            <StepTitle>{it.title}</StepTitle>
            <StepDesc>{it.desc}</StepDesc>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pattern 2 : timeline verticale, ligne connectrice + pastilles ─────────────
function ProcessTimelineVerticalCircles({ items }: ProcessPatternProps) {
  return (
    <div
      className="ff-process-timeline"
      style={{ maxWidth: 720, margin: "40px auto 0", display: "flex", flexDirection: "column" }}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={{ display: "grid", gridTemplateColumns: "46px 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Pastille>{i + 1}</Pastille>
              {!last && (
                <span
                  aria-hidden="true"
                  style={{ flex: 1, width: 2, minHeight: 28, background: "color-mix(in srgb, var(--ff-accent) 26%, transparent)", marginTop: 6 }}
                />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: last ? 0 : 30 }}>
              <StepTitle>{it.title}</StepTitle>
              <StepDesc>{it.desc}</StepDesc>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Pattern 3 : Q/R numérotées, hybride process + FAQ ─────────────────────────
const qaCard: CSSProperties = {
  background: "var(--ff-card-bg, #fff)",
  border: "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))",
  borderRadius: 14,
  padding: "20px 22px",
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
};

function ProcessFaqNumberedHybrid({ items }: ProcessPatternProps) {
  return (
    <div
      className="ff-process-qa"
      style={{ maxWidth: 760, margin: "40px auto 0", display: "flex", flexDirection: "column", gap: 16 }}
    >
      {items.map((it, i) => (
        <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={qaCard}>
          <Pastille size={38}>{i + 1}</Pastille>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <StepTitle>{it.title}</StepTitle>
            <StepDesc>{it.desc}</StepDesc>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pattern 4 : étapes horizontales reliées par des flèches ───────────────────
function ProcessHorizontalStepsArrow({ items }: ProcessPatternProps) {
  return (
    <div
      className="ff-process-steps"
      style={{ maxWidth: 1100, margin: "44px auto 0", display: "flex", alignItems: "stretch", gap: 8 }}
    >
      {items.map((it, i) => (
        <div key={i} style={{ display: "contents" }}>
          <div data-ff-anim="fade-up" data-ff-anim-index={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center", padding: "0 8px" }}>
            <Pastille>{i + 1}</Pastille>
            <StepTitle>{it.title}</StepTitle>
            <StepDesc>{it.desc}</StepDesc>
          </div>
          {i < items.length - 1 && (
            <div
              aria-hidden="true"
              style={{ display: "flex", alignItems: "center", color: "var(--ff-accent)", fontSize: 24, opacity: 0.7 }}
            >
              →
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export const PROCESS_PATTERNS: Record<string, ComponentType<ProcessPatternProps>> = {
  "process-grid-numbered-rich": ProcessGridNumberedRich,
  "process-timeline-vertical-circles": ProcessTimelineVerticalCircles,
  "process-faq-numbered-hybrid": ProcessFaqNumberedHybrid,
  "process-horizontal-steps-arrow": ProcessHorizontalStepsArrow,
};
