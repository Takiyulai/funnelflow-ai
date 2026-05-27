// components/funnel/FunnelPreview.tsx
"use client";

import { useState, useMemo } from "react";
import {
  Monitor,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  Mail,
  Download,
  PartyPopper,
} from "lucide-react";
import type {
  AnimationPreset,
  DecorativeIcon,
  Funnel,
  FunnelPage,
  FunnelSection,
  MediaItem,
  PageRole,
  SectionAnimations,
  SectionColors,
  SectionImage,
  TimerItem,
} from "@/lib/funnels/types";
import { ctaHref, ctaTarget, ctaRel, ctaIsExternal } from "@/lib/funnels/cta";
import { getVideoEmbed } from "@/lib/funnels/video";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { TemplateThemeProvider } from "@/components/funnel/TemplateThemeProvider";
import { effectiveLayoutVariant } from "@/lib/funnels/resolveMedia";
import { getTemplateButtonAnim } from "@/lib/funnels/templates";
import FunnelFooter from "@/components/funnel/FunnelFooter";
import FunnelHeader from "@/components/funnel/FunnelHeader";
import { getIconByName } from "@/components/editor/IconPicker";
import { RichText } from "@/components/funnel/RichText";
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
import { TimerRenderer } from "@/components/funnel/sections/TimerRenderer";
import { PopupForm } from "@/components/funnel/PopupForm";


type PreviewMode = "desktop" | "mobile";
type ForcedMode = PreviewMode | "raw";
type ShadowSize = "none" | "sm" | "md" | "lg" | "xl";
type BulletsMode = "list" | "grid" | "inline-strip";

interface FunnelPreviewProps {
  funnel: Funnel;
  activePage?: FunnelPage;
  defaultMode?: PreviewMode;
  forcedMode?: ForcedMode;
  showToolbar?: boolean;
  viewportHeight?: number | string;
  desktopWidth?: number;
  logoSrc?: string;
  className?: string;
  pageRole?: PageRole;
}

const SUCCESS_PAGE_ROLES: ReadonlySet<PageRole> = new Set<PageRole>([
  "thankyou",
  "delivery",
  "confirmation",
]);

/* Sections autorisées à utiliser grid/inline-strip */
const BULLET_LAYOUT_SECTIONS = new Set<string>([
  "benefits",
  "benefit",
  "features",
  "feature",
  "stats",
  "numbers",
  "metrics",
  "kpi",
]);

/* Sections forcées en mode "list" (jamais grid/strip) */
const BULLET_LIST_ONLY_SECTIONS = new Set<string>([
  "hero",
  "cta",
  "form",
  "guarantee",
]);

function extractTimers(section: FunnelSection): TimerItem[] {
  if (!Array.isArray(section.items)) return [];
  return section.items
    .filter((it): it is { kind: "timer"; data: TimerItem } => it.kind === "timer")
    .map((it) => it.data);
}

function isSuccessRole(role: PageRole | undefined): boolean {
  if (!role) return false;
  return SUCCESS_PAGE_ROLES.has(role);
}

function getRoleIcon(role: PageRole | undefined): React.ComponentType<{
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}> {
  switch (role) {
    case "delivery":
      return Download;
    case "confirmation":
      return Mail;
    case "thankyou":
      return CheckCircle2;
    default:
      return PartyPopper;
  }
}

function resolveActivePage(funnel: Funnel): FunnelPage | undefined {
  if (!funnel.pages || funnel.pages.length === 0) return undefined;
  if (typeof window === "undefined") {
    return funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
  }
  const m = window.location.pathname.match(/^\/tunnel\/[^/]+(?:\/([^/]+))?/);
  const pageSlug = m?.[1] ? decodeURIComponent(m[1]).replace(/^\/+|\/+$/g, "") : "";
  if (!pageSlug) return funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
  const found = funnel.pages.find(
    (p) => p.slug.replace(/^\/+|\/+$/g, "") === pageSlug,
  );
  return found ?? funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
}

