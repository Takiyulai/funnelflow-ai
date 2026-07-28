// components/funnel/FunnelPreview.tsx
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Monitor,
  Smartphone,
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
  Language,
  MediaItem,
  PageRole,
  SectionAnimations,
  SectionColors,
  SectionImage,
  TimerItem,
} from "@/lib/funnels/types";
import { getVideoEmbed } from "@/lib/funnels/video";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { TemplateThemeProvider } from "@/components/funnel/TemplateThemeProvider";
import { effectiveLayoutVariant } from "@/lib/funnels/resolveMedia";
import { getTemplateButtonAnim, getTemplateDefaultIcon } from "@/lib/funnels/templates";
import { contrastInk } from "@/lib/funnels/color";
import { assignCardVariants } from "@/lib/funnels/sectionVariants";
import FunnelFooter from "@/components/funnel/FunnelFooter";
import FunnelHeader from "@/components/funnel/FunnelHeader";
import { getIconByName } from "@/components/editor/IconPicker";
import { RichText } from "@/components/funnel/RichText";
import { FaqRenderer } from "@/components/funnel/sections/FaqRenderer";
import { TestimonialsRenderer } from "@/components/funnel/sections/TestimonialsRenderer";
import { PricingRenderer } from "@/components/funnel/sections/PricingRenderer";
import { BonusRenderer } from "@/components/funnel/sections/BonusRenderer";
import { GuaranteeRenderer } from "@/components/funnel/sections/GuaranteeRenderer";
import { BenefitsRenderer } from "@/components/funnel/sections/BenefitsRenderer";
import { CtaFinalRenderer } from "@/components/funnel/sections/CtaFinalRenderer";
import { StatsRenderer, isStatsPattern } from "@/components/funnel/sections/StatsRenderer";
import { ProblemRenderer, isProblemPattern } from "@/components/funnel/sections/ProblemRenderer";
import { ProcessRenderer, isProcessPattern } from "@/components/funnel/sections/ProcessRenderer";
import { TrustbarRenderer, isTrustbarPattern } from "@/components/funnel/sections/TrustbarRenderer";
import { FormRenderer } from "@/components/funnel/sections/FormRenderer";
import { HeroRenderer, isHeroPattern } from "@/components/funnel/sections/HeroRenderer";
import {
  DecorativeIconsLayer,
  InlineDecorativeIcon,
} from "@/components/funnel/DecorativeIconsLayer";
import { TimerRenderer } from "@/components/funnel/sections/TimerRenderer";
import { CtaLink } from "@/components/funnel/CtaLink";
import { SuccessChannels } from "@/components/funnel/SuccessChannels";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { getTemplateSkin } from "@/components/funnel/templates/skins";
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
  /** 🆕 Clé opt-in : à chaque CHANGEMENT de valeur (ex : templateId), déclenche
   *  un défilement automatique fluide de haut en bas de la zone d'aperçu, pour
   *  montrer tout le contenu sans scroll manuel (wizard "Live preview"
   *  uniquement — undefined ailleurs = aucun comportement, zéro impact sur les
   *  autres usages de FunnelPreview). Respecte prefers-reduced-motion. */
  autoScrollDemoKey?: string | number;
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

// 🆕 Effets "wow" des pages de remerciement (thankyou/confirmation/delivery) :
// une barre qui charge de 0 à 100% sous le badge, et une salve de confettis
// façon célébration de but au moment où la page apparaît. CSS-only pour la
// barre (fiable, rejouable sans JS) ; confettis = particules générées UNE
// fois au montage (positions/couleurs figées via un lazy initializer, jamais
// recalculées au re-render) animées en pur CSS. Respecte
// prefers-reduced-motion : rien n'est rendu si l'utilisateur l'a demandé.
// 🆕 Effets "wow" volontairement DÉCOUPLÉS de prefers-reduced-motion : ce sont
// des effets opt-in choisis par le créateur (menu « Effet d'arrivée »). Beaucoup
// d'appareils (mode économie d'énergie Android, « réduire les animations »)
// activent reduced-motion et masquaient alors totalement l'effet.
const CONFETTI_COLORS = ["#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899"];

type ConfettiPiece = {
  id: number;
  dx: number;
  dy: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  round: boolean;
};

function makeConfettiPieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    // Rayon réduit → les confettis restent DANS la section (overflow:hidden).
    const distance = 40 + Math.random() * 56;
    return {
      id: i,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      delay: Math.round(Math.random() * 220) / 1000,
      duration: 0.9 + Math.random() * 0.6,
      size: 5 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.round(Math.random() * 720 - 360),
      round: i % 3 === 0,
    };
  });
}

