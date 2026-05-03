"use client";

import { useState, useMemo } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";

type PreviewMode = "desktop" | "mobile";

interface FunnelPreviewProps {
  funnel: Funnel;
  defaultMode?: PreviewMode;
  forcedMode?: PreviewMode;
  showToolbar?: boolean;
  viewportHeight?: number | string;
  logoSrc?: string;
  className?: string;
}

export function FunnelPreview({
  funnel,
  defaultMode = "desktop",
  forcedMode,
  showToolbar = true,
  viewportHeight = 720,
  logoSrc,
  className = ""
}: FunnelPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(forcedMode ?? defaultMode);
  const activeMode = forcedMode ?? mode;

  const visibleSections = useMemo(
    () => funnel.sections.filter((s) => s.visible !== false),
    [funnel.sections]
  );

  const heroSection = visibleSections.find((s) => s.type === "hero");
  const otherSections = visibleSections.filter((s) => s.type !== "hero");

  return (
    <div
      className={`rounded-2xl border border-line bg-white shadow-sm overflow-hidden transition-shadow ${className}`}
    >
      {showToolbar && !forcedMode && (
        <PreviewToolbar mode={activeMode} onChange={setMode} />
      )}

      <div
        className="bg-[#F4F5F8] flex items-start justify-center overflow-y-auto"
        style={{ height: viewportHeight }}
      >
        {activeMode === "desktop" ? (
          <DesktopFrame
            funnel={funnel}
            heroSection={heroSection}
            otherSections={otherSections}
            logoSrc={logoSrc}
          />
        ) : (
          <MobileFrame
            funnel={funnel}
            heroSection={heroSection}
            otherSections={otherSections}
            logoSrc={logoSrc}
          />
        )}
      </div>
    </div>
  );
}

function PreviewToolbar({
  mode,
  onChange
}: {
  mode: PreviewMode;
  onChange: (m: PreviewMode) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-line">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[11px] uppercase tracking-[0.18em] text-muted font-semibold">
          Aperçu {mode === "desktop" ? "desktop" : "mobile"}
        </span>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F5F8] border border-line">
        <button
          type="button"
          aria-label="Aperçu desktop"
          onClick={() => onChange("desktop")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === "desktop"
              ? "bg-[#08498D] text-white shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          <Monitor className="h-3.5 w-3.5" />
          Desktop
        </button>
        <button
          type="button"
          aria-label="Aperçu mobile"
          onClick={() => onChange("mobile")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === "mobile"
              ? "bg-[#08498D] text-white shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Mobile
        </button>
      </div>
    </div>
  );
}

function DesktopFrame({
  funnel,
  heroSection,
  otherSections,
  logoSrc
}: {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
}) {
  return (
    <div className="w-full p-5 animate-[ffFade_0.25s_ease-out]">
      <div className="mx-auto max-w-[1100px] bg-white rounded-xl border border-line shadow-sm overflow-hidden">
        <PreviewBody
          funnel={funnel}
          heroSection={heroSection}
          otherSections={otherSections}
          logoSrc={logoSrc}
          compact={false}
        />
      </div>
    </div>
  );
}

function MobileFrame({
  funnel,
  heroSection,
  otherSections,
  logoSrc
}: {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
}) {
  return (
    <div className="py-6 animate-[ffFade_0.25s_ease-out]">
      <div className="w-[380px] bg-black rounded-[36px] p-3 shadow-xl">
        <div className="bg-white rounded-[28px] overflow-hidden">
          <div className="h-6 bg-black flex items-center justify-center">
            <span className="h-1 w-12 rounded-full bg-white/30" />
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            <PreviewBody
              funnel={funnel}
              heroSection={heroSection}
              otherSections={otherSections}
              logoSrc={logoSrc}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  funnel,
  heroSection,
  otherSections,
  logoSrc,
  compact
}: {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
  compact: boolean;
}) {
  const padX = compact ? "px-5" : "px-10";
  const padY = compact ? "py-6" : "py-10";
  const titleSize = compact ? "text-[26px] leading-[1.15]" : "text-4xl leading-tight";
  const bodySize = compact ? "text-sm" : "text-base";
  const accent = funnel.design?.secondaryColor ?? "#C7A436";
  const dark = funnel.design?.primaryColor ?? "#080E1A";

  return (
    <div className="bg-white">
      {heroSection && (
        <section className={`${padX} ${padY} text-white`} style={{ background: dark }}>
          <div className="flex items-center gap-2 mb-4">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm"
                style={{ background: accent, color: dark }}
              >
                FF
              </div>
            )}
            <span className="font-semibold">{funnel.funnelName || "FunnelFlow AI"}</span>
          </div>

          {heroSection.eyebrow && (
            <span
              className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4"
              style={{ background: `${accent}26`, color: accent }}
            >
              {heroSection.eyebrow}
            </span>
          )}

          {heroSection.headline && (
            <h1 className={`font-black text-white ${titleSize} mb-4`}>
              {heroSection.headline}
            </h1>
          )}

          {heroSection.subheadline && (
            <p className={`text-white/80 ${bodySize} mb-5`}>
              {heroSection.subheadline}
            </p>
          )}

          {heroSection.cta?.label && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition"
              style={{ background: accent, color: dark }}
            >
              {heroSection.cta.label}
            </button>
          )}
        </section>
      )}

      {otherSections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          padX={padX}
          padY={padY}
          bodySize={bodySize}
          compact={compact}
          accent={accent}
          dark={dark}
        />
      ))}
    </div>
  );
}

function SectionBlock({
  section,
  padX,
  padY,
  bodySize,
  compact,
  accent,
  dark
}: {
  section: FunnelSection;
  padX: string;
  padY: string;
  bodySize: string;
  compact: boolean;
  accent: string;
  dark: string;
}) {
  const titleSize = compact ? "text-xl" : "text-2xl";
  const isForm = section.type === "form";

  return (
    <section className={`${padX} ${padY} border-t border-line`}>
      {section.eyebrow && (
        <span className="inline-block px-2.5 py-1 rounded-full bg-[#08498D]/10 text-[#08498D] text-[10px] font-bold uppercase tracking-wider mb-3">
          {section.eyebrow}
        </span>
      )}

      {section.headline && (
        <h2 className={`font-black text-ink ${titleSize} mb-3`}>
          {section.headline}
        </h2>
      )}

      {section.subheadline && (
        <p className={`text-muted ${bodySize} mb-4`}>{section.subheadline}</p>
      )}

      {section.body && (
        <p className={`text-ink/80 ${bodySize} mb-4 whitespace-pre-line`}>
          {section.body}
        </p>
      )}

      {Array.isArray(section.bullets) && section.bullets.length > 0 && (
        <ul className="space-y-2 mb-4">
          {section.bullets.map((bullet, i) => (
            <li key={i} className={`flex gap-2 text-ink/85 ${bodySize}`}>
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: "#31845C" }}
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {isForm && (
        <form
          id="lead-form"
          onSubmit={(e) => e.preventDefault()}
          className="space-y-3 mt-4 max-w-md"
        >
          <input
            type="text"
            placeholder="Votre prénom"
            className="w-full px-3 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D] transition-colors"
          />
          <input
            type="email"
            placeholder="Votre email"
            className="w-full px-3 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D] transition-colors"
          />
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition"
            style={{ background: accent, color: dark }}
          >
            {section.cta?.label || "Envoyer"}
          </button>
        </form>
      )}

      {!isForm && section.cta?.label && (
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition mt-2"
          style={{ background: dark }}
        >
          {section.cta.label}
        </button>
      )}
    </section>
  );
}