function getRoleIconColors(role: PageRole | undefined): {
  fg: string;
  bg: string;
  ring: string;
} {
  switch (role) {
    case "delivery":
      return {
        fg: "rgb(59, 130, 246)",
        bg: "rgba(59, 130, 246, 0.14)",
        ring: "rgba(59, 130, 246, 0.10)",
      };
    case "thankyou":
    case "confirmation":
      return {
        fg: "rgb(34, 197, 94)",
        bg: "rgba(34, 197, 94, 0.14)",
        ring: "rgba(34, 197, 94, 0.10)",
      };
    default:
      return {
        fg: "var(--ff-accent, rgb(34, 197, 94))",
        bg: "color-mix(in srgb, var(--ff-accent) 18%, transparent)",
        ring: "color-mix(in srgb, var(--ff-accent) 8%, transparent)",
      };
  }
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

function resolveImageUrl(
  image: SectionImage | undefined,
  mediaLibrary: MediaItem[] | undefined,
): { url: string; alt: string } | null {
  if (!image || image.mode === "none") return null;

  if (image.url && image.url.length > 0) {
    return { url: image.url, alt: image.alt ?? "" };
  }

  if (image.mediaRef && mediaLibrary && mediaLibrary.length > 0) {
    const item = mediaLibrary.find((m) => m.id === image.mediaRef);
    if (item?.url && item.url.length > 0) {
      return { url: item.url, alt: image.alt ?? item.alt ?? "" };
    }
  }

  return null;
}

function cleanSlug(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/^\/+/, "").replace(/\/+$/, "").trim();
}

function buildPageLinkMap(funnel: Funnel): Map<string, string> {
  const map = new Map<string, string>();
  if (!funnel.pages || funnel.pages.length === 0) return map;

  let basePath = "";
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const match = path.match(/^(\/tunnel\/[^/]+)/);
    if (match) {
      basePath = match[1];
    }
  }

  for (const page of funnel.pages) {
    if (page.isHome) {
      map.set(page.id, basePath || "/");
    } else {
      const slug = cleanSlug(page.slug);
      map.set(page.id, slug ? `${basePath}/${slug}` : basePath || "/");
    }
  }
  return map;
}

function buildSlugLinkMap(funnel: Funnel): Map<string, string> {
  const map = new Map<string, string>();
  if (!funnel.pages || funnel.pages.length === 0) return map;

  let basePath = "";
  if (typeof window !== "undefined") {
    const match = window.location.pathname.match(/^(\/tunnel\/[^/]+)/);
    if (match) basePath = match[1];
  }

  for (const page of funnel.pages) {
    if (page.isHome) {
      map.set("", basePath || "/");
      map.set("/", basePath || "/");
    } else {
      const slug = cleanSlug(page.slug);
      if (slug) map.set(slug, `${basePath}/${slug}`);
    }
  }
  return map;
}

/* ─── Helpers bullets ──────────────────────────────────────────────────── */

/**
 * Parse "75% | de réussite" ou "75% — de réussite" → { value, label }.
 * Sinon retourne null.
 */
function splitBulletValueLabel(
  raw: string,
): { value: string; label: string } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(.+?)\s*(?:\||—|–|::)\s*(.+?)\s*$/);
  if (!m) return null;
  const value = m[1].trim();
  const label = m[2].trim();
  if (!value || !label) return null;
  // Heuristique : la valeur doit être courte (≤ 12 chars)
  if (value.length > 12) return null;
  return { value, label };
}

/**
 * Détermine si tous les bullets ont un format "value | label" court → inline-strip.
 */
function bulletsFitInlineStrip(bullets: string[]): boolean {
  if (bullets.length < 2 || bullets.length > 6) return false;
  return bullets.every((b) => splitBulletValueLabel(b) !== null);
}

/**
 * Décide le mode d'affichage des bullets.
 */
function decideBulletsMode(
  sectionType: string,
  bullets: string[],
  isSuccess: boolean,
): BulletsMode {
  if (isSuccess) return "list";
  if (BULLET_LIST_ONLY_SECTIONS.has(sectionType)) return "list";
  if (!BULLET_LAYOUT_SECTIONS.has(sectionType)) return "list";
  if (bulletsFitInlineStrip(bullets)) return "inline-strip";
  if (bullets.length >= 2) return "grid";
  return "list";
}

/* ─────────────────────────────────────────────────────────────────────── */