/** Salve de confettis centrée sur son conteneur (le badge de succès). */
function SuccessConfetti() {
  const [particles] = useState(() => makeConfettiPieces(30));
  return (
    <div aria-hidden className="ff-confetti-burst">
      {particles.map((p) => (
        <span
          key={p.id}
          className="ff-confetti-piece"
          style={{
            ["--fc-dx" as string]: `${p.dx}px`,
            ["--fc-dy" as string]: `${p.dy}px`,
            ["--fc-delay" as string]: `${p.delay}s`,
            ["--fc-duration" as string]: `${p.duration}s`,
            ["--fc-rotate" as string]: `${p.rotate}deg`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}

/** Barre fine sous le badge de succès, qui charge de 0 à 100% à l'affichage.
 *  🆕 Pilotée en JS (requestAnimationFrame) : elle REPART de 0 à chaque montage
 *  et anime réellement jusqu'à 100% — l'ancienne version CSS « one-shot »
 *  laissait la barre pleine dès qu'un utilisateur arrivait après la fin. */
function SuccessProgressBar() {
  // 🆕 Animation 100 % CSS (fiable, insensible aux re-render du preview qui
  // annulaient le requestAnimationFrame). Le remplissage 0 → 100 % est piloté par
  // le keyframe `ff-success-progress-fill` (voir funnel-theme.css), ralenti à
  // 5,5 s et en vert.
  return (
    <div className="ff-success-progress-wrap" aria-hidden>
      <div className="ff-success-progress">
        <div className="ff-success-progress-fill" />
      </div>
      {/* Repères 0% / 100% aux extrémités uniquement. */}
      <div className="ff-success-progress-labels">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
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

  // 🆕 FIX : le fallback tombait sur bg.imageUrl BRUT même quand c'était une
  // référence "idb-media://…" pas encore résolue (ou dont la résolution a
  // échoué) — le navigateur reçoit alors un backgroundImage littéralement
  // invalide (`url("idb-media://…")`), silencieusement ignoré : l'image
  // n'apparaît jamais, même si l'upload lui-même a réussi. On n'utilise le
  // brut en fallback QUE s'il ne s'agit PAS d'une référence IDB — sinon on
  // attend la résolution async (useResolvedBackgroundUrl) avant d'afficher.
  const rawUrl = bg?.imageUrl;
  const rawIsUsable = !!rawUrl && !rawUrl.startsWith(IDB_MEDIA_PREFIX);
  const finalUrl = resolvedImageUrl ?? (rawIsUsable ? rawUrl : undefined);
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
  const t = section.type as string;
  // 🆕 Benefits : rendu spécialisé (patterns) UNIQUEMENT s'il a un pattern ET des
  // puces. Sans pattern → rendu inline historique (aucune régression).
  if (t === "benefits") {
    return (
      !!section.pattern &&
      Array.isArray(section.bullets) &&
      section.bullets.length > 0
    );
  }
  // 🆕 CTA final : spécialisé uniquement s'il a un pattern (sinon rendu inline).
  if (t === "cta") return !!section.pattern;
  // 🆕 Stats : une section proof à pattern stats-* rend depuis les puces (pas
  // d'items) → rendu spécialisé dédié, avant le contrôle "items" ci-dessous.
  if (
    t === "proof" &&
    (isStatsPattern(section.pattern) || isTrustbarPattern(section.pattern)) &&
    Array.isArray(section.bullets) &&
    section.bullets.length > 0
  ) {
    return true;
  }
  // 🆕 Problème/Agitation + Process : rendu spécialisé (patterns) uniquement s'il
  // y a un pattern connu ET des puces. Sans pattern → rendu inline historique.
  if (
    (t === "problem" || t === "agitation") &&
    isProblemPattern(section.pattern) &&
    Array.isArray(section.bullets) &&
    section.bullets.length > 0
  ) {
    return true;
  }
  if (
    t === "process" &&
    isProcessPattern(section.pattern) &&
    Array.isArray(section.bullets) &&
    section.bullets.length > 0
  ) {
    return true;
  }
  if (!Array.isArray(section.items) || section.items.length === 0) return false;
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
 * 🆕 FIX « titre affiché deux fois ».
 *
 * SectionBlock rend l'en-tête générique (eyebrow / titre / sous-titre) PUIS
 * délègue le contenu à SpecializedContent. Or plusieurs familles de patterns
 * composent LEUR PROPRE en-tête (mise en page centrée, largeur max, alignement
 * propres au pattern) : le titre — et le sous-titre quand il existe —
 * apparaissaient donc EN DOUBLE sur toutes les sections FAQ, bénéfices, CTA
 * final, pricing, témoignages et stats.
 *
 * Cette fonction dit quelles parties de l'en-tête le rendu spécialisé prend
 * déjà en charge, pour que le bloc générique ne les répète pas. Elle suit
 * exactement le routage de SpecializedContent : toute évolution de l'un doit
 * être répercutée sur l'autre.
 */
type OwnHeaderParts = { eyebrow: boolean; headline: boolean; subheadline: boolean };
const NO_OWN_HEADER: OwnHeaderParts = { eyebrow: false, headline: false, subheadline: false };
const TITLE_ONLY: OwnHeaderParts = { eyebrow: false, headline: true, subheadline: true };
const FULL_HEADER: OwnHeaderParts = { eyebrow: true, headline: true, subheadline: true };

function specializedOwnHeader(section: FunnelSection): OwnHeaderParts {
  if (!usesSpecializedRenderer(section)) return NO_OWN_HEADER;
  const t = section.type as string;
  // Toujours routés vers un pattern (défaut inclus), tous porteurs d'un en-tête.
  if (t === "faq" || t === "benefits" || t === "cta") return TITLE_ONLY;
  // proof + stats : seule famille dont le pattern rend AUSSI l'eyebrow.
  if (t === "proof" && isStatsPattern(section.pattern)) return FULL_HEADER;
  // proof + trustbar : contenu seul, aucun en-tête → le générique reste.
  if (t === "proof" && isTrustbarPattern(section.pattern)) return NO_OWN_HEADER;
  // Pricing/offer et témoignages : pattern UNIQUEMENT si section.pattern est
  // renseigné (sinon rendu historique sans en-tête).
  if (t === "pricing" || t === "offer") return section.pattern ? TITLE_ONLY : NO_OWN_HEADER;
  if (t === "testimonials" || t === "proof") return section.pattern ? TITLE_ONLY : NO_OWN_HEADER;
  // bonus, guarantee, problem/agitation, process : contenu seul.
  return NO_OWN_HEADER;
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

/**
 * 🆕 Libellé du CTA "étape suivante" affiché sur les pages de succès, adapté
 * au rôle de la page qui suit (delivery/access/replay… sinon générique).
 */
function nextStepLabel(lang: string | undefined, role: PageRole | undefined): string {
  const L = lang === "en" ? "en" : lang === "es" ? "es" : "fr";
  const byRole: Partial<Record<PageRole, Record<"fr" | "en" | "es", string>>> = {
    delivery: { fr: "Accéder à mon contenu", en: "Access my content", es: "Acceder a mi contenido" },
    access: { fr: "Accéder à mon contenu", en: "Access my content", es: "Acceder a mi contenido" },
    replay: { fr: "Voir le replay", en: "Watch the replay", es: "Ver el replay" },
    checkout: { fr: "Passer au paiement", en: "Go to checkout", es: "Ir al pago" },
    upsell: { fr: "Voir l'offre suivante", en: "See the next offer", es: "Ver la siguiente oferta" },
  };
  const generic = { fr: "Continuer", en: "Continue", es: "Continuar" };
  return (role && byRole[role]?.[L]) ?? generic[L];
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
  autoScrollDemoKey,
}: FunnelPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(
    forcedMode === "raw" ? "desktop" : (forcedMode ?? defaultMode),
  );
  const isRaw = forcedMode === "raw";
  const activeMode: PreviewMode = isRaw ? "desktop" : (forcedMode ?? mode);

  const isEmbed = viewportHeight === "auto";

  // 🆕 Showcase auto-scroll (wizard "Live preview") : à chaque changement de
  // `autoScrollDemoKey` (ex : templateId), on fait défiler la zone d'aperçu
  // de haut en bas, doucement, pour que l'utilisateur voie tout le contenu
  // sans avoir à scroller lui-même. Opt-in : sans la prop, aucun effet.
  //
  // 🆕 FIX RÉGRESSION : la version précédente pilotait l'animation via une
  // boucle requestAnimationFrame() manuelle (el.scrollTop += à chaque frame).
  // Vérifié en direct : rAF ne se déclenche QUE si la page/l'onglet est au
  // premier plan — dans certains contextes (onglet en arrière-plan, fenêtre
  // non focus, embed dans un contexte automatisé) le navigateur planifie la
  // frame mais ne l'exécute JAMAIS, donc l'animation ne partait jamais alors
  // que le code s'exécutait correctement (aucune erreur console). On utilise
  // maintenant scrollTo({ behavior:"smooth" }) natif, piloté par de simples
  // setTimeout — aucune dépendance à rAF, fonctionne même onglet non focus.
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (autoScrollDemoKey === undefined || autoScrollDemoKey === null) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let cancelled = false;
    let started = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runScroll = (el: HTMLDivElement, distance: number) => {
      if (started) return;
      started = true;
      el.scrollTo({ top: 0, behavior: "auto" });
      // Visite guidée en plusieurs étapes (scroll natif fluide), plutôt qu'une
      // seule grande animation d'un coup — plus agréable sur une page longue
      // et beaucoup plus robuste qu'une boucle rAF pilotée à la main.
      const STEPS = 5;
      const STEP_DELAY = 850;
      for (let i = 1; i <= STEPS; i++) {
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            el.scrollTo({ top: (distance * i) / STEPS, behavior: "smooth" });
          }, i * STEP_DELAY),
        );
      }
    };

    // Tentatives à intervalles croissants : le nouveau contenu (template
    // changé → re-render de tout l'arbre de sections) peut ne pas avoir fini
    // de se stabiliser (polices/images en cours de layout) au 1er essai —
    // on RE-VÉRIFIE plusieurs fois jusqu'à trouver une zone scrollable.
    const probeDelays = [200, 500, 900, 1400, 2000];
    probeDelays.forEach((delay) => {
      timers.push(
        setTimeout(() => {
          if (cancelled || started) return;
          const el = scrollRootRef.current;
          if (!el) return;
          const distance = el.scrollHeight - el.clientHeight;
          if (distance > 4) runScroll(el, distance);
        }, delay),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrollDemoKey]);

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
    accentColor?: string;
    accentColor2?: string;
    textScale?: number;
    buttonScale?: number;
    customBg?: string;
    customBgEnabled?: boolean;
    brandColorsEnabled?: boolean;
  };
  const animationsEnabled = design.animationsEnabled !== false;
  const buttonAnim = design.buttonAnim ?? getTemplateButtonAnim(templateId);

  // 🆕 FIX RÉGRESSION : primaryColor/secondaryColor/accentColor ont TOUJOURS
  // une valeur (générée par l'IA, ou valeur par défaut du wizard) — ce n'est
  // PAS un signal fiable que l'utilisateur a personnalisé sa marque. Sans ce
  // garde, TOUS les templates (y compris ceux avec un fond dégradé signature,
  // ex. bold-energy/story-sell) se retrouvaient recolorés vers ces valeurs
  // par défaut/invention IA (souvent un quasi-noir) → perte totale de leur
  // identité visuelle par défaut. On ne recolore fond/cartes/header-footer
  // QUE si `brandColorsEnabled` est explicitement true (checkbox « Utiliser
  // les couleurs de ma marque » cochée par l'utilisateur à l'étape Template).
  const brandingActive = design.brandColorsEnabled === true;

  const overrides = {
    accent: brandingActive ? design.secondaryColor : undefined,
    primary: brandingActive ? design.primaryColor : undefined,
    // 🆕 3ᵉ / 4ᵉ couleurs de marque (branding) → --ff-accent2 / --ff-accent3,
    // consommées par les skins (accent2, priceColor).
    accent2: brandingActive ? design.accentColor : undefined,
    accent3: brandingActive ? design.accentColor2 : undefined,
    // 🆕 BUG CORRIGÉ : design.primaryColor ("couleur sombre/fonds" choisie par
    // l'utilisateur) n'était mappée que sur --ff-primary, une variable JAMAIS
    // consommée par le CSS (fonds de section = --ff-bg, resté au défaut du
    // template). On la pose donc aussi sur --ff-bg pour que le fond du tunnel
    // reflète réellement la couleur choisie — UNIQUEMENT quand la marque est
    // active (voir brandingActive ci-dessus).
    bg: brandingActive ? design.primaryColor : undefined,
    // 🆕 Contraste automatique : le texte principal (--ff-ink) et le texte des
    // boutons (--ff-accent-ink → --ff-btn-ink) basculent noir/blanc selon la
    // luminosité du fond/de l'accent choisis, pour ne jamais rendre un texte
    // ou un CTA illisible sur sa propre couleur. Sans branding actif, ne
    // touche pas --ff-ink : le template garde son contraste par défaut.
    ink: brandingActive ? contrastInk(design.primaryColor) : undefined,
    accentInk: brandingActive ? contrastInk(design.secondaryColor) : undefined,
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

      <div
        ref={scrollRootRef}
        style={innerStyle}
        className={isEmbed ? "ff-fill-col" : undefined}
      >
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
    accent2?: string;
    accent3?: string;
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
    <div ref={containerRef} className="w-full ff-fill-col">
      <TemplateThemeProvider
        templateId={props.templateId}
        buttonAnim={props.buttonAnim}
        animationsEnabled={props.animationsEnabled}
        overrides={props.overrides}
        className="ff-fill-col"
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
  templateId,
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
  templateId?: string;
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

  // 🆕 Skin de template (rendu bespoke DATA-DRIVEN du zip Claude Design).
  // Appliqué AUSSI aux pages de succès (merci/confirmation/livraison) pour que
  // tout le tunnel partage le même design — le skin reçoit isSuccess/pageRole
  // pour le badge ✓ et le centrage. Jamais sur les tunnels clonés.
  const skin = !isClonedFunnel ? getTemplateSkin(templateId) : undefined;
  const SkinHero =
    skin && heroSection ? skin.sections[heroSection.type] : undefined;

  // 🆕 Anti-monotonie : variante de disposition par section « cartes », attribuée
  // de façon déterministe (seedée par le tunnel/page) et ordonnée (jamais deux
  // sections cartes voisines identiques). Passée aux skins via `variant`.
  const cardVariants = assignCardVariants(
    otherSections.map((s) => ({ id: s.id, type: s.type as string })),
    `${funnel.funnelName ?? "tunnel"}:${activePage?.id ?? "home"}`,
  );

  const body = (
    <div className={embed ? "ff-fill-col" : undefined}>
      {!isClonedFunnel && shouldRenderHeader(funnel, activePage) && (
        <FunnelHeader
          funnel={funnel}
          logoSrc={logoSrc}
          page={activePage ?? undefined}
          pageLinks={pageLinks}
          slugLinks={slugLinks}
        />
      )}

      {heroSection &&
        (SkinHero ? (
          <SkinHero
            section={heroSection}
            funnel={funnel}
            page={activePage}
            pageLinks={pageLinks}
            slugLinks={slugLinks}
            compact={compact}
            pageRole={pageRole}
            isSuccess={isSuccess}
          />
        ) : isHeroPattern(heroSection.pattern) && !isSuccess ? (
          <HeroRenderer section={heroSection} funnel={funnel} mode="public" />
        ) : (
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
        ))}

      {otherSections.map((section) => {
        const SkinComp = skin ? skin.sections[section.type] : undefined;
        if (SkinComp) {
          return (
            <SkinComp
              key={section.id}
              section={section}
              funnel={funnel}
              page={activePage}
              pageLinks={pageLinks}
              slugLinks={slugLinks}
              compact={compact}
              pageRole={pageRole}
              isSuccess={isSuccess}
              variant={cardVariants.get(section.id) ?? 0}
            />
          );
        }
        return (
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
        );
      })}

      {/* 🆕 LOT 10 — Order bump : case à cocher pour ajouter un produit
          complémentaire, affichée UNIQUEMENT sur la page de checkout et
          seulement si le créateur l'a configuré au wizard. */}
      {!isClonedFunnel && activePage && activePage.role === "checkout" && activePage.orderBump?.enabled && (
        <OrderBumpBlock orderBump={activePage.orderBump} padX={padX} sectionInner={sectionInner} />
      )}

      {/* 🆕 LOT 7 — Calendrier natif (Calendly/Cal.com) sur la page de RDV. */}
      {!isClonedFunnel && activePage && activePage.role === "booking" && activePage.calendarEmbedUrl && (
        <CalendarEmbedBlock url={activePage.calendarEmbedUrl} padX={padX} sectionInner={sectionInner} />
      )}

      {/* 🆕 LOT 5 — Webinaire Evergreen : choix de créneau + lecteur vidéo
          pré-enregistré sur la page "live" (salle d'attente). */}
      {!isClonedFunnel && activePage && activePage.role === "live" && activePage.evergreenVideoUrl && (
        <EvergreenPlayerBlock
          videoUrl={activePage.evergreenVideoUrl}
          language={funnel.language}
          padX={padX}
          sectionInner={sectionInner}
        />
      )}

      {/* 🆕 Pages de succès : boutons Rejoindre WhatsApp/Telegram + CTA + étape
          suivante du tunnel (si une page existe réellement après celle-ci —
          jamais fabriqué si le tunnel s'arrête ici). */}
      {isSuccess &&
        (() => {
          const pages = funnel.pages ?? [];
          const idx = activePage ? pages.findIndex((p) => p.id === activePage.id) : -1;
          const nextPage =
            (activePage?.nextPageId && pages.find((p) => p.id === activePage.nextPageId)) ||
            (idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : undefined);
          const nextHref = nextPage ? pageLinks.get(nextPage.id) : undefined;
          // 🆕 Bouton « étape suivante » (ex : « Continuer »/« Voir le replay ») :
          // MASQUÉ PAR DÉFAUT (source de confusion, non éditable comme un CTA de
          // section). On ne l'affiche QUE si l'utilisateur l'active explicitement
          // via Style global → Pages de remerciement (hideNextStepCta === false).
          const hideNext = funnel.meta?.hideNextStepCta !== false;
          const nextLbl =
            !hideNext && nextHref
              ? (funnel.meta?.nextStepLabel?.trim() ||
                 nextStepLabel(funnel.language, nextPage?.role))
              : undefined;
          return (
            <SuccessChannels
              funnel={funnel}
              nextHref={hideNext ? undefined : nextHref}
              nextLabel={nextLbl}
            />
          );
        })()}

      {!isClonedFunnel && <FunnelFooter funnel={funnel} />}

      {whatsAppLink && <WhatsAppFloat href={whatsAppLink} />}
    </div>
  );

  // Le wrapper applique le runtime d'animations bespoke (reveal/tilt/parallax/
  // accordéon/countdown) + container-type pour les @container CSS du skin.
  return skin ? (
    <FunnelSectionWrapper className={embed ? "ff-fill-col" : undefined}>
      {body}
    </FunnelSectionWrapper>
  ) : (
    body
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

/**
 * 🆕 LOT 10 — Order bump : bloc case-à-cocher inséré sur la page de checkout,
 * en dehors du système de sections classique (config au niveau de la PAGE).
 * La checkbox porte `data-ff-orderbump-checkbox`, lue par PublicFunnelRuntime
 * au clic sur le CTA d'achat (#ff-checkout) pour informer /api/checkout.
 */
function OrderBumpBlock({
  orderBump,
  padX,
  sectionInner,
}: {
  orderBump: { name: string; price: string; description?: string };
  padX: string;
  sectionInner: string;
}) {
  return (
    <section className={`${padX} py-4`}>
      <div className={sectionInner}>
        <label
          data-ff-orderbump
          className="ff-card flex items-start gap-3 rounded-xl border-2 border-dashed p-4 cursor-pointer transition-colors"
          style={{ borderColor: "var(--ff-accent)" }}
        >
          <input
            type="checkbox"
            data-ff-orderbump-checkbox
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--ff-accent)]"
          />
          <span className="flex-1">
            <span
              className="block text-sm font-bold"
              style={{ color: "var(--ff-ink)" }}
            >
              ✅ Oui, ajoute « {orderBump.name} » à ma commande — {orderBump.price}
            </span>
            {orderBump.description && (
              <span
                className="mt-1 block text-sm opacity-80"
                style={{ color: "var(--ff-ink-soft, var(--ff-ink))" }}
              >
                {orderBump.description}
              </span>
            )}
          </span>
        </label>
      </div>
    </section>
  );
}

/**
 * 🆕 LOT 7 — Embed calendrier natif (Calendly/Cal.com) sur la page de prise
 * de RDV. Rendu en iframe sandboxée ; ne remplace pas le formulaire existant
 * (repli historique conservé), l'ajoute juste au-dessus dans le flux.
 */
function CalendarEmbedBlock({
  url,
  padX,
  sectionInner,
}: {
  url: string;
  padX: string;
  sectionInner: string;
}) {
  return (
    <section className={`${padX} py-4`}>
      <div className={sectionInner}>
        <div
          className="ff-card overflow-hidden rounded-2xl"
          style={{ minHeight: 680 }}
        >
          <iframe
            src={url}
            title="Calendrier de prise de rendez-vous"
            className="h-[680px] w-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

/** 🆕 LOT 5 — Slug du tunnel déduit de l'URL, même convention que
 *  TimerRenderer/FormRenderer/PublicFunnelRuntime pour la clé localStorage. */
function evergreenFunnelSlug(): string {
  if (typeof window === "undefined") return "default";
  const m = window.location.pathname.match(/\/tunnel\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : "default";
}

const EVERGREEN_SLOT_OPTIONS = [
  {
    key: "15min",
    offsetMs: 15 * 60 * 1000,
    label: { fr: "Dans 15 minutes", en: "In 15 minutes", es: "En 15 minutos" },
  },
  {
    key: "1h",
    offsetMs: 60 * 60 * 1000,
    label: { fr: "Dans 1 heure", en: "In 1 hour", es: "En 1 hora" },
  },
  {
    key: "24h",
    offsetMs: 24 * 60 * 60 * 1000,
    label: { fr: "Demain, à la même heure", en: "Tomorrow, same time", es: "Mañana, a la misma hora" },
  },
] as const;

/**
 * 🆕 LOT 5 — Webinaire Evergreen : le prospect choisit un créneau relatif
 * ("dans 15 min", "demain à la même heure"...) au lieu d'une date fixe. Une
 * fois le créneau atteint, la vidéo pré-enregistrée démarre automatiquement.
 * Le choix est mémorisé en localStorage (par tunnel) pour survivre aux
 * rechargements/revisites tant que le créneau n'est pas expiré.
 */
function EvergreenPlayerBlock({
  videoUrl,
  language,
  padX,
  sectionInner,
}: {
  videoUrl: string;
  language: Language;
  padX: string;
  sectionInner: string;
}) {
  const [slug, setSlug] = useState<string>("default");
  const [slot, setSlot] = useState<number | null | undefined>(undefined); // undefined = pas encore lu
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const s = evergreenFunnelSlug();
    setSlug(s);
    try {
      const raw = window.localStorage.getItem(`ff_evergreen_slot_${s}`);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      setSlot(!isNaN(parsed) ? parsed : null);
    } catch {
      setSlot(null);
    }
  }, []);

  useEffect(() => {
    if (!slot || slot <= now) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [slot, now]);

  const pickSlot = (offsetMs: number) => {
    const target = Date.now() + offsetMs;
    setSlot(target);
    try {
      window.localStorage.setItem(`ff_evergreen_slot_${slug}`, String(target));
    } catch {
      /* ignore */
    }
  };

  const resetSlot = () => {
    setSlot(null);
    try {
      window.localStorage.removeItem(`ff_evergreen_slot_${slug}`);
    } catch {
      /* ignore */
    }
  };

  const L = {
    title: { fr: "Choisis ton créneau", en: "Pick your time slot", es: "Elige tu horario" },
    waiting: { fr: "Ta session commence dans", en: "Your session starts in", es: "Tu sesión empieza en" },
    change: { fr: "Changer d'horaire", en: "Change time slot", es: "Cambiar de horario" },
  };
  const t = (obj: Record<Language, string>) => obj[language] ?? obj.fr;

  if (slot === undefined) return null; // évite un flash avant lecture du localStorage

  return (
    <section className={`${padX} py-4`}>
      <div className={sectionInner}>
        {slot === null && (
          <div className="ff-card rounded-2xl p-6 text-center">
            <p className="mb-4 text-lg font-bold" style={{ color: "var(--ff-ink)" }}>
              {t(L.title)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {EVERGREEN_SLOT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => pickSlot(opt.offsetMs)}
                  className="ff-btn rounded-lg px-5 py-3 text-sm font-bold"
                >
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
        )}

        {slot !== null && slot > now && (
          <div className="ff-card rounded-2xl p-6 text-center">
            <TimerRenderer
              timer={{
                id: "evergreen-slot-wait",
                mode: "countdown-date",
                targetDate: new Date(slot).toISOString(),
                label: t(L.waiting),
                style: "cards",
                size: "lg",
                onExpire: "keep-zero",
                showDays: false,
              }}
              language={language}
            />
            <button
              type="button"
              onClick={resetSlot}
              className="mt-3 text-xs font-medium underline opacity-70 hover:opacity-100"
            >
              {t(L.change)}
            </button>
          </div>
        )}

        {slot !== null && slot <= now && (
          <div className="ff-card overflow-hidden rounded-2xl" style={{ minHeight: 360 }}>
            {(() => {
              const embed = getVideoEmbed(videoUrl);
              if (!embed.embedUrl) return null;
              const sep = embed.embedUrl.includes("?") ? "&" : "?";
              const src =
                embed.provider === "youtube" || embed.provider === "vimeo"
                  ? `${embed.embedUrl}${sep}autoplay=1&mute=1`
                  : embed.embedUrl;
              return (
                <div className="relative aspect-video w-full bg-black">
                  <iframe
                    src={src}
                    title="Webinaire (replay automatisé)"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </section>
  );
}

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
  let layout = isSuccess
    ? "success-centered"
    : effectiveLayoutVariant(section, funnel);
  // 🆕 RÈGLE ABSOLUE : image/vidéo + texte dans le héros → split automatique
  // (empilé texte → image → CTA sur mobile via CSS).
  if (
    !isSuccess &&
    (!!resolvedImage || !!section.video?.url) &&
    !!(section.headline || section.subheadline || section.body) &&
    layout !== "split-text-image" &&
    layout !== "split-image-text"
  ) {
    layout = "split-text-image";
  }

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
      data-ff-anim={animOf(section.animations, "headline", "fade-up")}
      data-ff-anim-scope={animOf(section.animations, "headline", "fade-up")}
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
          <>
            <div data-ff-anim="zoom-in" className="ff-success-badge-wrap mb-2 flex justify-center">
              <div
                className="ff-success-icon relative inline-flex items-center justify-center rounded-full"
                style={{
                  width: compact ? 64 : 80,
                  height: compact ? 64 : 80,
                  background: roleIconColors.bg,
                  boxShadow: `0 0 0 6px ${roleIconColors.ring}`,
                }}
              >
                {/* 🆕 Confettis affichés seulement si l'effet le prévoit
                    (funnel.meta.successEffect : both/confetti). */}
                {funnel.meta?.successEffect !== "progress" &&
                  funnel.meta?.successEffect !== "none" && <SuccessConfetti />}
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
            {/* 🆕 Barre de progression seulement si l'effet le prévoit
                (funnel.meta.successEffect : both/progress). */}
            {funnel.meta?.successEffect !== "confetti" &&
              funnel.meta?.successEffect !== "none" && <SuccessProgressBar />}
          </>
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

        {/* 🆕 Liens/CTA supplémentaires (ex : canaux WhatsApp/Telegram/Instagram
            sur une page de remerciement composée uniquement d'un hero). */}
        {Array.isArray(section.ctas) && section.ctas.length > 0 && (
          <div className="ff-extra-ctas">
            {section.ctas.map(
              (extraCta, idx) =>
                extraCta?.label && (
                  <CtaLink
                    key={`${section.id}-extra-${idx}`}
                    cta={extraCta}
                    baseClassName="ff-btn-extra"
                    anim={animOf(section.animations, "cta", "fade-up")}
                    pageLinks={pageLinks}
                    slugLinks={slugLinks}
                    funnel={funnel}
                    page={activePage}
                    section={section}
                  />
                ),
            )}
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

type SectionBlockProps = {
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
};

/**
 * Sections HTML brutes (clonage de tunnel) : affichage dans une iframe
 * sandboxée, pas de layout standard. `editMode` active les annotations
 * data-ff-spot-id qui permettent le scroll-to depuis le panneau d'édition.
 */
function RawHtmlSectionBlock({
  section,
  funnel,
  editMode,
}: Pick<SectionBlockProps, "section" | "funnel" | "editMode">) {
  const clonedMeta = funnel.meta as
    | {
        clonedHead?: string;
        clonedBody?: { className?: string; id?: string; style?: string };
      }
    | undefined;
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
        clonedHead={clonedMeta?.clonedHead}
        clonedBody={clonedMeta?.clonedBody}
        editMode={editMode}
      />
    </section>
  );
}

/**
 * 🆕 FIX rules-of-hooks : le cas `raw-html` était traité par un RETURN ANTICIPÉ
 * à l'intérieur du composant, AVANT l'appel de `useResolvedBackgroundUrl`. Le
 * hook n'était donc pas appelé sur tous les chemins de rendu : dès qu'une
 * section changeait de type entre deux rendus (conversion d'une section clonée
 * dans l'éditeur), l'ordre des hooks de React se décalait — plantage ou état
 * silencieusement corrompu. Le routage se fait désormais AVANT tout composant
 * porteur de hooks : `SectionBlock` n'en appelle aucun, et
 * `StandardSectionBlock` les appelle tous, inconditionnellement.
 */
function SectionBlock(props: SectionBlockProps) {
  if (props.section.type === "raw-html") {
    return (
      <RawHtmlSectionBlock
        section={props.section}
        funnel={props.funnel}
        editMode={props.editMode}
      />
    );
  }
  return <StandardSectionBlock {...props} />;
}

function StandardSectionBlock({
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
}: SectionBlockProps) {
  // NB : `editMode` n'est consommé que par la variante raw-html (voir
  // RawHtmlSectionBlock) — inutile de le déstructurer ici.
  const isForm = section.type === "form";
  const resolvedImage = resolveImageUrl(section.image, mediaLibrary);
  const colors: SectionColors = getSectionColors(section);
  const { size: shadowSize, color: shadowColor } = readShadow(section);
  const shadowAttr = shadowSize !== "none" ? shadowSize : undefined;
  const resolvedBgUrl = useResolvedBackgroundUrl(section.background?.imageUrl);
  const bg = buildBackgroundStyle(section, resolvedBgUrl);
  const useSpecialized = usesSpecializedRenderer(section);
  // 🆕 Quelles parties de l'en-tête le rendu spécialisé compose-t-il lui-même ?
  // (évite le titre/sous-titre affiché deux fois — cf. specializedOwnHeader)
  const ownHeader = specializedOwnHeader(section);
  const decoIcons = section.decorativeIcons;
  const edges = hasDecorativeAtEdge(decoIcons);

  let rawLayout = isSuccess
    ? "success-centered"
    : effectiveLayoutVariant(section, funnel);
  const bulletsArr: string[] = Array.isArray(section.bullets)
    ? section.bullets
    : [];
  const hasBullets = bulletsArr.length > 0;
  const hasImg = !!resolvedImage || !!section.video?.url;
  // 🆕 RÈGLE ABSOLUE : image/vidéo + contenu textuel dans la MÊME section →
  // layout SPLIT automatique (côte à côte). Sur mobile, le CSS empile
  // texte → image → CTA. (Les pages de succès restent centrées.)
  const hasText = !!(
    section.headline ||
    section.subheadline ||
    section.body ||
    hasBullets
  );
  if (
    !isSuccess &&
    hasImg &&
    hasText &&
    rawLayout !== "split-text-image" &&
    rawLayout !== "split-image-text"
  ) {
    rawLayout = "split-text-image";
  }
  const isSplit =
    rawLayout === "split-text-image" || rawLayout === "split-image-text";
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
      data-ff-pattern={section.pattern || undefined}
      data-ff-split-mode={splitTextOnly ? "text" : undefined}
      data-ff-shadow-scope={shadowAttr}
      data-ff-custom-bg={colors.bg ? "true" : undefined}
      data-ff-has-bg-image={bg.hasBackgroundImage ? "true" : undefined}
      data-ff-deco-top={edges.top ? "true" : undefined}
      data-ff-deco-bottom={edges.bottom ? "true" : undefined}
      data-ff-anim={animOf(section.animations, "headline", "fade-up")}
      data-ff-anim-scope={animOf(section.animations, "headline", "fade-up")}
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
        {section.eyebrow && !ownHeader.eyebrow && (
          <RichText
            as="span"
            className="ff-eyebrow text-xs"
            text={section.eyebrow}
            dataAnim={animOf(section.animations, "eyebrow", "fade-in")}
          />
        )}

        {section.headline && !ownHeader.headline && (
          <h2
            data-ff-anim={animOf(section.animations, "headline", "fade-up")}
            className="ff-headline ff-headline-scaled"
          >
            <InlineDecorativeIcon icons={decoIcons} position="before-headline" />
            <RichText as="span" text={section.headline} />
            <InlineDecorativeIcon icons={decoIcons} position="after-headline" />
          </h2>
        )}

        {section.subheadline && !ownHeader.subheadline && (
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

        {/* 🆕 FIX doublon : les sections "cta" avec un `pattern` passent par
            SpecializedContent → CtaFinalRenderer, qui rend DÉJÀ son propre
            bouton (CtaBtn, à partir de ce même `section.cta`). Sans ce garde,
            ce bloc générique rendait un 2ᵉ bouton identique juste en dessous —
            exactement le doublon signalé sur la section d'appel final.
            Scopé STRICTEMENT à "cta" (pas usesSpecializedRenderer en général :
            les autres types spécialisés — pricing/guarantee/bonus/faq… — ne
            rendent PAS leur propre CTA, ce bloc générique reste leur SEUL
            moyen d'afficher un bouton). */}
        {!isForm &&
          !(section.type === "cta" && usesSpecializedRenderer(section)) &&
          section.cta?.label && (
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

        {/* 🆕 Liens/CTA supplémentaires (ex : canaux WhatsApp/Telegram/Instagram
            sur une page de remerciement). */}
        {Array.isArray(section.ctas) && section.ctas.length > 0 && (
          <div className="ff-extra-ctas">
            {section.ctas.map(
              (extraCta, idx) =>
                extraCta?.label && (
                  <CtaLink
                    key={`${section.id}-extra-${idx}`}
                    cta={extraCta}
                    baseClassName="ff-btn-extra"
                    anim={animOf(section.animations, "cta", "fade-up")}
                    pageLinks={pageLinks}
                    slugLinks={slugLinks}
                    funnel={funnel}
                    page={activePage}
                    section={section}
                  />
                ),
            )}
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
  // 🆕 Trustbar : proof + pattern trustbar-* → TrustbarRenderer (avant stats).
  if (sectionType === "proof" && isTrustbarPattern(section.pattern))
    return <TrustbarRenderer section={section} bodySize={bodySize} />;
  // 🆕 Stats : proof + pattern stats-* → StatsRenderer (avant la voie témoignages).
  if (sectionType === "proof" && isStatsPattern(section.pattern))
    return <StatsRenderer section={section} bodySize={bodySize} />;
  // 🆕 Problème/Agitation + Process : patterns dédiés.
  if ((sectionType === "problem" || sectionType === "agitation") && isProblemPattern(section.pattern))
    return <ProblemRenderer section={section} bodySize={bodySize} />;
  if (sectionType === "process" && isProcessPattern(section.pattern))
    return <ProcessRenderer section={section} bodySize={bodySize} />;
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
  if (sectionType === "benefits")
    return <BenefitsRenderer section={section} bodySize={bodySize} />;
  if (sectionType === "cta")
    return <CtaFinalRenderer section={section} bodySize={bodySize} />;
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
  // 🆕 FIX bug visuel « card vide » : une puce vide/blanche (générée par l'IA,
  // ou laissée par l'édition manuelle) ne doit JAMAIS produire une carte
  // fantôme (bordure + icône + padding, sans aucun texte). On filtre les
  // puces blanches AVANT tout rendu, en conservant l'index d'origine pour que
  // `bulletIcons[i]` (indexé sur le tableau BRUT) reste correctement aligné.
  // Ce composant étant partagé par toutes les sections « cartes » (problem,
  // benefits, process, solution, program, stats…), corriger ici évite que le
  // bug ne se reproduise ailleurs.
  const entries = bullets
    .map((bullet, i) => ({ bullet, i }))
    .filter(({ bullet }) => typeof bullet === "string" && bullet.trim().length > 0);

  if (entries.length === 0) return null;

  const cleanBullets = entries.map((e) => e.bullet);
  const DefaultBulletIcon = getIconByName(defaultIconName);
  const mode = forceMode ?? decideBulletsMode(sectionType, cleanBullets, isSuccess);
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
        {entries.map(({ bullet, i }) => {
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
        {entries.map(({ bullet, i }) => {
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
      {entries.map(({ bullet, i }) => {
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

// CtaLink : extrait dans components/funnel/CtaLink.tsx (réutilisé par les
// skins de templates). Comportement identique.
