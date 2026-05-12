"use client";

import { useState, useMemo } from "react";
import { Monitor, Smartphone, ExternalLink } from "lucide-react";
import type {
  AnimationPreset,
  DecorativeIcon,
  Funnel,
  FunnelSection,
  SectionAnimations,
  SectionColors,
} from "@/lib/funnels/types";
import { ctaHref, ctaTarget, ctaRel, ctaIsExternal } from "@/lib/funnels/cta";
import { getVideoEmbed } from "@/lib/funnels/video";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { TemplateThemeProvider } from "@/components/funnel/TemplateThemeProvider";
import { getTemplateButtonAnim } from "@/lib/funnels/templates";
import FunnelFooter from "@/components/funnel/FunnelFooter";
import FunnelHeader from "@/components/funnel/FunnelHeader";
import { getIconByName } from "@/components/editor/IconPicker";
import { FaqRenderer } from "@/components/funnel/sections/FaqRenderer";
import { TestimonialsRenderer } from "@/components/funnel/sections/TestimonialsRenderer";
import { PricingRenderer } from "@/components/funnel/sections/PricingRenderer";
import { BonusRenderer } from "@/components/funnel/sections/BonusRenderer";
import { GuaranteeRenderer } from "@/components/funnel/sections/GuaranteeRenderer";
import { FormRenderer } from "@/components/funnel/sections/FormRenderer";
import {
  DecorativeIconsLayer,
  InlineDecorativeIcon,
} from "@/components/funnel/DecorativeIconsLayer";

type PreviewMode = "desktop" | "mobile";
type ForcedMode = PreviewMode | "raw";
type ShadowSize = "none" | "sm" | "md" | "lg" | "xl";

interface FunnelPreviewProps {
  funnel: Funnel;
  defaultMode?: PreviewMode;
  forcedMode?: ForcedMode;
  showToolbar?: boolean;
  viewportHeight?: number | string;
  desktopWidth?: number;
  logoSrc?: string;
  className?: string;
}

function animOf(
  animations: SectionAnimations | undefined,
  target: keyof SectionAnimations,
  fallback: AnimationPreset = "fade-up",
): AnimationPreset {
  return animations?.[target] ?? fallback;
}