export function FunnelPreview({
  funnel,
  activePage,
  defaultMode = "desktop",
  forcedMode,
  showToolbar = true,
  viewportHeight = 720,
  desktopWidth = 1180,
  logoSrc,
  className = "",
  pageRole,
}: FunnelPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(
    forcedMode === "raw" ? "desktop" : (forcedMode ?? defaultMode),
  );
  const isRaw = forcedMode === "raw";
  const activeMode: PreviewMode = isRaw ? "desktop" : (forcedMode ?? mode);

  const isEmbed = viewportHeight === "auto";

  // Page active : prop explicite > résolution via URL > home > première
  const resolvedActivePage = useMemo<FunnelPage | undefined>(
    () => activePage ?? resolveActivePage(funnel),
    [activePage, funnel],
  );

  const sourceSections = useMemo(
    () => resolvedActivePage?.sections ?? funnel.sections,
    [resolvedActivePage, funnel.sections],
  );

  const visibleSections = useMemo(
    () => sourceSections.filter((s) => s.visible !== false),
    [sourceSections],
  );

  const heroSection = visibleSections.find((s) => s.type === "hero");
  const otherSections = visibleSections.filter((s) => s.type !== "hero");

  const pageLinks = useMemo(() => buildPageLinkMap(funnel), [funnel]);
  const slugLinks = useMemo(() => buildSlugLinkMap(funnel), [funnel]);

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

  const frameProps: FrameProps = {
    funnel,
    activePage: resolvedActivePage,
    heroSection,
    otherSections,
    logoSrc,
    templateId,
    buttonAnim,
    animationsEnabled,
    overrides,
    pageRole,
    pageLinks,
    slugLinks,
  };

  if (isRaw) {
    return <RawFrame {...frameProps} className={className} />;
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
          <EmbedFrame {...frameProps} />
        ) : activeMode === "desktop" ? (
          <DesktopFrame {...frameProps} desktopWidth={desktopWidth} />
        ) : (
          <MobileFrame {...frameProps} />
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
  activePage?: FunnelPage;
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
  pageRole?: PageRole;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
};

function RawFrame(props: FrameProps & { className?: string }) {
  const { className = "", ...rest } = props;
  const containerRef = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <TemplateThemeProvider
        templateId={rest.templateId}
        buttonAnim={rest.buttonAnim}
        animationsEnabled={rest.animationsEnabled}
        overrides={rest.overrides}
      >
        <PreviewBody {...rest} compact={false} embed />
      </TemplateThemeProvider>
    </div>
  );
}

function EmbedFrame(props: FrameProps) {
  const containerRef = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={containerRef} className="w-full">
      <TemplateThemeProvider
        templateId={props.templateId}
        buttonAnim={props.buttonAnim}
        animationsEnabled={props.animationsEnabled}
        overrides={props.overrides}
      >
        <PreviewBody {...props} compact={false} embed />
      </TemplateThemeProvider>
    </div>
  );
}

function DesktopFrame(props: FrameProps & { desktopWidth: number }) {
  const { desktopWidth, ...rest } = props;
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div className="w-full animate-[ffFade_0.25s_ease-out]">
      <div
        className="ff-desktop-stage mx-auto overflow-visible"
        style={
          {
            width: `${desktopWidth}px`,
            maxWidth: "100%",
            ["--ff-stage-w" as string]: `${desktopWidth}px`,
          } as React.CSSProperties
        }
      >
        <div ref={containerRef} style={{ transformOrigin: "top center", overflow: "visible" }}>
          <TemplateThemeProvider
            templateId={rest.templateId}
            buttonAnim={rest.buttonAnim}
            animationsEnabled={rest.animationsEnabled}
            overrides={rest.overrides}
          >
            <PreviewBody {...rest} compact={false} embed={false} />
          </TemplateThemeProvider>
        </div>
      </div>
    </div>
  );
}

