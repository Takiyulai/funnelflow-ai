// components/funnel/FunnelPreview.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
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
import { getTemplateButtonAnim, getTemplateDefaultIcon } from "@/lib/funnels/templates";
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
import { getMedia, IDB_MEDIA_PREFIX } from "@/lib/store/mediaStore";
import { RawHtmlRenderer } from "@/components/funnel/sections/RawHtmlRenderer";

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
  /** 🆕 Mode édition : active l'annotation des éléments raw-html pour le scroll-to. */
  editMode?: boolean;
}

const SUCCESS_PAGE_ROLES: ReadonlySet<PageRole> = new Set<PageRole>([
  "thankyou",
  "delivery",
  "confirmation",
]);

const BULLET_LAYOUT_SECTIONS = new Set<string>([
  "benefits",
  "benefit",
  "features",
  "feature",
  "stats",
  "numbers",
  "metrics",
  "kpi",
  // 🆕 Plus de listes regroupées en blocs/cards (numérotées pour les étapes).
  "solution",
  "problem",
  "process",
  "program",
  "qualification",
  "steps",
  "method",
  "modules",
  "curriculum",
  "included",
  "deliverables",
  "bonus",
  "about",
]);

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

function useResolvedBackgroundUrl(rawUrl: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(
    rawUrl && !rawUrl.startsWith(IDB_MEDIA_PREFIX) ? rawUrl : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    if (!rawUrl) {
      setResolved(undefined);
      return;
    }
    if (!rawUrl.startsWith(IDB_MEDIA_PREFIX)) {
      setResolved(rawUrl);
      return;
    }
    const id = rawUrl.slice(IDB_MEDIA_PREFIX.length);
    getMedia(id)
      .then((data) => {
        if (!cancelled) setResolved(data ?? undefined);
      })
      .catch((err) => {
        console.warn("[FunnelPreview] background getMedia échec:", err);
        if (!cancelled) setResolved(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [rawUrl]);

  return resolved;
}

function buildBackgroundStyle(
  section: FunnelSection,
  resolvedImageUrl?: string,
): {
  containerStyle: React.CSSProperties;
  hasBackgroundImage: boolean;
  overlayOpacity: number;
  overlayColor: string;
} {
  const bg = section.background;
  if (!bg?.imageUrl && !bg?.overlayOpacity && !bg?.overlay) {
    return {
      containerStyle: {},
      hasBackgroundImage: false,
      overlayOpacity: 0,
      overlayColor: "#000000",
    };
  }

  const overlayColor = bg?.overlayColor ?? "#000000";
  const overlayOpacity =
    typeof bg?.overlayOpacity === "number"
      ? Math.min(100, Math.max(0, bg.overlayOpacity))
      : typeof bg?.overlay === "number"
        ? Math.min(100, Math.max(0, bg.overlay * 100))
        : 0;

  const finalUrl = resolvedImageUrl ?? bg?.imageUrl;
  const hasBackgroundImage = !!finalUrl;

  const containerStyle: React.CSSProperties = {};
  if (hasBackgroundImage) {
    containerStyle.backgroundImage = `url("${finalUrl}")`;
    containerStyle.backgroundSize = bg?.size ?? "cover";
    containerStyle.backgroundPosition = bg?.position ?? "center";
    containerStyle.backgroundRepeat = "no-repeat";
    if (bg?.attachment === "fixed") {
      containerStyle.backgroundAttachment = "fixed";
    }
    if (bg?.blur && bg.blur > 0) {
      (containerStyle as Record<string, unknown>)["--ff-bg-blur"] = `${bg.blur}px`;
    }
  }

  return {
    containerStyle,
    hasBackgroundImage,
    overlayOpacity,
    overlayColor,
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

function splitBulletValueLabel(
  raw: string,
): { value: string; label: string } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(.+?)\s*(?:\||—|–|::)\s*(.+?)\s*$/);
  if (!m) return null;
  const value = m[1].trim();
  const label = m[2].trim();
  if (!value || !label) return null;
  if (value.length > 12) return null;
  return { value, label };
}

function splitBulletTitleDescription(
  raw: string,
): { title: string; description: string } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(.+?)\s*(?:\||—|–|::)\s*(.+?)\s*$/);
  if (!m) return null;
  const title = m[1].trim();
  const description = m[2].trim();
  if (!title || !description) return null;
  if (description.length < 20) return null;
  return { title, description };
}

function bulletsFitInlineStrip(bullets: string[]): boolean {
  if (bullets.length < 2 || bullets.length > 6) return false;
  return bullets.every((b) => splitBulletValueLabel(b) !== null);
}

function decideBulletsMode(
  sectionType: string,
  bullets: string[],
  isSuccess: boolean,
): BulletsMode {
  if (isSuccess) return "list";
  // 🆕 B2 : bullets du HERO en bande « | » UNIQUEMENT si le calcul le permet
  // (≤4 puces, peu de mots / chiffres) ; sinon liste verticale.
  if (sectionType === "hero") {
    return bulletsFitInlineStrip(bullets) ? "inline-strip" : "list";
  }
  if (BULLET_LIST_ONLY_SECTIONS.has(sectionType)) return "list";
  if (!BULLET_LAYOUT_SECTIONS.has(sectionType)) return "list";
  if (bulletsFitInlineStrip(bullets)) return "inline-strip";
  if (bullets.length >= 2) return "grid";
  return "list";
}

/* 🆕 Équilibre d'une section split SANS image mais AVEC cartes (texte d'un
 * côté, cartes de l'autre). On compare la hauteur approximative de la pile de
 * cartes à celle du bloc texte. Si les cartes débordent largement le texte, le
 * côte-à-côte devient laid → on bascule en "stacked" (texte centré en haut,
 * cartes en grille équilibrée dessous). Calcul basé sur la quantité de contenu,
 * jamais codé en dur. */
function splitCardsBalance(section: FunnelSection): "side" | "stacked" {
  const bullets = Array.isArray(section.bullets) ? section.bullets : [];
  const cardCount = bullets.length;
  // 1–2 cartes : toujours équilibré côte-à-côte.
  if (cardCount <= 2) return "side";
  // 🆕 4 cartes et + : la pile déborde toujours le texte → on EMPILE (texte
  // centré en haut, cartes en grille équilibrée 2×N dessous).
  if (cardCount >= 4) return "stacked";
  const textChars =
    (section.headline?.length ?? 0) +
    (section.subheadline?.length ?? 0) +
    (section.body?.length ?? 0);
  // Colonne ≈ 42 caractères/ligne ; +2 lignes pour eyebrow + titre.
  const textLines = Math.ceil(textChars / 42) + 2;
  // Chaque carte ≈ 2.4 lignes de haut (icône + titre + description + padding).
  const cardLines = cardCount * 2.4;
  // 3 cartes : côte-à-côte seulement si le texte est assez long pour équilibrer.
  return cardLines <= textLines * 1.3 ? "side" : "stacked";
}

/* ─── 🆕 Phase 1C : bouton flottant WhatsApp (niveau page) ─────────────── */
//
// Un bouton flottant ne peut PAS vivre dans l'iframe d'une section clonée
// (position:fixed s'y cale sur la hauteur du contenu, pas sur l'écran). On
// extrait donc le 1er lien wa.me / api.whatsapp.com des sections raw-html et
// on rend un vrai bouton fixe AU-DESSUS des iframes, uniquement côté public.

function extractWhatsAppLink(
  sections: Array<FunnelSection | undefined>,
): string | null {
  for (const s of sections) {
    if (!s || s.type !== "raw-html" || !s.body) continue;
    const body = s.body;

    // 1) Lien explicite : href contenant wa.me / *.whatsapp.com / whatsapp://
    const hrefMatch = body.match(
      /href\s*=\s*["']([^"']*(?:wa\.me|whatsapp\.com|whatsapp:\/\/)[^"']*)["']/i,
    );
    if (hrefMatch && hrefMatch[1]) {
      return hrefMatch[1].replace(/&amp;/g, "&");
    }

    // 2) Widget JS sans href : on reconstruit wa.me depuis un numéro trouvé
    //    (wa.me/<num>, whatsapp.com/send?phone=<num>, ?phone=<num>,
    //     data-phone="<num>", data-number="<num>").
    const phoneMatch = body.match(
      /(?:wa\.me\/|whatsapp\.com\/send\?phone=|[?&]phone=|data-(?:phone|number|wa)\s*=\s*["'])\s*\+?(\d[\d\s().-]{6,}\d)/i,
    );
    if (phoneMatch && phoneMatch[1]) {
      const digits = phoneMatch[1].replace(/\D/g, "");
      if (digits.length >= 7) return `https://wa.me/${digits}`;
    }
  }
  return null;
}

function WhatsAppFloat({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="ff-whatsapp-float"
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: 2147483000,
        width: "60px",
        height: "60px",
        borderRadius: "50%",
        background: "#25D366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
        textDecoration: "none",
      }}
    >
      <svg viewBox="0 0 32 32" width="34" height="34" fill="#fff" aria-hidden="true">
        <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.6h.01c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.8-12.8-12.8zm0 23.04h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.62 10.62 0 0 1-1.63-5.67c0-5.87 4.78-10.64 10.66-10.64 2.85 0 5.52 1.11 7.53 3.12a10.57 10.57 0 0 1 3.12 7.53c0 5.87-4.78 10.64-10.65 10.64zm5.84-7.97c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.66 0 1.57 1.14 3.08 1.3 3.29.16.21 2.25 3.44 5.46 4.82.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37z" />
      </svg>
    </a>
  );
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
  editMode = false,
}: FunnelPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(
    forcedMode === "raw" ? "desktop" : (forcedMode ?? defaultMode),
  );
  const isRaw = forcedMode === "raw";
  const activeMode: PreviewMode = isRaw ? "desktop" : (forcedMode ?? mode);

  const isEmbed = viewportHeight === "auto";

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
    editMode,
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
        // 🆕 maxHeight (et non height fixe) : la zone d'aperçu épouse la hauteur
        // réelle du tunnel. Plus de bande grise vide sous le footer pour les
        // pages courtes ; les pages longues scrollent jusqu'à la limite.
        maxHeight: viewportHeight,
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
  editMode?: boolean;
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

function shouldRenderHeader(
  funnel: Funnel,
  activePage: FunnelPage | undefined,
): boolean {
  const header = funnel.header;
  if (header?.enabled === false) return false;
  if (!funnel.pages || funnel.pages.length === 0) return true;
  if (header?.showOnSecondaryPages === true) return true;
  const homePage = funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
  if (!activePage) return true;
  return activePage.id === homePage.id;
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
  editMode,
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
  editMode?: boolean;
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

  const isClonedFunnel = Boolean(
    (funnel.meta as { clonedHead?: string } | undefined)?.clonedHead,
  );

  // 🆕 Bouton flottant WhatsApp : niveau page, côté public uniquement.
  const whatsAppLink =
    !editMode && isClonedFunnel
      ? extractWhatsAppLink([heroSection, ...otherSections])
      : null;

  return (
    <div>
      {!isClonedFunnel && shouldRenderHeader(funnel, activePage) && (
        <FunnelHeader funnel={funnel} logoSrc={logoSrc} />
      )}

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
          editMode={editMode}
        />
      ))}

      {!isClonedFunnel && <FunnelFooter funnel={funnel} />}

      {whatsAppLink && <WhatsAppFloat href={whatsAppLink} />}
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
  const resolvedBgUrl = useResolvedBackgroundUrl(section.background?.imageUrl);
  const bg = buildBackgroundStyle(section, resolvedBgUrl);
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
      {bg.hasBackgroundImage && bg.overlayOpacity > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: bg.overlayColor,
            opacity: bg.overlayOpacity / 100,
          }}
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
              defaultIconName={
                section.iconName ||
                getTemplateDefaultIcon(
                  (funnel.meta as { templateId?: string } | undefined)?.templateId
                )
              }
              iconSize={section.iconSize ?? "md"}
              iconAnim={section.iconAnimation ?? "none"}
              animations={section.animations}
              bodySize={bodySize}
              isSuccess={isSuccess}
              sectionType={section.type as string}
              shadowSize={shadowSize}
              numbered={section.style?.numberedBullets}
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
  editMode,
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
  editMode?: boolean;
}) {
  // 🆕 Early-return pour les sections HTML brutes (clonage de tunnel) :
  // affichage dans une iframe sandboxée, pas de layout standard.
  // editMode est propagé pour activer les annotations data-ff-spot-id
  // permettant le scroll-to depuis le panneau d'édition.
  if (section.type === "raw-html") {
    const clonedMeta = funnel.meta as
      | {
          clonedHead?: string;
          clonedBody?: { className?: string; id?: string; style?: string };
        }
      | undefined;
    const clonedHead = clonedMeta?.clonedHead;
    const clonedBody = clonedMeta?.clonedBody;
    return (
      <section
        id={section.id}
        data-ff-section="raw-html"
        data-ff-section-id={section.id}
        className="ff-section relative"
        style={{ padding: 0, margin: 0, background: "transparent" }}
      >
        <RawHtmlRenderer
          section={section}
          clonedHead={clonedHead}
          clonedBody={clonedBody}
          editMode={editMode}
        />
      </section>
    );
  }

  const isForm = section.type === "form";
  const resolvedImage = resolveImageUrl(section.image, mediaLibrary);
  const colors: SectionColors = getSectionColors(section);
  const { size: shadowSize, color: shadowColor } = readShadow(section);
  const shadowAttr = shadowSize !== "none" ? shadowSize : undefined;
  const resolvedBgUrl = useResolvedBackgroundUrl(section.background?.imageUrl);
  const bg = buildBackgroundStyle(section, resolvedBgUrl);
  const useSpecialized = usesSpecializedRenderer(section);
  const decoIcons = section.decorativeIcons;
  const edges = hasDecorativeAtEdge(decoIcons);

  const rawLayout = isSuccess
    ? "success-centered"
    : effectiveLayoutVariant(section, funnel);
  const isSplit =
    rawLayout === "split-text-image" || rawLayout === "split-image-text";
  const bulletsArr: string[] = Array.isArray(section.bullets)
    ? section.bullets
    : [];
  const hasBullets = bulletsArr.length > 0;
  const hasImg = !!resolvedImage || !!section.video?.url;
  // Split sans image : si on a des cartes/puces, on les envoie dans la colonne
  // libre (texte d'un côté, cartes de l'autre). Sinon on retombe sur "centered".
  // 🆕 Mais si les cartes débordent largement le texte (déséquilibre), on
  // restructure : texte centré en haut + cartes en grille équilibrée dessous.
  const cardsBalance =
    isSplit && !hasImg && hasBullets ? splitCardsBalance(section) : "side";
  const splitTextOnly =
    isSplit && !hasImg && hasBullets && cardsBalance === "side";
  const stackedFromSplit =
    isSplit && !hasImg && hasBullets && cardsBalance === "stacked";
  const layout =
    (isSplit && !hasImg && !hasBullets) || stackedFromSplit
      ? "centered"
      : rawLayout;

  // 🆕 Mode des bullets au niveau section : forcé en "grid" (cartes) quand on
  // restructure un split déséquilibré, sinon décidé normalement.
  const sectionBulletsMode: BulletsMode = hasBullets
    ? stackedFromSplit
      ? "grid"
      : decideBulletsMode(section.type as string, bulletsArr, isSuccess)
    : "list";
  // 🆕 Une liste à puces simple sous un bloc centré est encapsulée dans UNE
  // card centrée (cohérence visuelle au lieu d'une liste alignée à gauche).
  const wrapListInCard =
    !useSpecialized &&
    hasBullets &&
    sectionBulletsMode === "list" &&
    layout === "centered" &&
    !isSuccess &&
    section.type !== "hero";

  return (
    <section
      id={section.id}
      data-ff-section={section.type}
      data-ff-section-id={section.id}
      data-ff-layout={layout}
      data-ff-split-mode={splitTextOnly ? "text" : undefined}
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
      {bg.hasBackgroundImage && bg.overlayOpacity > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: bg.overlayColor,
            opacity: bg.overlayOpacity / 100,
          }}
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
          hasBullets &&
          (() => {
            const list = (
              <BulletsList
                bullets={bulletsArr}
                bulletIcons={section.bulletIcons}
                defaultIconName={
                  section.iconName ||
                  getTemplateDefaultIcon(
                    (funnel.meta as { templateId?: string } | undefined)?.templateId
                  )
                }
                iconSize={section.iconSize ?? "md"}
                iconAnim={section.iconAnimation ?? "none"}
                animations={section.animations}
                bodySize={bodySize}
                isSuccess={isSuccess}
                sectionType={section.type as string}
                shadowSize={shadowSize}
                numbered={section.style?.numberedBullets}
                forceMode={stackedFromSplit ? "grid" : undefined}
              />
            );
            return wrapListInCard ? (
              <div className="ff-list-card" data-ff-shadow={shadowAttr}>
                {list}
              </div>
            ) : (
              list
            );
          })()}

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

        {/* 🆕 CTA secondaire : lien discret « Non merci, continuer » (OTO). */}
        {section.secondaryCta?.label &&
          (() => {
            const sc = section.secondaryCta!;
            let href = "#";
            if (sc.pageId && pageLinks.has(sc.pageId)) {
              href = pageLinks.get(sc.pageId) ?? "#";
            } else if (sc.url) {
              href = sc.url;
            }
            return (
              <div className="ff-decline-wrap">
                <a href={href} className="ff-decline-link" data-ff-decline="true">
                  {sc.label}
                </a>
              </div>
            );
          })()}

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
  numbered,
  forceMode,
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
  /** 🆕 Cartes/puces numérotées (1, 2, 3…) au lieu d'icônes. */
  numbered?: boolean;
  /** 🆕 Force le mode de rendu (ex: "grid" quand on restructure un split
   * déséquilibré en pile texte-centré + cartes dessous). */
  forceMode?: BulletsMode;
}) {
  const DefaultBulletIcon = getIconByName(defaultIconName);
  const mode = forceMode ?? decideBulletsMode(sectionType, bullets, isSuccess);
  const shadowAttr =
    shadowSize && shadowSize !== "none" ? shadowSize : undefined;

  const modeClass =
    mode === "grid"
      ? "ff-bullets--grid"
      : mode === "inline-strip"
        ? "ff-bullets--inline-strip"
        : "";

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
          const split = splitBulletTitleDescription(bullet);
          return (
            <li
              key={i}
              data-ff-anim={animOf(animations, "bullets", "fade-up")}
              className={bodySize}
            >
              {numbered ? (
                <span
                  className="ff-bullet-num shrink-0"
                  data-ff-icon-anim={iconAnim}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              ) : (
                <PerBulletIcon
                  data-ff-icon-size={iconSize}
                  data-ff-icon-anim={iconAnim}
                  className="ff-bullet-ic shrink-0"
                  style={{ color: "var(--ff-accent, #31845C)" }}
                  aria-hidden="true"
                />
              )}
              {split ? (
                <span className="flex flex-col gap-1">
                  <strong className="font-semibold">{split.title}</strong>
                  <RichText
                    as="span"
                    text={split.description}
                    className="opacity-80 text-[0.95em]"
                  />
                </span>
              ) : (
                <RichText as="span" text={bullet} />
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      data-ff-bullets="stagger"
      data-ff-bullets-mode="list"
      className={`ff-bullets space-y-3 mb-3 list-none pl-0 ${
        isSuccess ? "inline-block text-left" : ""
      }`}
    >
      {bullets.map((bullet, i) => {
        const PerBulletIcon = bulletIcons?.[i]
          ? getIconByName(bulletIcons[i] as string)
          : DefaultBulletIcon;
        const split = splitBulletTitleDescription(bullet);
        return (
          <li
            key={i}
            data-ff-anim={animOf(animations, "bullets", "fade-up")}
            className={`flex items-start gap-2 ${bodySize}`}
            style={{ opacity: 0.95 }}
          >
            {numbered ? (
              <span
                className="ff-bullet-num ff-bullet-num--sm shrink-0 mt-0.5"
                data-ff-icon-anim={iconAnim}
                aria-hidden="true"
              >
                {i + 1}
              </span>
            ) : (
              <PerBulletIcon
                data-ff-icon-size={iconSize}
                data-ff-icon-anim={iconAnim}
                className="ff-bullet-ic shrink-0 mt-0.5 w-4 h-4"
                style={{ color: "var(--ff-accent, #31845C)" }}
                aria-hidden="true"
              />
            )}
            {split ? (
              <span className="flex flex-col gap-0.5">
                <strong className="font-semibold">{split.title}</strong>
                <RichText
                  as="span"
                  text={split.description}
                  className="opacity-80 text-[0.95em]"
                />
              </span>
            ) : (
              <RichText as="span" text={bullet} />
            )}
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
  if (cta.mode === "popup") {
    return (
      <PopupForm
        cta={cta}
        section={section}
        funnel={funnel}
        page={page}
        customFields={cta.popupFields}
        buttonClassName={`ff-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-bold no-underline rounded-lg ${className}`}
        buttonProps={{ "data-ff-anim": anim ?? "fade-up" } as React.ButtonHTMLAttributes<HTMLButtonElement>}
      />
    );
  }

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