function getSectionColors(section: FunnelSection): SectionColors {
  const style = (section.style ?? {}) as {
    colors?: SectionColors;
    userColorsOverride?: boolean;
  };
  const colors: SectionColors = style.colors ?? {};
  if (style.userColorsOverride) return colors;

  const hasExplicitBg =
    typeof colors.bg === "string" && colors.bg.trim().length > 0;
  if (hasExplicitBg) return colors;

  if (process.env.NODE_ENV === "development" && colors.bg) {
    // eslint-disable-next-line no-console
    console.debug(
      `[FunnelPreview] section "${section.id}" (${section.type}): bg "${colors.bg}" ignoré (pas d'override utilisateur)`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bg: _ignored, ...rest } = colors;
  return rest;
}

function readShadow(section: FunnelSection): {
  size: ShadowSize;
  color: string;
} {
  const shadow = ((section.style ?? {}) as Record<string, unknown>).shadow as
    | { size?: ShadowSize; color?: string }
    | undefined;
  return {
    size: shadow?.size ?? "none",
    color: shadow?.color ?? "#000000",
  };
}

function shadowStyleVar(color: string): React.CSSProperties {
  return { ["--ff-shadow-color" as string]: color } as React.CSSProperties;
}

/** Construit le style background pour une section (image de fond + overlay) */
function buildBackgroundStyle(section: FunnelSection): {
  containerStyle: React.CSSProperties;
  hasBackgroundImage: boolean;
  overlay: number;
} {
  const bg = section.background;
  if (!bg?.imageUrl) {
    return { containerStyle: {}, hasBackgroundImage: false, overlay: 0 };
  }
  return {
    containerStyle: {
      backgroundImage: `url(${bg.imageUrl})`,
      backgroundSize: bg.size ?? "cover",
      backgroundPosition: bg.position ?? "center",
      backgroundRepeat: "no-repeat",
    },
    hasBackgroundImage: true,
    overlay: bg.overlay ?? 0,
  };
}

function usesSpecializedRenderer(section: FunnelSection): boolean {
  if (!Array.isArray(section.items) || section.items.length === 0) return false;
  const t = section.type as string;
  return (
    t === "faq" ||
    t === "testimonials" ||
    t === "proof" ||
    t === "pricing" ||
    t === "offer" ||
    t === "bonus" ||
    t === "guarantee"
  );
}

/**
 * Détecte si la section comporte au moins une icône décorative en bord haut/bas,
 * afin d'ajouter un padding supplémentaire (via attributs data-ff-deco-top/bottom).
 */
function hasDecorativeAtEdge(
  icons: DecorativeIcon[] | undefined,
): { top: boolean; bottom: boolean } {
  if (!Array.isArray(icons) || icons.length === 0) {
    return { top: false, bottom: false };
  }
  let top = false;
  let bottom = false;
  for (const it of icons) {
    const p = it.position;
    if (p === "top-left" || p === "top-right" || p === "top-center") top = true;
    if (p === "bottom-left" || p === "bottom-right" || p === "bottom-center")
      bottom = true;
    if (top && bottom) break;
  }
  return { top, bottom };
}

export function FunnelPreview({
  funnel,
  defaultMode = "desktop",
  forcedMode,
  showToolbar = true,
  viewportHeight = 720,
  desktopWidth = 1180,
  logoSrc,
  className = "",
}: FunnelPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(
    forcedMode === "raw" ? "desktop" : (forcedMode ?? defaultMode),
  );
  const isRaw = forcedMode === "raw";
  const activeMode: PreviewMode = isRaw ? "desktop" : (forcedMode ?? mode);

  const isEmbed = viewportHeight === "auto";

  const visibleSections = useMemo(
    () => funnel.sections.filter((s) => s.visible !== false),
    [funnel.sections],
  );

  const heroSection = visibleSections.find((s) => s.type === "hero");
  const otherSections = visibleSections.filter((s) => s.type !== "hero");

  const templateId =
    (funnel.meta as { templateId?: string } | undefined)?.templateId ??
    "story-sell";
  const design = (funnel.design ?? {}) as {
    animationsEnabled?: boolean;
    buttonAnim?: "lift" | "glow" | "pulse" | "shine";
    secondaryColor?: string;
    primaryColor?: string;
    textScale?: number;
    buttonScale?: number;
    customBg?: string;
    customBgEnabled?: boolean;
  };
  const animationsEnabled = design.animationsEnabled !== false;
  const buttonAnim = design.buttonAnim ?? getTemplateButtonAnim(templateId);

  const overrides = {
    accent: design.secondaryColor,
    primary: design.primaryColor,
    textScale: design.textScale,
    buttonScale: design.buttonScale,
    customBg: design.customBg,
    customBgEnabled: design.customBgEnabled,
  };

  if (isRaw) {
    return (
      <RawFrame
        funnel={funnel}
        heroSection={heroSection}
        otherSections={otherSections}
        logoSrc={logoSrc}
        templateId={templateId}
        buttonAnim={buttonAnim}
        animationsEnabled={animationsEnabled}
        overrides={overrides}
        className={className}
      />
    );
  }

  const outerClass = isEmbed
    ? className
    : `overflow-hidden transition-shadow ${className}`;

  const innerStyle: React.CSSProperties = isEmbed
    ? {}
    : {
        height: viewportHeight,
        overflowY: "auto",
        background: "#1a1a1a",
      };

  return (
    <div className={outerClass}>
      {showToolbar && !forcedMode && !isEmbed && (
        <PreviewToolbar mode={activeMode} onChange={setMode} />
      )}

      <div style={innerStyle}>
        {isEmbed ? (
          <EmbedFrame
            funnel={funnel}
            heroSection={heroSection}
            otherSections={otherSections}
            logoSrc={logoSrc}
            templateId={templateId}
            buttonAnim={buttonAnim}
            animationsEnabled={animationsEnabled}
            overrides={overrides}
          />
        ) : activeMode === "desktop" ? (
          <DesktopFrame
            funnel={funnel}
            heroSection={heroSection}
            otherSections={otherSections}
            logoSrc={logoSrc}
            templateId={templateId}
            buttonAnim={buttonAnim}
            animationsEnabled={animationsEnabled}
            overrides={overrides}
            desktopWidth={desktopWidth}
          />
        ) : (
          <MobileFrame
            funnel={funnel}
            heroSection={heroSection}
            otherSections={otherSections}
            logoSrc={logoSrc}
            templateId={templateId}
            buttonAnim={buttonAnim}
            animationsEnabled={animationsEnabled}
            overrides={overrides}
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
          onClick={() => onChange("desktop")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === "desktop"
              ? "bg-[#08498D] text-white shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          <Monitor className="h-3.5 w-3.5" /> Desktop
        </button>
        <button
          type="button"
          onClick={() => onChange("mobile")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === "mobile"
              ? "bg-[#08498D] text-white shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" /> Mobile
        </button>
      </div>
    </div>
  );
}

type FrameProps = {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
  templateId: string;
  buttonAnim: "lift" | "glow" | "pulse" | "shine";
  animationsEnabled: boolean;
  overrides: {
    accent?: string;
    primary?: string;
    textScale?: number;
    buttonScale?: number;
    customBg?: string;
    customBgEnabled?: boolean;
  };
};

function RawFrame({
  funnel,
  heroSection,
  otherSections,
  logoSrc,
  templateId,
  buttonAnim,
  animationsEnabled,
  overrides,
  className = "",
}: FrameProps & { className?: string }) {
  const containerRef = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <TemplateThemeProvider
        templateId={templateId}
        buttonAnim={buttonAnim}
        animationsEnabled={animationsEnabled}
        overrides={overrides}
      >
        <PreviewBody
          funnel={funnel}
          heroSection={heroSection}
          otherSections={otherSections}
          logoSrc={logoSrc}
          compact={false}
          embed
        />
      </TemplateThemeProvider>
    </div>
  );
}

function EmbedFrame({
  funnel,
  heroSection,
  otherSections,
  logoSrc,
  templateId,
  buttonAnim,
  animationsEnabled,
  overrides,
}: FrameProps) {
  const containerRef = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={containerRef} className="w-full">
      <TemplateThemeProvider
        templateId={templateId}
        buttonAnim={buttonAnim}
        animationsEnabled={animationsEnabled}
        overrides={overrides}
      >
        <PreviewBody
          funnel={funnel}
          heroSection={heroSection}
          otherSections={otherSections}
          logoSrc={logoSrc}
          compact={false}
          embed
        />
      </TemplateThemeProvider>
    </div>
  );
}

function DesktopFrame({
  funnel,
  heroSection,
  otherSections,
  logoSrc,
  templateId,
  buttonAnim,
  animationsEnabled,
  overrides,
  desktopWidth,
}: FrameProps & { desktopWidth: number }) {
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div className="w-full animate-[ffFade_0.25s_ease-out]">
      <div
        className="ff-desktop-stage mx-auto"
        style={
          {
            width: `${desktopWidth}px`,
            ["--ff-stage-w" as string]: `${desktopWidth}px`,
          } as React.CSSProperties
        }
      >
        <div ref={containerRef} style={{ transformOrigin: "top center" }}>
          <TemplateThemeProvider
            templateId={templateId}
            buttonAnim={buttonAnim}
            animationsEnabled={animationsEnabled}
            overrides={overrides}
          >
            <PreviewBody
              funnel={funnel}
              heroSection={heroSection}
              otherSections={otherSections}
              logoSrc={logoSrc}
              compact={false}
              embed
            />
          </TemplateThemeProvider>
        </div>
      </div>
    </div>
  );
}

function MobileFrame({
  funnel,
  heroSection,
  otherSections,
  logoSrc,
  templateId,
  buttonAnim,
  animationsEnabled,
  overrides,
}: FrameProps) {
  const containerRef = useScrollReveal<HTMLDivElement>();
  return (
    <div className="py-6 flex justify-center animate-[ffFade_0.25s_ease-out]">
      <div className="w-[380px] bg-black rounded-[36px] p-3 shadow-xl">
        <div className="h-6 flex items-center justify-center">
          <span className="h-1 w-12 rounded-full bg-white/30" />
        </div>
        <div
          className="overflow-hidden bg-black"
          style={{ height: 640, borderRadius: 28 }}
          data-ff-mobile-frame
        >
          <div
            ref={containerRef}
            className="h-full overflow-y-auto"
            style={{
              borderRadius: 28,
              WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            }}
          >
            <TemplateThemeProvider
              templateId={templateId}
              buttonAnim={buttonAnim}
              animationsEnabled={animationsEnabled}
              overrides={overrides}
            >
              <PreviewBody
                funnel={funnel}
                heroSection={heroSection}
                otherSections={otherSections}
                logoSrc={logoSrc}
                compact
              />
            </TemplateThemeProvider>
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
  embed = false,
}: {
  funnel: Funnel;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
  compact: boolean;
  embed?: boolean;
}) {
  const padX = embed ? "px-6 sm:px-10 md:px-16" : compact ? "px-5" : "px-10";
  const padY = embed ? "py-12 md:py-16" : compact ? "py-8" : "py-10";
  const titleSize = "ff-headline-scaled leading-tight";
  const bodySize = compact ? "text-sm" : "text-base";

  const heroColors: SectionColors = heroSection
    ? getSectionColors(heroSection)
    : {};
  const heroShadow = heroSection
    ? readShadow(heroSection)
    : { size: "none" as ShadowSize, color: "#000" };
  const heroBg = heroSection
    ? buildBackgroundStyle(heroSection)
    : { containerStyle: {}, hasBackgroundImage: false, overlay: 0 };

  const sectionInner = compact ? "" : "mx-auto max-w-[920px]";

  // ─── Lot L : icônes décoratives du hero ────────────────────────────────
  const heroDecoIcons = heroSection?.decorativeIcons;
  const heroEdges = hasDecorativeAtEdge(heroDecoIcons);

  return (
    <div>
      <FunnelHeader funnel={funnel} logoSrc={logoSrc} />

      {heroSection && (
        <section
          id={heroSection.id || "hero"}
          data-ff-section="hero"
          data-ff-layout={heroSection.layoutVariant ?? "centered"}
          data-ff-custom-bg={heroColors.bg ? "true" : undefined}
          data-ff-has-bg-image={heroBg.hasBackgroundImage ? "true" : undefined}
          data-ff-deco-top={heroEdges.top ? "true" : undefined}
          data-ff-deco-bottom={heroEdges.bottom ? "true" : undefined}
          className={`ff-section ${padX} ${padY} relative`}
          style={{
            ...(heroColors.bg ? { backgroundColor: heroColors.bg } : {}),
            ...(heroColors.ink ? { color: heroColors.ink } : {}),
            ...(heroColors.accent
              ? ({
                  ["--ff-accent" as string]: heroColors.accent,
                } as React.CSSProperties)
              : {}),
            ...shadowStyleVar(heroShadow.color),
            ...heroBg.containerStyle,
          }}
        >
          {heroBg.hasBackgroundImage && heroBg.overlay > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: `rgba(0,0,0,${heroBg.overlay})` }}
            />
          )}

          {/* ─── Lot L : icônes décoratives "edge" et "floating-bg" du hero ─── */}
          <DecorativeIconsLayer icons={heroDecoIcons} />

          <div className={`relative ${sectionInner}`} style={{ zIndex: 1 }}>
            {heroSection.eyebrow && (
              <span
                data-ff-anim={animOf(
                  heroSection.animations,
                  "eyebrow",
                  "fade-in",
                )}
                className="ff-eyebrow inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4"
                style={{
                  background:
                    "color-mix(in srgb, var(--ff-accent) 15%, transparent)",
                  color: "var(--ff-accent)",
                }}
              >
                {heroSection.eyebrow}
              </span>
            )}

            {heroSection.headline && (
              <h1
                data-ff-anim={animOf(
                  heroSection.animations,
                  "headline",
                  "fade-up",
                )}
                className={`ff-headline ${titleSize} mb-4`}
              >
                <InlineDecorativeIcon
                  icons={heroDecoIcons}
                  position="before-headline"
                />
                {heroSection.headline}
                <InlineDecorativeIcon
                  icons={heroDecoIcons}
                  position="after-headline"
                />
              </h1>
            )}

            {heroSection.subheadline && (
              <p
                data-ff-anim={animOf(
                  heroSection.animations,
                  "subheadline",
                  "fade-up",
                )}
                className={`ff-subheadline ${bodySize} mb-5`}
                style={{ opacity: 0.85 }}
              >
                {heroSection.subheadline}
              </p>
            )}

            {heroSection.image?.mode === "upload" && heroSection.image?.url && (
              <ImageBlock
                image={heroSection.image}
                fallbackAnim={animOf(
                  heroSection.animations,
                  "image",
                  "fade-in",
                )}
                shadowSize={heroShadow.size}
              />
            )}

            {heroSection.video?.url && (
              <VideoEmbedBlock
                url={heroSection.video.url}
                compact={compact}
                anim={animOf(heroSection.animations, "video", "zoom-in")}
                shadowSize={heroShadow.size}
              />
            )}

            {heroSection.cta?.label && (
              <div className="ff-cta-wrap inline-flex items-center gap-2">
                <InlineDecorativeIcon
                  icons={heroDecoIcons}
                  position="before-cta"
                />
                <CtaLink
                  cta={heroSection.cta}
                  className="text-sm"
                  anim={animOf(heroSection.animations, "cta", "fade-up")}
                />
                <InlineDecorativeIcon
                  icons={heroDecoIcons}
                  position="after-cta"
                />
              </div>
            )}
          </div>
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
          sectionInner={sectionInner}
        />
      ))}

      <FunnelFooter funnel={funnel} />
    </div>
  );
}

