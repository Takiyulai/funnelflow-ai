"use client";

// Patterns CTA FINAL (zip Claude Design) → composants React color-aware.
// 3 variantes : cta-final-centered-urgency, cta-final-split-recap-benefits,
// cta-final-glow-countdown. Contenu SEUL (wrapper = <section>/fond/padding).

import { useEffect, useState, type ComponentType } from "react";
import type { FunnelSection } from "@/lib/funnels/types";
import { RichText } from "@/components/funnel/RichText";
import { CtaButton } from "@/components/funnel/CtaButton";

export type CtaFinalProps = {
  section: FunnelSection;
  mode?: "preview" | "public";
};

function stripMarkers(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1");
}

function CtaBtn({ section, mode }: CtaFinalProps) {
  if (section.cta) {
    return <CtaButton cta={section.cta} disabled={mode === "preview"} />;
  }
  return (
    <a
      href="#lead-form"
      data-ff-cta
      className="ff-btn"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 26px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}
    >
      Je commence maintenant
    </a>
  );
}

// ── Pattern 1 : centré, urgence ───────────────────────────────────────────────
function CtaFinalCenteredUrgency({ section, mode }: CtaFinalProps) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
      {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} dataAnim="fade-up" />}
      {section.subheadline && (
        <div style={{ marginTop: 14 }}>
          <RichText as="p" className="ff-subheadline" text={section.subheadline} dataAnim="fade-up" />
        </div>
      )}
      <div className="ff-cta-wrap" style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>
        <CtaBtn section={section} mode={mode} />
      </div>
    </div>
  );
}

// ── Pattern 2 : split (titre + CTA / récap bénéfices) ─────────────────────────
function CtaFinalSplitRecapBenefits({ section, mode }: CtaFinalProps) {
  const recap = (Array.isArray(section.bullets) ? section.bullets : [])
    .filter((b) => typeof b === "string" && b.trim())
    .map((b) => stripMarkers(b.indexOf("|") >= 0 ? b.slice(0, b.indexOf("|")) : b).trim());
  return (
    <div
      className="ff-cta-split"
      style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }}
    >
      <div data-ff-anim="fade-up">
        {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} />}
        {section.subheadline && (
          <div style={{ marginTop: 12 }}>
            <RichText as="p" className="ff-subheadline" text={section.subheadline} />
          </div>
        )}
        <div className="ff-cta-wrap" style={{ marginTop: 26 }}>
          <CtaBtn section={section} mode={mode} />
        </div>
      </div>
      {recap.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {recap.map((r, i) => (
            <li key={i} data-ff-anim="fade-up" data-ff-anim-index={i + 1} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 15.5, color: "var(--ff-ink)" }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--ff-accent) 14%, transparent)", color: "var(--ff-accent)", fontSize: 12, fontWeight: 800 }}>✓</span>
              <span style={{ opacity: 0.9 }}>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Pattern 3 : glow + compte à rebours live (offre du jour) ──────────────────
function CountdownBox({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 64 }}>
      <span
        style={{
          fontSize: 34,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ff-ink)",
          background: "color-mix(in srgb, var(--ff-accent) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--ff-accent) 26%, transparent)",
          borderRadius: 12,
          padding: "10px 14px",
          minWidth: 64,
          textAlign: "center",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ff-ink)", opacity: 0.55 }}>{label}</span>
    </div>
  );
}

function Countdown() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const target = new Date();
    target.setHours(24, 0, 0, 0); // prochaine minuit → offre "aujourd'hui"
    const tick = () => setMs(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = ms == null ? "--" : pad(Math.floor(ms / 3600000));
  const m = ms == null ? "--" : pad(Math.floor((ms / 60000) % 60));
  const s = ms == null ? "--" : pad(Math.floor((ms / 1000) % 60));
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "24px 0" }}>
      <CountdownBox value={h} label="Heures" />
      <CountdownBox value={m} label="Minutes" />
      <CountdownBox value={s} label="Secondes" />
    </div>
  );
}

function CtaFinalGlowCountdown({ section, mode }: CtaFinalProps) {
  return (
    <div
      className="ff-cta-glow"
      data-ff-anim="fade-up"
      style={{
        maxWidth: 680,
        margin: "0 auto",
        textAlign: "center",
        position: "relative",
        background: "color-mix(in srgb, var(--ff-accent) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--ff-accent) 24%, transparent)",
        borderRadius: 22,
        padding: "44px 32px",
        boxShadow: "0 30px 70px -20px color-mix(in srgb, var(--ff-accent) 40%, transparent)",
      }}
    >
      {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} />}
      <Countdown />
      <div className="ff-cta-wrap" style={{ display: "flex", justifyContent: "center" }}>
        <CtaBtn section={section} mode={mode} />
      </div>
      {section.body && (
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--ff-ink)", opacity: 0.6 }}>
          {stripMarkers(section.body)}
        </p>
      )}
    </div>
  );
}

export const CTA_FINAL_PATTERNS: Record<string, ComponentType<CtaFinalProps>> = {
  "cta-final-centered-urgency": CtaFinalCenteredUrgency,
  "cta-final-split-recap-benefits": CtaFinalSplitRecapBenefits,
  "cta-final-glow-countdown": CtaFinalGlowCountdown,
};
