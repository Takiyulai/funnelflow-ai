"use client";

// Patterns FAQ (zip Claude Design) → composants React color-aware.
// 4 variantes : faq-accordion, faq-sandwich-double-cta, faq-hub-grid-links,
// faq-grid-intro. Accordéons fonctionnels (useState). Couleurs de démo (violet)
// remplacées par les variables du tunnel (--ff-accent, --ff-ink, --ff-bg, --ff-card-*).

import { useState, type ComponentType } from "react";
import type { Funnel, FunnelSection, FaqItem } from "@/lib/funnels/types";
import { CtaButton } from "@/components/funnel/CtaButton";
import { RichText } from "@/components/funnel/RichText";

export type FaqPatternProps = {
  section: FunnelSection;
  faqs: FaqItem[];
  funnel?: Funnel;
  mode?: "preview" | "public";
};

function useOpenSet() {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  return { open, toggle };
}

function FaqCard({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--ff-card-bg, #fff)",
        border: "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 22px",
          textAlign: "left",
          fontWeight: 600,
          fontSize: 16,
          color: "var(--ff-ink)",
          fontFamily: "inherit",
        }}
      >
        <span style={{ flex: 1 }}>{q}</span>
        <span
          aria-hidden="true"
          style={{
            transition: "transform .25s",
            transform: isOpen ? "rotate(180deg)" : "none",
            color: "var(--ff-accent)",
            fontSize: 13,
          }}
        >
          ▼
        </span>
      </button>
      <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s ease" }}>
        <div style={{ overflow: "hidden" }}>
          <p
            style={{
              margin: 0,
              padding: "0 22px 18px",
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ff-ink)",
              opacity: 0.8,
              whiteSpace: "pre-line",
              textAlign: "left",
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

// La <section>, le fond et le padding viennent du wrapper de FunnelPreview
// (qui porte déjà data-ff-section="faq" + data-ff-pattern). On rend UNIQUEMENT le
// contenu, pour ne pas imbriquer deux <section> ni doubler fond/padding.
function SectionShell({
  maxWidth = 720,
  children,
}: {
  pattern?: string;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  return <div style={{ maxWidth, margin: "0 auto" }}>{children}</div>;
}

// ── Pattern 1 : accordéon centré ──────────────────────────────────────────────
function FaqAccordion({ section, faqs }: FaqPatternProps) {
  const { open, toggle } = useOpenSet();
  return (
    <SectionShell pattern="faq-accordion">
      {section.headline && (
        <div style={{ textAlign: "center" }} data-ff-anim="fade-up">
          <RichText as="h2" className="ff-headline" text={section.headline} />
        </div>
      )}
      <div data-ff-anim="fade-up" style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 12 }}>
        {faqs.map((f, i) => (
          <FaqCard key={i} q={f.question} a={f.answer} isOpen={open.has(i)} onToggle={() => toggle(i)} />
        ))}
      </div>
    </SectionShell>
  );
}

// ── Pattern 2 : sandwich double CTA ───────────────────────────────────────────
function FaqSandwichDoubleCta({ section, faqs, mode }: FaqPatternProps) {
  const { open, toggle } = useOpenSet();
  const mid = Math.ceil(faqs.length / 2);
  const first = faqs.slice(0, mid);
  const second = faqs.slice(mid);
  return (
    <SectionShell pattern="faq-sandwich-double-cta">
      {section.headline && (
        <div style={{ textAlign: "center" }} data-ff-anim="fade-up">
          <RichText as="h2" className="ff-headline" text={section.headline} />
        </div>
      )}
      <div data-ff-anim="fade-up" style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 12 }}>
        {first.map((f, i) => (
          <FaqCard key={i} q={f.question} a={f.answer} isOpen={open.has(i)} onToggle={() => toggle(i)} />
        ))}
      </div>
      {second.length > 0 && (
        <div data-ff-anim="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {second.map((f, i) => (
            <FaqCard key={i} q={f.question} a={f.answer} isOpen={open.has(mid + i)} onToggle={() => toggle(mid + i)} />
          ))}
        </div>
      )}
      {/* 🆕 CTA de bas de FAQ retiré (redondant avec le CTA de la section suivante). */}
    </SectionShell>
  );
}

// ── Pattern 3 : hub grille + liens ────────────────────────────────────────────
function FaqHubGridLinks({ section, faqs, mode }: FaqPatternProps) {
  const { open, toggle } = useOpenSet();
  return (
    <SectionShell pattern="faq-hub-grid-links" maxWidth={980}>
      {section.headline && (
        <div data-ff-anim="fade-up">
          <RichText as="h2" className="ff-headline" text={section.headline} />
        </div>
      )}
      {section.subheadline && (
        <div data-ff-anim="fade-up" style={{ marginTop: 10 }}>
          <RichText as="p" className="ff-subheadline" text={section.subheadline} />
        </div>
      )}
      <div className="ff-faq-grid" data-ff-anim="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 34, alignItems: "start" }}>
        {faqs.map((f, i) => (
          <FaqCard key={i} q={f.question} a={f.answer} isOpen={open.has(i)} onToggle={() => toggle(i)} />
        ))}
      </div>
      {section.cta && (
        <div className="ff-cta-wrap" data-ff-anim="fade-up" style={{ marginTop: 26, display: "flex", justifyContent: "flex-start" }}>
          <CtaButton cta={section.cta} disabled={mode === "preview"} />
        </div>
      )}
    </SectionShell>
  );
}

// ── Pattern 4 : intro + grille + bloc « pas trouvé » ─────────────────────────
function FaqGridIntro({ section, faqs, mode }: FaqPatternProps) {
  const { open, toggle } = useOpenSet();
  return (
    <SectionShell pattern="faq-grid-intro" maxWidth={980}>
      <div data-ff-anim="fade-up" style={{ maxWidth: 600 }}>
        {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} />}
        {section.subheadline && (
          <div style={{ marginTop: 12 }}>
            <RichText as="p" className="ff-subheadline" text={section.subheadline} />
          </div>
        )}
      </div>
      <div className="ff-faq-grid" data-ff-anim="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 32, alignItems: "start" }}>
        {faqs.map((f, i) => (
          <FaqCard key={i} q={f.question} a={f.answer} isOpen={open.has(i)} onToggle={() => toggle(i)} />
        ))}
      </div>
      {section.cta && (
        <div
          data-ff-anim="fade-up"
          style={{
            marginTop: 32,
            background: "color-mix(in srgb, var(--ff-accent) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ff-accent) 26%, transparent)",
            borderRadius: 16,
            padding: "22px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 17 }}>Pas trouvé ta réponse ?</div>
          <CtaButton cta={section.cta} disabled={mode === "preview"} />
        </div>
      )}
    </SectionShell>
  );
}

export const FAQ_PATTERNS: Record<string, ComponentType<FaqPatternProps>> = {
  "faq-accordion": FaqAccordion,
  "faq-sandwich-double-cta": FaqSandwichDoubleCta,
  "faq-hub-grid-links": FaqHubGridLinks,
  "faq-grid-intro": FaqGridIntro,
};