function SectionBlock({
  section,
  padX,
  padY,
  bodySize,
  compact,
  sectionInner,
}: {
  section: FunnelSection;
  padX: string;
  padY: string;
  bodySize: string;
  compact: boolean;
  sectionInner: string;
}) {
  const titleSize = compact ? "text-xl" : "text-2xl";
  const isForm = section.type === "form";
  const hasUploadedImage =
    section.image?.mode === "upload" && !!section.image?.url;
  const colors: SectionColors = getSectionColors(section);

  const { size: shadowSize, color: shadowColor } = readShadow(section);
  const shadowAttr = shadowSize !== "none" ? shadowSize : undefined;

  const bg = buildBackgroundStyle(section);

  const useSpecialized = usesSpecializedRenderer(section);
  const sectionType = section.type as string;

  // Bullets génériques (sections non spécialisées)
  const defaultBulletIconName = section.iconName || "check";
  const DefaultBulletIcon = getIconByName(defaultBulletIconName);
  const bulletIcons = section.bulletIcons;
  const iconSize = section.iconSize ?? "md";
  const iconAnim = section.iconAnimation ?? "none";

  // ─── Lot L : icônes décoratives de la section ──────────────────────────
  const decoIcons = section.decorativeIcons;
  const edges = hasDecorativeAtEdge(decoIcons);

  return (
    <section
      id={section.id}
      data-ff-section={section.type}
      data-ff-layout={section.layoutVariant ?? "centered"}
      data-ff-shadow-scope={shadowAttr}
      data-ff-custom-bg={colors.bg ? "true" : undefined}
      data-ff-has-bg-image={bg.hasBackgroundImage ? "true" : undefined}
      data-ff-deco-top={edges.top ? "true" : undefined}
      data-ff-deco-bottom={edges.bottom ? "true" : undefined}
      className={`ff-section ${padX} ${padY} relative`}
      style={{
        ...(colors.bg ? { backgroundColor: colors.bg } : {}),
        ...(colors.ink ? { color: colors.ink } : {}),
        ...(colors.accent
          ? ({
              ["--ff-accent" as string]: colors.accent,
            } as React.CSSProperties)
          : {}),
        ...shadowStyleVar(shadowColor),
        ...bg.containerStyle,
      }}
    >
      {bg.hasBackgroundImage && bg.overlay > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `rgba(0,0,0,${bg.overlay})` }}
        />
      )}

      {/* ─── Lot L : icônes décoratives "edge" et "floating-bg" ────────── */}
      <DecorativeIconsLayer icons={decoIcons} />

      <div className={`relative ${sectionInner}`} style={{ zIndex: 1 }}>
        {section.eyebrow && (
          <span
            data-ff-anim={animOf(section.animations, "eyebrow", "fade-in")}
            className="ff-eyebrow inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
            style={{
              background:
                "color-mix(in srgb, var(--ff-accent) 12%, transparent)",
              color: "var(--ff-accent)",
            }}
          >
            {section.eyebrow}
          </span>
        )}

        {section.headline && (
          <h2
            data-ff-anim={animOf(section.animations, "headline", "fade-up")}
            className={`ff-headline ${titleSize} mb-3`}
          >
            <InlineDecorativeIcon
              icons={decoIcons}
              position="before-headline"
            />
            {section.headline}
            <InlineDecorativeIcon
              icons={decoIcons}
              position="after-headline"
            />
          </h2>
        )}

        {section.subheadline && (
          <p
            data-ff-anim={animOf(section.animations, "subheadline", "fade-up")}
            className={`ff-subheadline ${bodySize} mb-4`}
            style={{ opacity: 0.75 }}
          >
            {section.subheadline}
          </p>
        )}

        {section.body && (
          <p
            data-ff-anim={animOf(section.animations, "body", "fade-up")}
            className={`ff-body ${bodySize} mb-4 whitespace-pre-line`}
            style={{ opacity: 0.9 }}
          >
            {section.body}
          </p>
        )}

        {useSpecialized && sectionType === "faq" && (
          <FaqRenderer section={section} bodySize={bodySize} />
        )}
        {useSpecialized &&
          (sectionType === "testimonials" || sectionType === "proof") && (
            <TestimonialsRenderer
              section={section}
              bodySize={bodySize}
              compact={compact}
            />
          )}
        {useSpecialized &&
          (sectionType === "pricing" || sectionType === "offer") && (
            <PricingRenderer
              section={section}
              bodySize={bodySize}
              compact={compact}
            />
          )}
        {useSpecialized && sectionType === "bonus" && (
          <BonusRenderer
            section={section}
            bodySize={bodySize}
            compact={compact}
          />
        )}
        {useSpecialized && sectionType === "guarantee" && (
          <GuaranteeRenderer section={section} bodySize={bodySize} />
        )}

        {!useSpecialized &&
          Array.isArray(section.bullets) &&
          section.bullets.length > 0 && (
            <ul
              data-ff-bullets="stagger"
              className="ff-bullets space-y-2 mb-4 list-none pl-0"
            >
              {section.bullets.map((bullet, i) => {
                const PerBulletIcon = bulletIcons?.[i]
                  ? getIconByName(bulletIcons[i] as string)
                  : DefaultBulletIcon;
                return (
                  <li
                    key={i}
                    data-ff-anim={animOf(
                      section.animations,
                      "bullets",
                      "fade-up",
                    )}
                    className={`flex items-start gap-2 ${bodySize}`}
                    style={{ opacity: 0.95 }}
                  >
                    <PerBulletIcon
                      data-ff-icon-size={iconSize}
                      data-ff-icon-anim={iconAnim}
                      className="shrink-0 mt-0.5"
                      style={{ color: "var(--ff-accent, #31845C)" }}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{bullet}</span>
                  </li>
                );
              })}
            </ul>
          )}

        {section.video?.url && (
          <VideoEmbedBlock
            url={section.video.url}
            compact={compact}
            anim={animOf(section.animations, "video", "zoom-in")}
            shadowSize={shadowSize}
          />
        )}

        {hasUploadedImage && (
          <ImageBlock
            image={section.image!}
            fallbackAnim={animOf(section.animations, "image", "fade-in")}
            shadowSize={shadowSize}
          />
        )}

        {isForm && (
          <div data-ff-shadow={shadowAttr}>
            <FormRenderer section={section} />
          </div>
        )}

        {!isForm && section.cta?.label && (
          <div className="ff-cta-wrap inline-flex items-center gap-2">
            <InlineDecorativeIcon icons={decoIcons} position="before-cta" />
            <CtaLink
              cta={section.cta}
              className="text-sm mt-2"
              anim={animOf(section.animations, "cta", "fade-up")}
            />
            <InlineDecorativeIcon icons={decoIcons} position="after-cta" />
          </div>
        )}
      </div>
    </section>
  );
}

