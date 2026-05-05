"use client";

import { useState, useMemo } from "react";
import { Monitor, Smartphone, ExternalLink } from "lucide-react";
import type {
  AnimationPreset,
  Funnel,
  FunnelSection,
  SectionAnimations,
} from "@/lib/funnels/types";
import { ctaHref, ctaTarget, ctaRel, ctaIsExternal } from "@/lib/funnels/cta";
import { getVideoEmbed } from "@/lib/funnels/video";
import { useScrollReveal } from "@/hooks/useScrollReveal";

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

// Helper : lit un preset d'animation pour une cible donnée, avec fallback fade-up.
function animOf(
  animations: SectionAnimations | undefined,
  target: keyof SectionAnimations,
  fallback: AnimationPreset = "fade-up"
): AnimationPreset {
  return animations?.[target] ?? fallback;
}

export function FunnelPreview({
  funnel,
  defaultMode = "desktop",
  forcedMode,
  showToolbar = true,
  viewportHeight = 720,
  logoSrc,
  className = "",
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
  onChange,
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
  logoSrc,
}: {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
}) {
  // Le containerRef enveloppe la zone scrollable : useScrollReveal observe
  // tous les [data-ff-anim] et déclenche les animations à l'apparition.
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={containerRef} className="w-full p-5 animate-[ffFade_0.25s_ease-out]">
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
  logoSrc,
}: {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
}) {
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div className="py-6 animate-[ffFade_0.25s_ease-out]">
      <div className="w-[380px] bg-black rounded-[36px] p-3 shadow-xl">
        <div className="bg-white rounded-[28px] overflow-hidden">
          <div className="h-6 bg-black flex items-center justify-center">
            <span className="h-1 w-12 rounded-full bg-white/30" />
          </div>
          <div ref={containerRef} className="max-h-[640px] overflow-y-auto">
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
  compact,
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
        <section
          id={heroSection.id || "hero"}
          data-ff-section="hero"
          data-ff-layout={heroSection.layoutVariant ?? "centered"}
          className={`${padX} ${padY} text-white`}
          style={{ background: dark }}
        >
          <div
            data-ff-anim="fade-in"
            className="flex items-center gap-2 mb-4"
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="h-8 w-8 rounded-lg object-contain bg-white/10 p-0.5"
              />
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
              data-ff-anim={animOf(heroSection.animations, "eyebrow", "fade-in")}
              className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4"
              style={{ background: `${accent}26`, color: accent }}
            >
              {heroSection.eyebrow}
            </span>
          )}

          {heroSection.headline && (
            <h1
              data-ff-anim={animOf(heroSection.animations, "headline", "fade-up")}
              className={`font-black text-white ${titleSize} mb-4`}
            >
              {heroSection.headline}
            </h1>
          )}

          {heroSection.subheadline && (
            <p
              data-ff-anim={animOf(heroSection.animations, "subheadline", "fade-up")}
              className={`text-white/80 ${bodySize} mb-5`}
            >
              {heroSection.subheadline}
            </p>
          )}

          {heroSection.image?.mode === "upload" && heroSection.image?.url && (
            <figure
              data-ff-anim={animOf(heroSection.animations, "image", "fade-in")}
              className="mt-4 mb-5 overflow-hidden rounded-xl border border-white/10"
            >
              <img
                src={heroSection.image.url}
                alt={heroSection.image.alt ?? ""}
                className="w-full h-auto block"
                loading="lazy"
              />
            </figure>
          )}

          {heroSection.video?.url && (
            <VideoEmbedBlock
              url={heroSection.video.url}
              compact={compact}
              anim={animOf(heroSection.animations, "video", "zoom-in")}
            />
          )}

          {heroSection.cta?.label && (
            <CtaLink
              cta={heroSection.cta}
              bg={accent}
              fg={dark}
              className="text-sm"
              anim={animOf(heroSection.animations, "cta", "fade-up")}
            />
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
  dark,
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
  const hasUploadedImage = section.image?.mode === "upload" && section.image?.url;

  return (
    <section
      id={section.id}
      data-ff-section={section.type}
      data-ff-layout={section.layoutVariant ?? "centered"}
      className={`${padX} ${padY} border-t border-line`}
    >
      {section.eyebrow && (
        <span
          data-ff-anim={animOf(section.animations, "eyebrow", "fade-in")}
          className="inline-block px-2.5 py-1 rounded-full bg-[#08498D]/10 text-[#08498D] text-[10px] font-bold uppercase tracking-wider mb-3"
        >
          {section.eyebrow}
        </span>
      )}

      {section.headline && (
        <h2
          data-ff-anim={animOf(section.animations, "headline", "fade-up")}
          className={`font-black text-ink ${titleSize} mb-3`}
        >
          {section.headline}
        </h2>
      )}

      {section.subheadline && (
        <p
          data-ff-anim={animOf(section.animations, "subheadline", "fade-up")}
          className={`text-muted ${bodySize} mb-4`}
        >
          {section.subheadline}
        </p>
      )}

      {section.body && (
        <p
          data-ff-anim={animOf(section.animations, "body", "fade-up")}
          className={`text-ink/80 ${bodySize} mb-4 whitespace-pre-line`}
        >
          {section.body}
        </p>
      )}

      {Array.isArray(section.bullets) && section.bullets.length > 0 && (
        <ul
          data-ff-bullets="stagger"
          className="space-y-2 mb-4"
        >
          {section.bullets.map((bullet, i) => (
            <li
              key={i}
              data-ff-anim={animOf(section.animations, "bullets", "fade-up")}
              className={`flex gap-2 text-ink/85 ${bodySize}`}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: "#31845C" }}
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {section.video?.url && (
        <VideoEmbedBlock
          url={section.video.url}
          compact={compact}
          anim={animOf(section.animations, "video", "zoom-in")}
        />
      )}

      {hasUploadedImage && (
        <figure
          data-ff-anim={animOf(section.animations, "image", "fade-in")}
          className="mt-4 mb-2 overflow-hidden rounded-lg border border-line"
        >
          <img
            src={section.image!.url!}
            alt={section.image!.alt ?? ""}
            className="w-full h-auto block"
            loading="lazy"
          />
        </figure>
      )}

      {isForm && (
        <form
          id="lead-form"
          onSubmit={(e) => e.preventDefault()}
          data-ff-anim={animOf(section.animations, "cta", "fade-up")}
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
        <CtaLink
          cta={section.cta}
          bg={dark}
          fg="#FFFFFF"
          className="text-sm mt-2"
          anim={animOf(section.animations, "cta", "fade-up")}
        />
      )}
    </section>
  );
}

// Bloc vidéo embed sécurisé (YouTube / Vimeo / iframe HTTPS générique)
function VideoEmbedBlock({
  url,
  compact,
  anim,
}: {
  url: string;
  compact: boolean;
  anim?: AnimationPreset;
}) {
  const embed = getVideoEmbed(url);
  if (!embed.embedUrl) {
    return null;
  }
  return (
    <div
      data-ff-anim={anim ?? "zoom-in"}
      className={`overflow-hidden rounded-lg border border-line/40 ${
        compact ? "my-3" : "my-5"
      }`}
    >
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={embed.embedUrl}
          title="Vidéo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

// Lien CTA réel avec href / target / rel via les helpers partagés
function CtaLink({
  cta,
  bg,
  fg,
  className = "",
  anim,
}: {
  cta: NonNullable<FunnelSection["cta"]>;
  bg: string;
  fg: string;
  className?: string;
  anim?: AnimationPreset;
}) {
  const href = ctaHref(cta);
  const target = ctaTarget(cta);
  const rel = ctaRel(cta);
  const external = ctaIsExternal(cta);

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      data-ff-anim={anim ?? "fade-up"}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-md hover:opacity-90 transition no-underline ${className}`}
      style={{ background: bg, color: fg }}
    >
      {cta.label}
      {external && <ExternalLink size={13} />}
    </a>
  );
}