function MobileFrame(props: FrameProps) {
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
              templateId={props.templateId}
              buttonAnim={props.buttonAnim}
              animationsEnabled={props.animationsEnabled}
              overrides={props.overrides}
            >
              <PreviewBody {...props} compact />
            </TemplateThemeProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  funnel,
  activePage,
  heroSection,
  otherSections,
  logoSrc,
  compact,
  embed = false,
  pageRole,
  pageLinks,
  slugLinks,
}: {
  funnel: Funnel;
  activePage?: FunnelPage;
  heroSection: FunnelSection | undefined;
  otherSections: FunnelSection[];
  logoSrc?: string;
  compact: boolean;
  embed?: boolean;
  pageRole?: PageRole;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
}) {
  const mediaLibrary = funnel.media;

  const padX = embed ? "px-4 sm:px-6 md:px-8" : compact ? "px-4" : "px-6";
  const padY = embed ? "py-8 md:py-12" : compact ? "py-6" : "py-8";
  const bodySize = compact ? "text-sm" : "text-base";

  const isSuccess = isSuccessRole(pageRole);
  const sectionInner = compact
    ? ""
    : isSuccess
      ? "mx-auto max-w-[720px] text-center"
      : "mx-auto max-w-[920px]";

  const successPadY = isSuccess && !compact ? "py-16 md:py-20" : padY;

  return (
    <div>
      <FunnelHeader funnel={funnel} logoSrc={logoSrc} />

      {heroSection && (
        <HeroBlock
          section={heroSection}
          padX={padX}
          padY={successPadY}
          bodySize={bodySize}
          compact={compact}
          sectionInner={sectionInner}
          mediaLibrary={mediaLibrary}
          isSuccess={isSuccess}
          pageRole={pageRole}
          pageLinks={pageLinks}
          slugLinks={slugLinks}
          funnel={funnel}
          activePage={activePage}
        />
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
          mediaLibrary={mediaLibrary}
          isSuccess={isSuccess}
          pageLinks={pageLinks}
          slugLinks={slugLinks}
          funnel={funnel}
          activePage={activePage}
        />
      ))}

      <FunnelFooter funnel={funnel} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function HeroBlock({
  section,
  padX,
  padY,
  bodySize,
  compact,
  sectionInner,
  mediaLibrary,
  isSuccess,
  pageRole,
  pageLinks,
  slugLinks,
  funnel,
  activePage,
}: {
  section: FunnelSection;
  padX: string;
  padY: string;
  bodySize: string;
  compact: boolean;
  sectionInner: string;
  mediaLibrary?: MediaItem[];
  isSuccess: boolean;
  pageRole?: PageRole;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
  funnel: Funnel;
  activePage?: FunnelPage;
}) {
  const colors: SectionColors = getSectionColors(section);
  const { size: shadowSize, color: shadowColor } = readShadow(section);
  const shadowAttr = shadowSize !== "none" ? shadowSize : undefined;
  const bg = buildBackgroundStyle(section);
  const decoIcons = section.decorativeIcons;
  const edges = hasDecorativeAtEdge(decoIcons);
  const resolvedImage = resolveImageUrl(section.image, mediaLibrary);
  const layout = isSuccess
    ? "success-centered"
    : effectiveLayoutVariant(section, funnel);

  const RoleIcon = isSuccess ? getRoleIcon(pageRole) : null;
  const roleIconColors = isSuccess ? getRoleIconColors(pageRole) : null;

  return (
    <section
      id={section.id || "hero"}
      data-ff-section="hero"
      data-ff-section-id={section.id}
      data-ff-layout={layout}
      data-ff-shadow-scope={shadowAttr}
      data-ff-page-role={pageRole ?? undefined}
      data-ff-custom-bg={colors.bg ? "true" : undefined}
      data-ff-has-bg-image={bg.hasBackgroundImage ? "true" : undefined}
      data-ff-deco-top={edges.top ? "true" : undefined}
      data-ff-deco-bottom={edges.bottom ? "true" : undefined}
      data-ff-anim="fade-up"
      className={`ff-section ${padX} ${padY} relative`}
      style={{
        ...(colors.bg ? { backgroundColor: colors.bg } : {}),
        ...(colors.ink ? { color: colors.ink } : {}),
        ...(colors.accent
          ? ({ ["--ff-accent" as string]: colors.accent } as React.CSSProperties)
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

      <DecorativeIconsLayer icons={decoIcons} />

      <div className={`relative ${sectionInner}`} style={{ zIndex: 1 }}>
        {RoleIcon && roleIconColors && (
          <div data-ff-anim="zoom-in" className="mb-2 flex justify-center">
            <div
              className="ff-success-icon inline-flex items-center justify-center rounded-full"
              style={{
                width: compact ? 64 : 80,
                height: compact ? 64 : 80,
                background: roleIconColors.bg,
                boxShadow: `0 0 0 6px ${roleIconColors.ring}`,
              }}
            >
              <RoleIcon
                strokeWidth={2.2}
                className="ff-success-icon-svg"
                style={{
                  color: roleIconColors.fg,
                  width: compact ? 32 : 40,
                  height: compact ? 32 : 40,
                }}
              />
            </div>
          </div>
        )}

        {section.eyebrow && (
          <RichText
            as="span"
            className="ff-eyebrow text-xs"
            text={section.eyebrow}
            dataAnim={animOf(section.animations, "eyebrow", "fade-in")}
          />
        )}

        {section.headline && (
          <h1
            data-ff-anim={animOf(section.animations, "headline", "fade-up")}
            className="ff-headline ff-headline-scaled"
          >
            <InlineDecorativeIcon icons={decoIcons} position="before-headline" />
            <RichText as="span" text={section.headline} />
            <InlineDecorativeIcon icons={decoIcons} position="after-headline" />
          </h1>
        )}

        {section.subheadline && (
          <RichText
            as="p"
            className={`ff-subheadline ${bodySize}`}
            text={section.subheadline}
            dataAnim={animOf(section.animations, "subheadline", "fade-up")}
          />
        )}

        {section.body && (
          <RichText
            as="p"
            className={`ff-body ${bodySize} whitespace-pre-line`}
            text={section.body}
            dataAnim={animOf(section.animations, "body", "fade-up")}
          />
        )}

        {usesSpecializedRenderer(section) && (
          <SpecializedContent section={section} bodySize={bodySize} compact={compact} />
        )}

        {!usesSpecializedRenderer(section) &&
          Array.isArray(section.bullets) &&
          section.bullets.length > 0 && (
            <BulletsList
              bullets={section.bullets}
              bulletIcons={section.bulletIcons}
              defaultIconName={section.iconName || "check"}
              iconSize={section.iconSize ?? "md"}
              iconAnim={section.iconAnimation ?? "none"}
              animations={section.animations}
              bodySize={bodySize}
              isSuccess={isSuccess}
              sectionType={section.type as string}
              shadowSize={shadowSize}
            />
          )}

        {(section.video?.url || resolvedImage) && (
          <>
            {section.video?.url && (
              <VideoEmbedBlock
                url={section.video.url}
                compact={compact}
                anim={animOf(section.animations, "video", "zoom-in")}
                shadowSize={shadowSize}
              />
            )}
            {resolvedImage && section.image && (
              <ImageBlock
                image={{
                  ...section.image,
                  url: resolvedImage.url,
                  alt: resolvedImage.alt,
                }}
                fallbackAnim={animOf(section.animations, "image", "fade-in")}
                shadowSize={shadowSize}
                centered={isSuccess}
              />
            )}
          </>
        )}

        {/* Timers de la section — affichés avant le CTA */}
        {extractTimers(section).map((timer) => (
          <TimerRenderer
            key={timer.id}
            timer={timer}
            funnelId={funnel.meta?.tunnelGroupId || "default"}
            pageId={section.id}
            language={funnel.language}
          />
        ))}

        {section.cta?.label && section.type !== "form" && (
          <div className={`ff-cta-wrap inline-flex items-center gap-2 ${isSuccess ? "mt-2" : ""}`}>
            <InlineDecorativeIcon icons={decoIcons} position="before-cta" />
            <CtaLink
              cta={section.cta}
              className="text-sm"
              anim={animOf(section.animations, "cta", "fade-up")}
              pageLinks={pageLinks}
              slugLinks={slugLinks}
              funnel={funnel}
              page={activePage}
              section={section}
            />
            <InlineDecorativeIcon icons={decoIcons} position="after-cta" />
          </div>
        )}



        {section.type === "form" && (
          <div data-ff-shadow={shadowAttr}>
            <FormRenderer section={section} funnel={funnel} page={activePage} />
          </div>
        )}
      </div>
    </section>
  );
}

function SectionBlock({
  section,
  padX,
  padY,
  bodySize,
  compact,
  sectionInner,
  mediaLibrary,
  isSuccess,
  pageLinks,
  slugLinks,
  funnel,
  activePage,
}: {
  section: FunnelSection;
  padX: string;
  padY: string;
  bodySize: string;
  compact: boolean;
  sectionInner: string;
  mediaLibrary?: MediaItem[];
  isSuccess: boolean;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
  funnel: Funnel;
  activePage?: FunnelPage;
}) {
  const isForm = section.type === "form";
  const resolvedImage = resolveImageUrl(section.image, mediaLibrary);
  const colors: SectionColors = getSectionColors(section);
  const { size: shadowSize, color: shadowColor } = readShadow(section);
  const shadowAttr = shadowSize !== "none" ? shadowSize : undefined;
  const bg = buildBackgroundStyle(section);
  const useSpecialized = usesSpecializedRenderer(section);
  const decoIcons = section.decorativeIcons;
  const edges = hasDecorativeAtEdge(decoIcons);

  const layout = isSuccess
    ? "success-centered"
    : effectiveLayoutVariant(section, funnel);

  return (
    <section
      id={section.id}
      data-ff-section={section.type}
      data-ff-section-id={section.id}
      data-ff-layout={layout}
      data-ff-shadow-scope={shadowAttr}
      data-ff-custom-bg={colors.bg ? "true" : undefined}
      data-ff-has-bg-image={bg.hasBackgroundImage ? "true" : undefined}
      data-ff-deco-top={edges.top ? "true" : undefined}
      data-ff-deco-bottom={edges.bottom ? "true" : undefined}
      data-ff-anim={animOf(section.animations, "headline", "fade-up")}
      className={`ff-section ${padX} ${padY} relative`}
      style={{
        ...(colors.bg ? { backgroundColor: colors.bg } : {}),
        ...(colors.ink ? { color: colors.ink } : {}),
        ...(colors.accent
          ? ({ ["--ff-accent" as string]: colors.accent } as React.CSSProperties)
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

      <DecorativeIconsLayer icons={decoIcons} />

      <div className={`relative ${sectionInner}`} style={{ zIndex: 1 }}>
        {section.eyebrow && (
          <RichText
            as="span"
            className="ff-eyebrow text-xs"
            text={section.eyebrow}
            dataAnim={animOf(section.animations, "eyebrow", "fade-in")}
          />
        )}

        {section.headline && (
          <h2
            data-ff-anim={animOf(section.animations, "headline", "fade-up")}
            className="ff-headline ff-headline-scaled"
          >
            <InlineDecorativeIcon icons={decoIcons} position="before-headline" />
            <RichText as="span" text={section.headline} />
            <InlineDecorativeIcon icons={decoIcons} position="after-headline" />
          </h2>
        )}

        {section.subheadline && (
          <RichText
            as="p"
            className={`ff-subheadline ${bodySize}`}
            text={section.subheadline}
            dataAnim={animOf(section.animations, "subheadline", "fade-up")}
          />
        )}

        {section.body && (
          <RichText
            as="p"
            className={`ff-body ${bodySize} whitespace-pre-line`}
            text={section.body}
            dataAnim={animOf(section.animations, "body", "fade-up")}
          />
        )}

        {useSpecialized && (
          <SpecializedContent section={section} bodySize={bodySize} compact={compact} />
        )}

        {!useSpecialized &&
          Array.isArray(section.bullets) &&
          section.bullets.length > 0 && (
            <BulletsList
              bullets={section.bullets}
              bulletIcons={section.bulletIcons}
              defaultIconName={section.iconName || "check"}
              iconSize={section.iconSize ?? "md"}
              iconAnim={section.iconAnimation ?? "none"}
              animations={section.animations}
              bodySize={bodySize}
              isSuccess={isSuccess}
              sectionType={section.type as string}
              shadowSize={shadowSize}
            />
          )}

        {(section.video?.url || resolvedImage) && (
          <>
            {section.video?.url && (
              <VideoEmbedBlock
                url={section.video.url}
                compact={compact}
                anim={animOf(section.animations, "video", "zoom-in")}
                shadowSize={shadowSize}
              />
            )}
            {resolvedImage && section.image && (
              <ImageBlock
                image={{
                  ...section.image,
                  url: resolvedImage.url,
                  alt: resolvedImage.alt,
                }}
                fallbackAnim={animOf(section.animations, "image", "fade-in")}
                shadowSize={shadowSize}
                centered={isSuccess}
              />
            )}
          </>
        )}

        {/* Timers de la section — affichés avant le CTA */}
        {extractTimers(section).map((timer) => (
          <TimerRenderer
            key={timer.id}
            timer={timer}
            funnelId={funnel.meta?.tunnelGroupId || "default"}
            pageId={section.id}
            language={funnel.language}
          />
        ))}

        {!isForm && section.cta?.label && (
  <div className="ff-cta-wrap inline-flex items-center gap-2">
    <InlineDecorativeIcon icons={decoIcons} position="before-cta" />
    <CtaLink
      cta={section.cta}
      className="text-sm mt-2"
      anim={animOf(section.animations, "cta", "fade-up")}
      pageLinks={pageLinks}
      slugLinks={slugLinks}
      funnel={funnel}
      page={activePage}
      section={section}
    />
    <InlineDecorativeIcon icons={decoIcons} position="after-cta" />
  </div>
)}


        {isForm && (
          <div data-ff-shadow={shadowAttr}>
            <FormRenderer section={section} funnel={funnel} page={activePage} />
          </div>
        )}
      </div>
    </section>
  );
}

function SpecializedContent({
  section,
  bodySize,
  compact,
}: {
  section: FunnelSection;
  bodySize: string;
  compact: boolean;
}) {
  const sectionType = section.type as string;
  if (sectionType === "faq")
    return <FaqRenderer section={section} bodySize={bodySize} />;
  if (sectionType === "testimonials" || sectionType === "proof")
    return (
      <TestimonialsRenderer
        section={section}
        bodySize={bodySize}
        compact={compact}
      />
    );
  if (sectionType === "pricing" || sectionType === "offer")
    return (
      <PricingRenderer
        section={section}
        bodySize={bodySize}
        compact={compact}
      />
    );
  if (sectionType === "bonus")
    return (
      <BonusRenderer
        section={section}
        bodySize={bodySize}
        compact={compact}
      />
    );
  if (sectionType === "guarantee")
    return <GuaranteeRenderer section={section} bodySize={bodySize} />;
  return null;
}

/* ─── BulletsList : 3 modes (list / grid / inline-strip) ──────────────── */

function BulletsList({
  bullets,
  bulletIcons,
  defaultIconName,
  iconSize,
  iconAnim,
  animations,
  bodySize,
  isSuccess,
  sectionType,
  shadowSize,
}: {
  bullets: string[];
  bulletIcons?: string[];
  defaultIconName: string;
  iconSize: string;
  iconAnim: string;
  animations?: SectionAnimations;
  bodySize: string;
  isSuccess: boolean;
  sectionType: string;
  shadowSize?: ShadowSize;
}) {
  const DefaultBulletIcon = getIconByName(defaultIconName);
  const mode = decideBulletsMode(sectionType, bullets, isSuccess);
  const shadowAttr =
    shadowSize && shadowSize !== "none" ? shadowSize : undefined;

  const modeClass =
    mode === "grid"
      ? "ff-bullets--grid"
      : mode === "inline-strip"
        ? "ff-bullets--inline-strip"
        : "";

  /* ─── Mode "inline-strip" (stats / kpi) ─── */
  if (mode === "inline-strip") {
    return (
      <ul
        data-ff-bullets="stagger"
        data-ff-bullets-mode="inline-strip"
        className={`ff-bullets ${modeClass} list-none pl-0`}
      >
        {bullets.map((bullet, i) => {
          const split = splitBulletValueLabel(bullet);
          const value = split?.value ?? bullet;
          const label = split?.label ?? "";
          return (
            <li
              key={i}
              data-ff-anim={animOf(animations, "bullets", "fade-up")}
            >
              <span
                className="ff-strip-value"
                style={{ color: "var(--ff-accent, #31845C)" }}
              >
                {value}
              </span>
              {label && <span className="ff-strip-label">{label}</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  /* ─── Mode "grid" (benefits / features cards) ─── */
  if (mode === "grid") {
    return (
      <ul
        data-ff-bullets="stagger"
        data-ff-bullets-mode="grid"
        data-ff-shadow={shadowAttr}
        className={`ff-bullets ${modeClass} list-none pl-0`}
      >
        {bullets.map((bullet, i) => {
          const PerBulletIcon = bulletIcons?.[i]
            ? getIconByName(bulletIcons[i] as string)
            : DefaultBulletIcon;
          return (
            <li
              key={i}
              data-ff-anim={animOf(animations, "bullets", "fade-up")}
              className={bodySize}
            >
              <PerBulletIcon
                data-ff-icon-size={iconSize}
                data-ff-icon-anim={iconAnim}
                className="ff-bullet-ic shrink-0"
                style={{ color: "var(--ff-accent, #31845C)" }}
                aria-hidden="true"
              />
              <RichText as="span" text={bullet} />
            </li>
          );
        })}
      </ul>
    );
  }

  /* ─── Mode "list" (par défaut) ─── */
  return (
    <ul
      data-ff-bullets="stagger"
      data-ff-bullets-mode="list"
      className={`ff-bullets space-y-2 mb-3 list-none pl-0 ${
        isSuccess ? "inline-block text-left" : ""
      }`}
    >
      {bullets.map((bullet, i) => {
        const PerBulletIcon = bulletIcons?.[i]
          ? getIconByName(bulletIcons[i] as string)
          : DefaultBulletIcon;
        return (
          <li
            key={i}
            data-ff-anim={animOf(animations, "bullets", "fade-up")}
            className={`flex items-start gap-2 ${bodySize}`}
            style={{ opacity: 0.95 }}
          >
            <PerBulletIcon
              data-ff-icon-size={iconSize}
              data-ff-icon-anim={iconAnim}
              className="ff-bullet-ic shrink-0 mt-0.5 w-4 h-4"
              style={{ color: "var(--ff-accent, #31845C)" }}
              aria-hidden="true"
            />
            <RichText as="span" text={bullet} />
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Image / Vidéo / CTA ─────────────────────────────────────────────── */

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
      className={`overflow-hidden rounded-lg ${compact ? "my-2" : "my-3"}`}
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
  centered = false,
}: {
  image: NonNullable<FunnelSection["image"]>;
  fallbackAnim: AnimationPreset;
  shadowSize: ShadowSize;
  centered?: boolean;
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
  } else if (centered) {
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
        "ff-image-wrap mt-3 mb-1",
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
  pageLinks,
  slugLinks,
  funnel,
  page,
  section,
}: {
  cta: NonNullable<FunnelSection["cta"]>;
  className?: string;
  anim?: AnimationPreset;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
  funnel: Funnel;
  page?: FunnelPage;
  section: FunnelSection;
}) {
  // ─── Mode "popup" : bouton qui ouvre la modale ────────────────────
  if (cta.mode === "popup") {
    return (
      <PopupForm
        cta={cta}
        section={section}
        funnel={funnel}
        page={page}
        buttonClassName={`ff-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-bold no-underline rounded-lg ${className}`}
        buttonProps={{ "data-ff-anim": anim ?? "fade-up" } as React.ButtonHTMLAttributes<HTMLButtonElement>}
      />
    );
  }

  // ─── Modes "anchor" et "redirect" : <a> classique ────────────────
  let href = ctaHref(cta);
  let target = ctaTarget(cta);
  let rel = ctaRel(cta);
  let external = ctaIsExternal(cta);

  const ctaAny = cta as unknown as {
    mode?: string;
    pageId?: string;
    pageSlug?: string;
    url?: string;
  };

  if (ctaAny.pageId && pageLinks.has(ctaAny.pageId)) {
    href = pageLinks.get(ctaAny.pageId) ?? href;
    target = "_self";
    rel = "";
    external = false;
  } else if (ctaAny.pageSlug) {
    const cleaned = ctaAny.pageSlug.replace(/^\/+/, "").replace(/\/+$/, "");
    if (slugLinks.has(cleaned)) {
      href = slugLinks.get(cleaned) ?? href;
      target = "_self";
      rel = "";
      external = false;
    }
  } else if (ctaAny.url && ctaAny.mode === "redirect") {
    const rawUrl = ctaAny.url.trim();
    const isAbsolute = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("//");
    const isMailto = rawUrl.startsWith("mailto:") || rawUrl.startsWith("tel:");
    if (!isAbsolute && !isMailto) {
      const cleaned = rawUrl.replace(/^\/+/, "").replace(/\/+$/, "");
      if (slugLinks.has(cleaned)) {
        href = slugLinks.get(cleaned) ?? href;
        target = "_self";
        rel = "";
        external = false;
      }
    }
  }

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      data-ff-anim={anim ?? "fade-up"}
      data-ff-cta
      className={`ff-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-bold no-underline rounded-lg ${className}`}
    >
      {cta.label}
      {external && <ExternalLink size={13} />}
    </a>
  );
}