function VideoEmbedBlock({
  url,
  compact,
  anim,
  shadowSize,
}: {
  url: string;
  compact: boolean;
  anim?: AnimationPreset;
  shadowSize?: ShadowSize;
}) {
  const embed = getVideoEmbed(url);
  if (!embed.embedUrl) return null;
  return (
    <div
      data-ff-anim={anim ?? "zoom-in"}
      data-ff-shadow={
        shadowSize && shadowSize !== "none" ? shadowSize : undefined
      }
      className={`overflow-hidden rounded-lg ${compact ? "my-3" : "my-5"}`}
      style={{ border: "1px solid var(--ff-border, rgba(0,0,0,0.08))" }}
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

function ImageBlock({
  image,
  fallbackAnim,
  shadowSize,
}: {
  image: NonNullable<FunnelSection["image"]>;
  fallbackAnim: AnimationPreset;
  shadowSize: ShadowSize;
}) {
  const transparent = image.transparentBg === true;
  const size = image.size ?? "lg";
  const customWidth = image.customWidth ?? 480;
  const imageAnim = image.animation;

  const ENTRY_ANIMS = [
    "none",
    "fade-in",
    "fade-up",
    "zoom-in",
    "slide-left",
    "slide-right",
  ] as const;
  const entryAnim: AnimationPreset =
    imageAnim && (ENTRY_ANIMS as readonly string[]).includes(imageAnim)
      ? (imageAnim as AnimationPreset)
      : fallbackAnim;

  const loopAnim =
    imageAnim === "float" || imageAnim === "pulse" ? imageAnim : undefined;

  const figureStyle: React.CSSProperties = {};
  if (!transparent) {
    figureStyle.border = "1px solid var(--ff-border, rgba(0,0,0,0.08))";
  }
  if (size === "custom") {
    figureStyle.maxWidth = `${customWidth}px`;
    figureStyle.marginLeft = "auto";
    figureStyle.marginRight = "auto";
  }

  return (
    <figure
      data-ff-anim={entryAnim}
      data-ff-shadow={
        !transparent && shadowSize !== "none" ? shadowSize : undefined
      }
      data-ff-img-size={size}
      data-ff-img-transparent={transparent ? "true" : undefined}
      data-ff-img-anim={loopAnim}
      className={[
        "ff-image-wrap mt-4 mb-2",
        transparent ? "" : "overflow-hidden rounded-lg",
      ].join(" ")}
      style={figureStyle}
    >
      <img
        src={image.url!}
        alt={image.alt ?? ""}
        className="w-full h-auto block"
        loading="lazy"
        style={transparent ? { background: "transparent" } : undefined}
      />
    </figure>
  );
}

function CtaLink({
  cta,
  className = "",
  anim,
}: {
  cta: NonNullable<FunnelSection["cta"]>;
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
      data-ff-cta
      className={`ff-btn inline-flex items-center gap-2 px-5 py-2.5 font-bold no-underline ${className}`}
    >
      {cta.label}
      {external && <ExternalLink size={13} />}
    </a>
  );
}
