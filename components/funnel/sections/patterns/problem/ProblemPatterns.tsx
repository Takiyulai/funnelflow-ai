"use client";

// Patterns PROBLÈME / AGITATION (zip Claude Design) → composants React
// color-aware. 3 variantes : problem-split-pain-checklist,
// problem-centered-quote-stat, problem-cards-before-comparison.
// Données = section.bullets ("Douleur | Détail"). Seule catégorie du tunnel à
// utiliser une couleur d'ALERTE (rouge/orange) pour créer un contraste émotionnel
// volontaire — indépendante de --ff-accent. Contenu SEUL : la <section>, le fond,
// le padding et le titre viennent du wrapper de FunnelPreview.

import type { ComponentType, CSSProperties } from "react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { resolveImageUrl } from "@/lib/funnels/resolveMedia";

// Couleur d'alerte volontairement fixe (hors palette), atténuée par color-mix.
const ALERT = "#e5533b";

export type PainItem = { title: string; desc: string };

export type ProblemPatternProps = {
  section: FunnelSection;
  items: PainItem[];
  funnel?: Funnel;
  mode?: "preview" | "public";
};

function CrossIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `color-mix(in srgb, ${ALERT} 16%, transparent)`,
        color: ALERT,
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      ✕
    </span>
  );
}

function PainLine({ item }: { item: PainItem }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <CrossIcon />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ff-ink)", lineHeight: 1.35 }}>
          {item.title}
        </span>
        {item.desc && (
          <span style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ff-ink)", opacity: 0.72 }}>
            {item.desc}
          </span>
        )}
      </div>
    </li>
  );
}

// Panneau décoratif "avant" (désaturé) quand aucune image n'est fournie.
function BeforePanel() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        minHeight: 260,
        background: "color-mix(in srgb, var(--ff-ink) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--ff-ink) 12%, transparent)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 14,
        padding: 28,
        filter: "saturate(0.55)",
      }}
    >
      {[72, 52, 84, 40].map((w, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: `color-mix(in srgb, ${ALERT} 40%, transparent)` }} />
          <span style={{ width: `${w}%`, height: 12, borderRadius: 6, background: "color-mix(in srgb, var(--ff-ink) 16%, transparent)" }} />
        </div>
      ))}
    </div>
  );
}

// ── Pattern 1 : split checklist douleur + visuel "avant" ──────────────────────
function ProblemSplitPainChecklist({ section, items, funnel }: ProblemPatternProps) {
  const imgUrl = resolveImageUrl(section.image, funnel);
  return (
    <div
      className="ff-problem-split"
      data-ff-anim="fade-up"
      style={{ maxWidth: 1040, margin: "36px auto 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, alignItems: "center" }}
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        {items.map((it, i) => (
          <PainLine key={i} item={it} />
        ))}
      </ul>
      <div style={{ position: "relative" }}>
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={section.image?.alt ?? ""}
            style={{ width: "100%", borderRadius: 18, display: "block", filter: "saturate(0.85)" }}
          />
        ) : (
          <BeforePanel />
        )}
      </div>
    </div>
  );
}

// ── Pattern 2 : centré, une statistique choc unique ───────────────────────────
function ProblemCenteredQuoteStat({ section, items }: ProblemPatternProps) {
  const [first, ...rest] = items;
  const stat = first?.title ?? "";
  const agitation = first?.desc || rest.map((r) => r.title).filter(Boolean).join(" ") || section.body || "";
  return (
    <div
      data-ff-anim="fade-up"
      style={{ maxWidth: 720, margin: "32px auto 0", textAlign: "center" }}
    >
      <div
        style={{
          fontSize: "clamp(48px, 8vw, 92px)",
          fontWeight: 800,
          lineHeight: 1,
          color: ALERT,
          letterSpacing: "-0.02em",
        }}
      >
        {stat}
      </div>
      {agitation && (
        <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.6, color: "var(--ff-ink)", opacity: 0.82 }}>
          {agitation}
        </p>
      )}
    </div>
  );
}

// ── Pattern 3 : cartes plates désaturées "avant" (points de friction) ─────────
const flatCard: CSSProperties = {
  background: "color-mix(in srgb, var(--ff-ink) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ff-ink) 12%, transparent)",
  borderRadius: 14,
  padding: "22px 22px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  filter: "saturate(0.7)",
};

function ProblemCardsBeforeComparison({ items }: ProblemPatternProps) {
  return (
    <div
      className="ff-problem-cards"
      data-ff-anim="fade-up"
      style={{ maxWidth: 1000, margin: "36px auto 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
    >
      {items.map((it, i) => (
        <div key={i} style={flatCard}>
          <CrossIcon />
          <span style={{ fontSize: 16.5, fontWeight: 700, color: "var(--ff-ink)", lineHeight: 1.3 }}>
            {it.title}
          </span>
          {it.desc && (
            <span style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ff-ink)", opacity: 0.72 }}>
              {it.desc}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export const PROBLEM_PATTERNS: Record<string, ComponentType<ProblemPatternProps>> = {
  "problem-split-pain-checklist": ProblemSplitPainChecklist,
  "problem-centered-quote-stat": ProblemCenteredQuoteStat,
  "problem-cards-before-comparison": ProblemCardsBeforeComparison,
};
