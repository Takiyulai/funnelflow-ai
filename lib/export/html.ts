// lib/export/html.ts
//
// Export HTML d'un funnel. Stratégie : émettre une structure DOM simple
// (.ff-page > .ff-section > .ff-section-inner) compatible avec les
// contraintes de Systeme.io. Le CSS est fourni par theme-css.ts et
// applique les 9 thèmes visuels via variables CSS sur data-ff-theme.
//
// 🆕 Support des sections RAW HTML (funnels clonés depuis un site externe) :
// si une section a un body commençant par RAW_HTML_BODY_MARKER, on émet
// directement son HTML cloné avec les patches appliqués (sans annotation
// d'édition). Pour un funnel 100 % cloné, on désactive aussi le header
// et le footer AutoFunnel (la page clonée a déjà les siens).
//
// 🆕 CLONED HEAD : pour un funnel 100 % cloné, on n'émet pas le theme-css
// AutoFunnel (qui parasite le rendu) et on injecte à la place le clonedHead
// original (styles + links CSS) stocké dans funnel.meta.clonedHead.
//
// 🆕 FAQ RUNTIME : pour les FAQ clonées (data-ff-faq-grid), on injecte un
// script vanilla qui ferme les FAQ par défaut sur la page publique et
// rétablit l'ouverture/fermeture au clic.
//
// 🆕 NAV PUBLIQUE : quand renderFunnelHtml reçoit `publicSlug`, les CTA en
// mode "page" (cta.pageId) résolvent vers /p/<slug>/<pageSlug>. Sans publicSlug
// (export Systeme.io), comportement inchangé (fallback ancre).

import { strToU8, zipSync } from "fflate";
import type {
  Funnel,
  FunnelSection,
  CtaConfig,
  SectionImage,
  SectionItem,
  FormFieldItem,
  IconName,
  IconConfig,
  SectionColors,
  SectionStyle,
  AnimationPreset,
  FunnelHeader,
  CtaIcon,
  CtaSpacing,
  TimerItem,
} from "@/lib/funnels/types";
import { normalizeIconName, resolveIconSizePx, getHomePage } from "@/lib/funnels/types";
import {
  materializeSectionImage,
  effectiveLayoutVariant,
  isUsableMediaUrl,
  sectionHasSubstantialText,
} from "@/lib/funnels/resolveMedia";
// 🆕 FIX PARITÉ HEADER : badge événement ("En direct le jeudi 9 juillet —
// 19:00"), affiché dans le header live (components/funnel/FunnelHeader.tsx)
// mais jamais porté à l'export. Helper pur (pas de dépendance React), sûr à
// importer côté serveur.
import { formatEventBadge } from "@/lib/funnels/eventDate";
import {
  getFunnelThemeCss,
  getFunnelThemeCssNoGlobalReset,
  getScopedFunnelThemeCss,
  buildThemeRootAttrs,
  getThemeColors,
} from "./theme-css";
import { createReadme } from "./readme";
import { DEFAULT_REASSURANCE } from "@/lib/funnels/types";

// 🆕 RAW HTML — imports pour le rendu des sections clonées
import { RAW_HTML_BODY_MARKER } from "@/lib/clone/section-mapper";
import { applyRawHtmlPatchesServer as applyRawHtmlPatches } from "@/lib/clone/raw-html-apply-patches.server";
import { FAQ_RUNTIME_SCRIPT } from "./faq-script";
// 🆕 Même correctif que l'aperçu : les bibliothèques d'animation « au scroll »
// (Divi `.et_animated`, WOW.js, Elementor…) posent `opacity: 0` par une classe
// que seul leur JS lève. Le clonage retirant ce JS, les éléments concernés —
// typiquement les boutons CTA — restaient invisibles dans le HTML exporté.
import { SCROLL_ANIMATION_REVEAL_CSS } from "@/lib/clone/accordion-runtime";
// 🆕 FIX PARITÉ SKINS — jeux de tokens des 6 templates "factory" (system de
// skins bespoke, components/funnel/templates/skins/factory.tsx), réutilisés
// pour reproduire fidèlement le CTA final et les cartes programme/process dans
// l'export (voir renderSkinCtaFinalSection / renderSkinProcessSection
// ci-dessous). configs.ts est un simple objet de données (aucune dépendance
// React) : sûr à importer côté serveur malgré le "use client" de factory.tsx
// (dont seul le TYPE SkinTokens est importé, effacé à la compilation).
import type { SkinTokens } from "@/components/funnel/templates/skins/factory";
import {
  T2_TOKENS,
  T3_TOKENS,
  T4_TOKENS,
  T5_TOKENS,
  T6_TOKENS,
  T7_TOKENS,
} from "@/components/funnel/templates/skins/configs";

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Contexte de navigation publique (liens inter-pages /p/[slug]/[pageSlug])
// Quand fourni, les CTA en mode "page" (cta.pageId) résolvent vers l'URL
// publique de la page cible. Absent (export Systeme.io) → fallback ancre.
// ─────────────────────────────────────────────────────────────────────────────
type PublicNavContext = {
  /** Slug public du funnel (funnels.published_slug) → base /tunnel/<slug> */
  publicSlug: string;
  /** Map pageId → slug de page (ex: "/", "merci", "upsell") */
  pageSlugById: Record<string, string>;
  /** Id de la page d'accueil (sert à router "/" vers /tunnel/<slug>) */
  homePageId?: string;
  /** URL de la page SUIVANTE du tunnel (après soumission de formulaire / CTA sans cible). */
  nextUrl?: string;
};

/** Construit l'URL publique d'une page cible à partir de son pageId. */
function publicPageUrl(nav: PublicNavContext, pageId: string): string | null {
  const slug = nav.pageSlugById[pageId];
  if (slug === undefined) return null;
  // La home (slug "/" ou pageId == homePageId) → racine du funnel
  if (pageId === nav.homePageId || slug === "/" || slug === "") {
    return `/tunnel/${nav.publicSlug}`;
  }
  const clean = slug.replace(/^\/+/, "");
  return `/tunnel/${nav.publicSlug}/${clean}`;
}

/**
 * 🆕 Pré-applique les patches dans le body brut de chaque section RAW HTML
 * AVANT l'export, et vide les patches.
 */
function flattenRawHtmlPatches(funnel: Funnel): Funnel {
  const cloned: Funnel = JSON.parse(JSON.stringify(funnel));

  const allSections: FunnelSection[] = [
    ...(cloned.sections ?? []),
    ...((cloned.pages ?? []).flatMap((p) => p.sections ?? [])),
  ];

  let flattened = 0;
  for (const section of allSections) {
    if (!isRawHtmlSection(section)) continue;

    const patches = section.rawHtmlPatches;
    if (!patches || Object.keys(patches).length === 0) continue;

    const rawBody = (section.body ?? "").slice(RAW_HTML_BODY_MARKER.length);

    try {
      const patched = applyRawHtmlPatches(rawBody, patches, {
        annotate: true,
      });
      section.body = RAW_HTML_BODY_MARKER + patched;
      flattened++;
    } catch (e) {
      console.warn(
        `[ff-export] flattenRawHtmlPatches: échec pour section ${section.id}`,
        e,
      );
    }
  }

  if (flattened > 0) {
    console.info(
      `[ff-export] flattenRawHtmlPatches: ${flattened} section(s) raw-html aplatie(s) avant export.`,
    );
  }
  return cloned;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : sérialise dataAttrs en chaîne d'attributs HTML
// ─────────────────────────────────────────────────────────────────────────────
function serializeDataAttrs(dataAttrs: Record<string, string>): string {
  return Object.entries(dataAttrs)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sélection de la page à exporter
// ─────────────────────────────────────────────────────────────────────────────
function resolveExportPage(
  funnel: Funnel,
  targetPageId?: string,
): {
  sections: FunnelSection[];
  role?: string;
  slug?: string;
  isHome: boolean;
  pageId?: string;
} {
  const pages = funnel.pages ?? [];

  if (targetPageId) {
    const page = pages.find((p) => p.id === targetPageId);
    if (page) {
      return {
        sections: page.sections ?? [],
        role: page.role,
        slug: page.slug,
        isHome: !!page.isHome,
        pageId: page.id,
      };
    }
  }

  const home = pages.find((p) => p.isHome) ?? pages[0];
  if (home) {
    return {
      sections: home.sections ?? funnel.sections ?? [],
      role: home.role,
      slug: home.slug,
      isHome: !!home.isHome,
      pageId: home.id,
    };
  }

  return {
    sections: funnel.sections ?? [],
    isHome: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers HTML
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(value = ""): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (c) => entities[c] ?? c);
}
const escapeAttr = escapeHtml;

function applyInlineHighlights(escaped: string): string {
  if (!escaped || escaped.indexOf("[[") === -1) return escaped;
  return escaped.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g,
    (match, text: string, color?: string) => {
      const safeText = (text || "").trim();
      if (!safeText) return match;
      if (color) {
        const c = color.trim();
        // Couleur honorée seulement si valide ET pas quasi-blanche (un hex clair
        // = erreur IA → texte invisible). Sinon on retombe sur l'accent.
        if (/^#[0-9a-fA-F]{3,8}$/.test(c) && hexLuminance(c) <= 0.82) {
          return `<span class="ff-hl" style="color:${c}">${safeText}</span>`;
        }
      }
      return `<span class="ff-hl">${safeText}</span>`;
    },
  );
}

function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const t = url.trim();
  if (t.startsWith("#") || t.startsWith("/")) return true;
  try {
    const u = new URL(t);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}

function safeId(value: string, fallback: string): string {
  const c = (value || "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return c || fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 RAW HTML — Helpers pour les sections clonées
// ─────────────────────────────────────────────────────────────────────────────
function isRawHtmlSection(section: FunnelSection): boolean {
  return (
    typeof section.body === "string" &&
    section.body.startsWith(RAW_HTML_BODY_MARKER)
  );
}

function extractRawHtmlBody(section: FunnelSection): string {
  if (!isRawHtmlSection(section)) return "";
  return (section.body ?? "").slice(RAW_HTML_BODY_MARKER.length);
}

function renderRawHtmlSection(section: FunnelSection): string {
  const rawHtml = extractRawHtmlBody(section);
  if (!rawHtml) return "";
  const patched = applyRawHtmlPatches(rawHtml, section.rawHtmlPatches, {
    annotate: false,
  });
  return `<section id="${escapeAttr(section.id)}" class="ff-section ff-raw-html" data-ff-raw-html="true">
${patched}
</section>`;
}

/**
 * CSS minimal pour que les sections RAW HTML occupent toute la largeur.
 *
 * 🆕 FAQ : sur la page publique, on FERME les FAQ par défaut. Le script
 * FAQ_RUNTIME_SCRIPT se charge de les ouvrir au clic. Cela évite que
 * toutes les réponses soient visibles d'un coup à l'ouverture de la page.
 */
const RAW_HTML_EXPORT_CSS = `<style data-ff-raw-html-export="true">
  .ff-raw-html {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block;
  }
  .ff-raw-html > section,
  .ff-raw-html > div,
  .ff-raw-html > main,
  .ff-raw-html > article {
    max-width: 100% !important;
    width: 100% !important;
  }
  .ff-raw-html img,
  .ff-raw-html video {
    max-width: 100%;
    height: auto;
  }
  .ff-page[data-ff-fully-cloned="true"] {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Animations JS-dépendantes neutralisées */
  .ff-raw-html [data-aos],
  .ff-raw-html .aos-init {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .ff-raw-html [id^="image-"] {
    opacity: 1 !important;
    transform: none !important;
  }
  .ff-raw-html .animate-on-load,
  .ff-raw-html [class*="animate__"] {
    opacity: 1 !important;
    animation: none !important;
  }
  .ff-raw-html img,
  .ff-raw-html video,
  .ff-raw-html picture {
    opacity: 1 !important;
    visibility: visible !important;
  }

  /* Cliquabilité des CTA garantie */
  .ff-raw-html a,
  .ff-raw-html a[id^="button-"],
  .ff-raw-html [data-test-ui="open-url-button"],
  .ff-raw-html [role="button"] {
    pointer-events: auto !important;
    cursor: pointer !important;
  }

  /* 🆕 FAQ : état initial FERMÉ sur la page publique.
     Le script FAQ runtime gère l'ouverture au clic via les classes
     .ff-faq-open / .ff-faq-closed. */
  .ff-raw-html [data-ff-faq-grid] [data-ff-active="false"] ~ * {
    display: none !important;
  }
  .ff-raw-html [data-ff-faq-grid] .ff-faq-closed {
    display: none !important;
  }
  .ff-raw-html [data-ff-faq-grid] .ff-faq-open {
    display: block !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  .ff-raw-html [data-ff-faq-grid] [data-ff-active] {
    cursor: pointer !important;
    user-select: none !important;
  }
</style>`;

function pageIsAllRawHtml(sections: FunnelSection[]): boolean {
  const visible = sections.filter((s) => s.visible !== false);
  if (visible.length === 0) return false;
  return visible.every(isRawHtmlSection);
}

function pageHasRawHtml(sections: FunnelSection[]): boolean {
  return sections.some((s) => s.visible !== false && isRawHtmlSection(s));
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 CLONED HEAD — Extraction et filtrage du <head>
// ─────────────────────────────────────────────────────────────────────────────
function getClonedHeadRaw(funnel: Funnel): string {
  const meta = funnel.meta as { clonedHead?: string } | undefined;
  const raw = meta?.clonedHead;
  return typeof raw === "string" ? raw : "";
}

function sanitizeClonedHeadForExport(rawHead: string): string {
  if (!rawHead || rawHead.trim().length === 0) return "";

  let out = rawHead;
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<script\b[^>]*\/?>/gi, "");
  out = out.replace(/<meta\b[^>]*\/?>/gi, "");
  out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "");
  out = out.replace(/<base\b[^>]*\/?>/gi, "");
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "");

  out = out.replace(/<link\b([^>]*)\/?>/gi, (match, attrs: string) => {
    const relMatch = /\brel\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
    if (!relMatch) return "";
    const rel = relMatch[1].toLowerCase();
    const allowed = new Set([
      "stylesheet",
      "preload",
      "preconnect",
      "dns-prefetch",
      "prefetch",
    ]);
    return allowed.has(rel) ? match : "";
  });

  out = out.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,
    (match, css: string) => {
      if (/a\s*\{\s*[^}]*pointer-events\s*:\s*none[^}]*\}/i.test(css)) {
        return "";
      }
      return match;
    },
  );

  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

  return out;
}

function extractClonedHeadForExport(funnel: Funnel): string {
  const raw = getClonedHeadRaw(funnel);
  if (!raw) return "";
  const sanitized = sanitizeClonedHeadForExport(raw);
  if (!sanitized) return "";
  return `<!-- Cloned head (sanitized) -->\n${sanitized}\n<!-- /Cloned head -->`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ombrage par section
// ─────────────────────────────────────────────────────────────────────────────
const SHADOW_PRESETS: Record<string, string> = {
  sm: "0 1px 2px 0 {C}33, 0 1px 2px -1px {C}33",
  md: "0 4px 6px -1px {C}40, 0 2px 4px -2px {C}40",
  lg: "0 10px 15px -3px {C}4D, 0 4px 6px -4px {C}4D",
  xl: "0 20px 25px -5px {C}59, 0 8px 10px -6px {C}59",
};

function normalizeHexColor(input?: string): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  const m3 = /^#([0-9a-f]{3})$/.exec(v);
  if (m3) {
    const [r, g, b] = m3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const m6 = /^#([0-9a-f]{6})$/.exec(v);
  if (m6) return `#${m6[1]}`;
  const m8 = /^#([0-9a-f]{8})$/.exec(v);
  if (m8) return `#${m8[1].slice(0, 6)}`;
  return null;
}

function buildShadowStyle(
  style?: SectionStyle,
): { className: string; inline: string } {
  const shadow = (style as { shadow?: { size?: string; color?: string } } | undefined)
    ?.shadow;
  const size = shadow?.size;
  if (!size || size === "none") return { className: "", inline: "" };

  const tpl = SHADOW_PRESETS[size];
  if (!tpl) return { className: "", inline: "" };

  const color = normalizeHexColor(shadow?.color) ?? "#000000";
  const value = tpl.replace(/\{C\}/g, color);

  return {
    className: " ff-has-shadow",
    inline: `--ff-shadow:${value};`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────────────────────────────────────
function animClass(anim?: AnimationPreset | string): string {
  if (!anim || anim === "none") return "";
  const allowed: Record<string, string> = {
    "fade-in": "ff-anim-fade-in",
    "fade-up": "ff-anim-fade-up",
    "fade-down": "ff-anim-fade-down",
    "slide-left": "ff-anim-slide-left",
    "slide-right": "ff-anim-slide-right",
    "zoom-in": "ff-anim-zoom-in",
    "zoom-out": "ff-anim-zoom-out",
    pulse: "ff-anim-pulse",
  };
  return allowed[anim] ?? "";
}

function animOf(
  section: FunnelSection,
  target:
    | "eyebrow"
    | "headline"
    | "subheadline"
    | "body"
    | "bullets"
    | "image"
    | "video"
    | "cta",
  fallback: AnimationPreset = "fade-up",
): AnimationPreset {
  const a = section.animations?.[target];
  return a ?? fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────────────────
function isSystemePopup(cta: CtaConfig): boolean {
  return (
    cta.mode === "popup" &&
    cta.popupProvider === "systeme" &&
    !!cta.systemePopupId
  );
}

function ctaHref(cta: CtaConfig, nav?: PublicNavContext): string {
  // 🆕 Navigation inter-pages : si un pageId est présent ET qu'on est en
  // contexte public, on résout vers l'URL publique de la page cible.
  if (cta.pageId && nav) {
    const url = publicPageUrl(nav, cta.pageId);
    if (url) return url;
  }
  if (cta.mode === "anchor") {
    return `#${safeId(cta.anchorId ?? "lead-form", "lead-form")}`;
  }
  if (cta.mode === "popup") {
    if (isSystemePopup(cta)) return "#";
    return `#${safeId(cta.anchorId ?? "lead-form", "lead-form")}`;
  }
  if (cta.mode === "redirect" && cta.url && isSafeUrl(cta.url)) return cta.url;
  // Redirect sans URL → page suivante du tunnel si disponible, sinon ancre form.
  if (cta.mode === "redirect" && nav?.nextUrl) return nav.nextUrl;
  return "#lead-form";
}

function ctaAttrs(cta: CtaConfig, nav?: PublicNavContext): string {
  const href = ctaHref(cta, nav);
  // 🆕 Un lien inter-pages résolu reste interne (_self), jamais _blank.
  const isInternalPageLink = !!(cta.pageId && nav && href.startsWith("/tunnel/"));
  const isExternal =
    !isInternalPageLink &&
    cta.mode === "redirect" &&
    cta.target === "_blank" &&
    isSafeUrl(cta.url ?? "");
  const target = isExternal ? "_blank" : "_self";
  const rel = isExternal ? ' rel="noopener noreferrer"' : "";

  let classExtra = "";
  let popupAttr = "";
  if (isSystemePopup(cta)) {
    const id = String(cta.systemePopupId).trim();
    if (id) classExtra = ` class="systeme-show-popup-${escapeAttr(id)}"`;
  } else if (cta.mode === "popup") {
    // Popup interne AutoFunnel → ouvert par le runtime (FF_FORM_SCRIPT).
    popupAttr = ` data-ff-popup-open="1"`;
  }

  return ` href="${escapeAttr(href)}" target="${target}"${rel}${classExtra}${popupAttr}`;
}

function renderCtaIcon(icon?: CtaIcon): string {
  if (icon === "none") return "";
  const effective: CtaIcon = icon ?? "arrow-right";
  const sz = 18;

  if (effective === "arrow-right") {
    return `<span class="ff-cta-ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>`;
  }
  if (effective === "arrow-down") {
    return `<span class="ff-cta-ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg></span>`;
  }
  if (effective === "external") {
    return `<span class="ff-cta-ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>`;
  }

  return "";
}

function ctaInlineStyle(spacing?: CtaSpacing): string {
  if (!spacing) return "";
  const parts: string[] = [];
  if (typeof spacing.paddingX === "number") {
    parts.push(
      `padding-left:${clamp(spacing.paddingX, 12, 60)}px;padding-right:${clamp(spacing.paddingX, 12, 60)}px`,
    );
  }
  if (typeof spacing.paddingY === "number") {
    parts.push(
      `padding-top:${clamp(spacing.paddingY, 8, 40)}px;padding-bottom:${clamp(spacing.paddingY, 8, 40)}px`,
    );
  }
  return parts.join(";");
}

function ctaWrapInlineStyle(spacing?: CtaSpacing): string {
  if (!spacing) return "";
  if (typeof spacing.marginTop !== "number") return "";
  return `margin-top:${clamp(spacing.marginTop, 0, 80)}px`;
}

function renderCtaButton(
  cta: CtaConfig,
  extraClass = "",
  anim: AnimationPreset = "fade-up",
  nav?: PublicNavContext,
): string {
  const iconHtml = renderCtaIcon(cta.icon);
  const styleStr = ctaInlineStyle(cta.spacing);
  const styleAttr = styleStr ? ` style="${escapeAttr(styleStr)}"` : "";
  const baseAttrs = ctaAttrs(cta, nav);
  const hasClass = / class="/.test(baseAttrs);
  const aCls = animClass(anim);
  const cls = ["ff-btn", "ff-cta", extraClass, aCls].filter(Boolean).join(" ");
  let finalAttrs = baseAttrs;
  if (hasClass) {
    finalAttrs = baseAttrs.replace(/ class="([^"]*)"/, ` class="${cls} $1"`);
  } else {
    finalAttrs = `${baseAttrs} class="${cls}"`;
  }
  return `<a${finalAttrs}${styleAttr}>${escapeHtml(cta.label || "")}${iconHtml}</a>`;
}

// 🆕 Liens/CTA supplémentaires (canaux WhatsApp/Telegram/Instagram…). Rendus
// en rangée de boutons secondaires sous le CTA principal — parité avec le rendu
// runtime (CtaLink baseClassName="ff-btn-extra"). Chaque ancre porte UNIQUEMENT
// la classe `ff-btn-extra` (pas `ff-btn ff-cta`) pour hériter du style discret
// défini dans le thème (.ff-extra-ctas .ff-btn-extra).
function renderExtraCtas(
  ctas: CtaConfig[] | undefined,
  nav?: PublicNavContext,
): string {
  if (!Array.isArray(ctas) || ctas.length === 0) return "";
  const items = ctas
    .filter((c) => c?.label)
    .map((c) => {
      const iconHtml = renderCtaIcon(c.icon);
      const baseAttrs = ctaAttrs(c, nav);
      const hasClass = / class="/.test(baseAttrs);
      const finalAttrs = hasClass
        ? baseAttrs.replace(/ class="([^"]*)"/, ` class="ff-btn-extra $1"`)
        : `${baseAttrs} class="ff-btn-extra"`;
      return `<a${finalAttrs}>${escapeHtml(c.label || "")}${iconHtml}</a>`;
    })
    .join("");
  if (!items) return "";
  return `<div class="ff-extra-ctas">${items}</div>`;
}

function renderBrandCtaButton(cta: CtaConfig, nav?: PublicNavContext): string {
  const iconHtml = renderCtaIcon(cta.icon);
  const baseAttrs = ctaAttrs(cta, nav);
  const hasClass = / class="/.test(baseAttrs);
  const cls = "ff-brand-cta ff-btn";
  let finalAttrs = baseAttrs;
  if (hasClass) {
    finalAttrs = baseAttrs.replace(/ class="([^"]*)"/, ` class="${cls} $1"`);
  } else {
    finalAttrs = `${baseAttrs} class="${cls}"`;
  }
  return `<a${finalAttrs}>${escapeHtml(cta.label || "")}${iconHtml}</a>`;
}

function pageHasSystemePopup(
  sections: FunnelSection[],
  funnel: Funnel,
): boolean {
  const headerCta = funnel.header?.cta;
  if (headerCta && isSystemePopup(headerCta)) return true;
  for (const s of sections) {
    if (s.visible === false) continue;
    if (s.cta && isSystemePopup(s.cta)) return true;
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (it.kind === "pricing" && it.data.cta && isSystemePopup(it.data.cta)) {
          return true;
        }
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 CTA RUNTIME — popup interne + capture de lead + navigation page suivante
// ─────────────────────────────────────────────────────────────────────────────
function ctaIsInternalPopup(cta: CtaConfig | undefined | null): boolean {
  return !!cta && cta.mode === "popup" && !isSystemePopup(cta);
}

function pageHasInternalPopup(sections: FunnelSection[], funnel: Funnel): boolean {
  if (ctaIsInternalPopup(funnel.header?.cta)) return true;
  for (const s of sections) {
    if (s.visible === false) continue;
    if (ctaIsInternalPopup(s.cta)) return true;
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (it.kind === "pricing" && ctaIsInternalPopup(it.data.cta)) return true;
      }
    }
  }
  return false;
}

/**
 * 🆕 Collecte les tags CRM des CTA popup internes de la page. L'overlay popup
 * étant unique par page, on prend l'union des captureTags de tous les CTA popup
 * internes (dédupliqués, en préservant l'ordre).
 */
function collectInternalPopupTags(
  sections: FunnelSection[],
  funnel: Funnel,
): string[] {
  const out: string[] = [];
  const add = (cta: CtaConfig | undefined | null) => {
    if (!ctaIsInternalPopup(cta) || !cta?.captureTags) return;
    for (const tag of cta.captureTags) {
      const t = tag.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  };
  add(funnel.header?.cta);
  for (const s of sections) {
    if (s.visible === false) continue;
    add(s.cta);
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (it.kind === "pricing") add(it.data.cta);
      }
    }
  }
  return out;
}

/** Overlay popup interne : un formulaire de capture qui mène à la page suivante. */
function renderInternalPopupOverlay(
  funnel: Funnel,
  nav: PublicNavContext | undefined,
  label: string,
  currentPageId: string | undefined,
  captureTags: string[] = [],
): string {
  const lang = funnel.language || "fr";
  const t =
    lang === "en"
      ? { title: "Get instant access", email: "Your email", name: "Your first name", phone: "Phone (optional)", submit: label || "Get access" }
      : lang === "es"
        ? { title: "Obtén acceso", email: "Tu email", name: "Tu nombre", phone: "Teléfono (opcional)", submit: label || "Quiero acceso" }
        : { title: "Recevez votre accès", email: "Votre email", name: "Votre prénom", phone: "Téléphone (optionnel)", submit: label || "Je reçois" };

  const tagsAttr =
    captureTags.length > 0
      ? ` data-ff-tags="${escapeAttr(captureTags.join(","))}"`
      : "";

  const dataAttrs = nav
    ? ` data-ff-funnel-slug="${escapeAttr(nav.publicSlug)}"` +
      ` data-ff-page-slug="${escapeAttr(currentPageId ? nav.pageSlugById[currentPageId] ?? "" : "")}"` +
      ` data-ff-section-id="popup"` +
      tagsAttr +
      (nav.nextUrl ? ` data-ff-next-url="${escapeAttr(nav.nextUrl)}"` : "")
    : "";

  return `<style>
.ff-popup-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:20px;}
.ff-popup-overlay[hidden]{display:none;}
.ff-popup-box{background:var(--ff-surface,#fff);color:var(--ff-ink,#111);max-width:420px;width:100%;border-radius:16px;padding:28px;position:relative;box-shadow:0 30px 80px rgba(0,0,0,.45);}
.ff-popup-close{position:absolute;top:8px;right:12px;background:none;border:none;font-size:26px;line-height:1;cursor:pointer;color:var(--ff-ink,#111);opacity:.6;}
.ff-popup-box h3{margin:0 0 16px;font-size:20px;font-weight:800;}
.ff-popup-box .ff-field{margin-bottom:10px;}
</style>
<div class="ff-popup-overlay" data-ff-popup-overlay hidden>
  <div class="ff-popup-box" role="dialog" aria-modal="true">
    <button type="button" class="ff-popup-close" data-ff-popup-close aria-label="Fermer">&times;</button>
    <h3>${escapeHtml(t.title)}</h3>
    <form class="ff-form-fields" action="#" method="post"${dataAttrs}>
      <div class="ff-field"><input class="ff-input" type="email" name="email" placeholder="${escapeAttr(t.email)}" required /></div>
      <div class="ff-field"><input class="ff-input" type="text" name="name" placeholder="${escapeAttr(t.name)}" /></div>
      <div class="ff-field"><input class="ff-input" type="tel" name="phone" placeholder="${escapeAttr(t.phone)}" /></div>
      <button type="submit" class="ff-btn ff-form-submit" style="width:100%;">${escapeHtml(t.submit)}</button>
    </form>
  </div>
</div>`;
}

/** Script runtime : capture des formulaires (→ /api/leads) + redirection page suivante + ouverture popup. */
const FF_FORM_SCRIPT = `<script>(function(){
  function collect(form){
    var d={metadata:{}};
    var els=form.querySelectorAll("input,textarea,select");
    for(var i=0;i<els.length;i++){
      var el=els[i]; if(!el.name) continue;
      var n=el.name.toLowerCase();
      if(el.type==="checkbox"){ if(n.indexOf("consent")>-1||n.indexOf("rgpd")>-1){d.consent=el.checked;} else {d.metadata[el.name]=el.checked;} continue; }
      var v=el.value;
      if(n==="email"||el.type==="email"){d.email=v;}
      else if(!d.name&&(n==="name"||n==="nom"||n==="prenom"||n==="firstname"||n==="fullname")){d.name=v;}
      else if(n==="phone"||n==="tel"||n==="telephone"||el.type==="tel"){d.phone=v;}
      else {d.metadata[el.name]=v;}
    }
    return d;
  }
  function ok(form,next){ if(next){window.location.href=next;} else {form.innerHTML="<p class=\\"ff-reassurance\\">Merci, c'est bien recu !</p>";} }
  function bind(form){
    form.addEventListener("submit",function(e){
      e.preventDefault();
      var slug=form.getAttribute("data-ff-funnel-slug");
      var next=form.getAttribute("data-ff-next-url");
      var btn=form.querySelector("[type=submit]");
      var d=collect(form);
      if(!d.email){return;}
      if(!slug){ ok(form,next); return; }
      if(btn){btn.disabled=true;btn.setAttribute("data-l",btn.textContent||"");btn.textContent="...";}
      d.funnelSlug=slug;
      d.pageSlug=form.getAttribute("data-ff-page-slug")||null;
      d.sectionId=form.getAttribute("data-ff-section-id")||null;
      var tg=form.getAttribute("data-ff-tags"); if(tg){d.tags=tg.split(",").map(function(s){return s.trim();}).filter(Boolean);}
      fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})
        .then(function(r){return r.json().then(function(j){return{s:r.ok,j:j};}).catch(function(){return{s:r.ok,j:{}};});})
        .then(function(res){
          if(res.s&&res.j&&res.j.ok){ ok(form,next); }
          else { if(btn){btn.disabled=false;btn.textContent=btn.getAttribute("data-l")||"Envoyer";} alert("Une erreur est survenue, reessayez."); }
        })
        .catch(function(){ if(btn){btn.disabled=false;btn.textContent=btn.getAttribute("data-l")||"Envoyer";} alert("Connexion impossible, reessayez."); });
    });
  }
  function boot(){
    var forms=document.querySelectorAll("form.ff-form-fields");
    for(var i=0;i<forms.length;i++) bind(forms[i]);
    var ov=document.querySelector("[data-ff-popup-overlay]");
    if(ov){
      var openers=document.querySelectorAll("[data-ff-popup-open]");
      for(var k=0;k<openers.length;k++){ openers[k].addEventListener("click",function(e){e.preventDefault();ov.removeAttribute("hidden");document.body.style.overflow="hidden";}); }
      ov.addEventListener("click",function(e){ if(e.target===ov){ov.setAttribute("hidden","");document.body.style.overflow="";} });
      var closers=ov.querySelectorAll("[data-ff-popup-close]");
      for(var c=0;c<closers.length;c++){ closers[c].addEventListener("click",function(){ov.setAttribute("hidden","");document.body.style.overflow="";}); }
    }
  }
  if(document.readyState!=="loading"){boot();}else{document.addEventListener("DOMContentLoaded",boot);}
})();</script>`;

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG inline
// ─────────────────────────────────────────────────────────────────────────────
const SVG_PATHS: Record<IconName, string> = {
  check: `<polyline points="20 6 9 17 4 12"/>`,
  checkCircle: `<circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 10"/>`,
  badgeCheck: `<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><polyline points="9 12 12 15 16 10"/>`,
  thumbsUp: `<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L15 2c1.66 0 2.5 1.39 2 3.88Z"/>`,
  star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  sparkles: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>`,
  award: `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`,
  trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  crown: `<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>`,
  flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  rocket: `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  target: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  lightbulb: `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  gift: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
  trendingUp: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  trendingDown: `<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>`,
  barChart: `<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>`,
  mail: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  briefcase: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  play: `<polygon points="6 3 20 12 6 21 6 3"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  fileText: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
};

function renderIconSvg(
  name: IconName,
  sizePx = 20,
  color?: string,
): string {
  const path = SVG_PATHS[name] ?? SVG_PATHS.check;
  const stroke = color ? escapeAttr(color) : "currentColor";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function renderIcon(config?: IconConfig, fallback: IconName = "check"): string {
  const name = normalizeIconName(config?.name ?? fallback);
  const size = resolveIconSizePx(config);
  const color = config?.color;
  return renderIconSvg(name, size, color);
}

function renderIconByName(name?: IconName | string, sizePx = 20): string {
  const n = normalizeIconName(typeof name === "string" ? name : name);
  return renderIconSvg(n, sizePx);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image
// ─────────────────────────────────────────────────────────────────────────────
function renderImage(
  rawImage: SectionImage | undefined,
  funnel: Funnel,
  fallbackAnim: AnimationPreset = "fade-in",
): string {
  const image = materializeSectionImage(rawImage, funnel);
  if (!image || image.mode === "none" || !isUsableMediaUrl(image.url)) return "";

  const alt = escapeAttr(image.alt ?? "");
  const transparent = image.transparentBg === true;

  const cls = ["ff-image"];
  if (transparent) cls.push("ff-image--transparent");
  const aCls = animClass(image.animation ?? fallbackAnim);
  if (aCls) cls.push(aCls);

  const credit = image.credit
    ? `<figcaption class="ff-image-credit">${escapeHtml(image.credit)}</figcaption>`
    : "";

  return `<figure class="${cls.join(" ")}"><img src="${escapeAttr(image.url)}" alt="${alt}" loading="lazy" />${credit}</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video
// ─────────────────────────────────────────────────────────────────────────────
type ParsedVideo = { kind: "iframe" | "file"; src: string } | null;

function parseVideoUrl(raw: string): ParsedVideo {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  if (/\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(url)) {
    return { kind: "file", src: url };
  }

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be"
  ) {
    let id = "";
    if (host === "youtu.be") {
      id = u.pathname.replace(/^\//, "").split("/")[0];
    } else if (u.pathname.startsWith("/shorts/")) {
      id = u.pathname.replace("/shorts/", "").split("/")[0];
    } else if (u.pathname.startsWith("/embed/")) {
      id = u.pathname.replace("/embed/", "").split("/")[0];
    } else if (u.pathname.startsWith("/live/")) {
      id = u.pathname.replace("/live/", "").split("/")[0];
    } else if (u.pathname === "/watch") {
      id = u.searchParams.get("v") || "";
    }
    if (!id) return null;

    const params = new URLSearchParams();
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (t) {
      const sec = /^\d+$/.test(t)
        ? t
        : String(
            parseInt(/(\d+)h/.exec(t)?.[1] || "0", 10) * 3600 +
              parseInt(/(\d+)m/.exec(t)?.[1] || "0", 10) * 60 +
              parseInt(/(\d+)s/.exec(t)?.[1] || "0", 10),
          );
      if (sec && sec !== "0") params.set("start", sec);
    }
    const qs = params.toString();
    return {
      kind: "iframe",
      src: `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ""}`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segs = u.pathname.split("/").filter(Boolean);
    if (host === "player.vimeo.com") {
      const vIdx = segs.indexOf("video");
      if (vIdx >= 0 && segs[vIdx + 1]) {
        const id = segs[vIdx + 1];
        const hash = segs[vIdx + 2];
        return {
          kind: "iframe",
          src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`,
        };
      }
      return null;
    }
    const id = segs[0];
    const hash = segs[1];
    if (!id || !/^\d+$/.test(id)) return null;
    return {
      kind: "iframe",
      src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`,
    };
  }

  return { kind: "iframe", src: url };
}

function renderVideo(
  url?: string,
  anim: AnimationPreset = "zoom-in",
  posterUrl?: string,
): string {
  if (!url) return "";
  const parsed = parseVideoUrl(url);
  if (!parsed) return "";
  const aCls = animClass(anim);
  const cls = ["ff-video", aCls].filter(Boolean).join(" ");

  if (parsed.kind === "file") {
    const poster = posterUrl ? ` poster="${escapeAttr(posterUrl)}"` : "";
    return `<div class="${cls}"><div class="ff-video-inner">
  <video controls preload="metadata"${poster} style="display:block;width:100%;height:auto;">
    <source src="${escapeAttr(parsed.src)}" />
  </video>
</div></div>`;
  }

  return `<div class="${cls}"><div class="ff-video-inner">
  <iframe src="${escapeAttr(parsed.src)}" title="Vidéo" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section colors & background
// ─────────────────────────────────────────────────────────────────────────────
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bg: _ignored, ...rest } = colors;
  return rest;
}

function buildSectionInlineStyle(section: FunnelSection): string {
  const parts: string[] = [];
  const colors = getSectionColors(section);
  const bg = section.background;

  if (colors.bg) parts.push(`background-color:${colors.bg}`);
  if (colors.ink) parts.push(`color:${colors.ink}`);
  if (colors.accent) parts.push(`--ff-accent:${colors.accent}`);

  if (bg?.imageUrl) {
    parts.push(
      `background-image:url('${bg.imageUrl.replace(/'/g, "%27")}')`,
      `background-size:${bg.size ?? "cover"}`,
      `background-position:${bg.position ?? "center"}`,
      `background-repeat:no-repeat`,
    );
  }

  return parts.join(";");
}

function sectionOverlay(section: FunnelSection): string {
  const bg = section.background;
  if (!bg?.imageUrl) return "";
  const overlay = bg.overlay ?? 0;
  if (overlay <= 0) return "";
  return `<div aria-hidden="true" class="ff-section-overlay" style="position:absolute;inset:0;pointer-events:none;background:rgba(0,0,0,${clamp(overlay, 0, 1)});"></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bullets
// ─────────────────────────────────────────────────────────────────────────────
const BULLET_LAYOUT_SECTIONS = new Set([
  "benefits",
  "features",
  "advantages",
  "proof",
  "trust",
  "stats",
]);

const BULLET_LIST_ONLY_SECTIONS = new Set([
  "hero",
  "form",
  "thankyou",
  "delivery",
  "confirmation",
]);

function splitBulletValueLabel(
  raw: string,
): { value: string; label?: string } {
  const t = (raw || "").trim();
  const pipeIdx = t.indexOf("|");
  if (pipeIdx > 0 && pipeIdx < t.length - 1) {
    return {
      value: t.slice(0, pipeIdx).trim(),
      label: t.slice(pipeIdx + 1).trim(),
    };
  }
  const nlIdx = t.indexOf("\n");
  if (nlIdx > 0 && nlIdx < t.length - 1) {
    return {
      value: t.slice(0, nlIdx).trim(),
      label: t.slice(nlIdx + 1).trim(),
    };
  }
  return { value: t };
}

function bulletsFitInlineStrip(bullets: string[]): boolean {
  if (bullets.length < 2 || bullets.length > 4) return false;
  return bullets.every((b) => {
    const { value, label } = splitBulletValueLabel(b);
    const main = label ? value : value;
    return main.length > 0 && main.length <= 32;
  });
}

/** Sépare un bullet « Titre | Description » (ou —, –, ::). Mirroir de
 *  splitBulletTitleDescription côté aperçu. */
function splitBulletTitleDesc(
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

function renderBullets(section: FunnelSection): string {
  if (!section.bullets?.length) return "";
  const defaultIconName = section.iconName || "check";
  const sectionType = String(section.type || "");

  const isListOnly = BULLET_LIST_ONLY_SECTIONS.has(sectionType);
  const isLayoutCompatible =
    !isListOnly && BULLET_LAYOUT_SECTIONS.has(sectionType);

  let mode: "list" | "grid" | "strip" = "list";
  // 🆕 B2 : bullets du HERO en bande « | » UNIQUEMENT si le calcul le permet
  // (≤4 puces, peu de mots / chiffres) ; sinon liste. Parité avec l'aperçu.
  if (sectionType === "hero") {
    mode = bulletsFitInlineStrip(section.bullets) ? "strip" : "list";
  } else if (isLayoutCompatible) {
    if (bulletsFitInlineStrip(section.bullets)) mode = "strip";
    else mode = "grid";
  }

  const ulClasses = ["ff-bullets"];
  if (mode === "grid") ulClasses.push("ff-bullets--grid");
  if (mode === "strip") ulClasses.push("ff-bullets--inline-strip");

  // 🆕 B2 : puces numérotées (process/programme) — parité avec l'aperçu.
  const numbered = section.style?.numberedBullets === true;

  const itemsHtml = section.bullets
    .map((bullet, i) => {
      const name = (section.bulletIcons?.[i] as string) ?? defaultIconName;
      const svg = renderIconByName(name, 18);

      if (mode === "strip") {
        const { value, label } = splitBulletValueLabel(bullet);
        if (label) {
          return `<li><span class="ff-strip-value">${applyInlineHighlights(escapeHtml(value))}</span><span class="ff-strip-label">${applyInlineHighlights(escapeHtml(label))}</span></li>`;
        }
        return `<li><span class="ff-strip-value">${applyInlineHighlights(escapeHtml(value))}</span></li>`;
      }

      const leading = numbered
        ? `<span class="ff-bullet-num">${i + 1}</span>`
        : `<span class="ff-bullet-ic">${svg}</span>`;
      // 🆕 Format « Titre | Description » → titre en gras + description (jamais
      // le « | » littéral). Parité avec l'aperçu (splitBulletTitleDescription).
      const td = splitBulletTitleDesc(bullet);
      const textHtml = td
        ? `<span class="ff-bullet-text"><strong class="ff-bullet-title">${applyInlineHighlights(escapeHtml(td.title))}</strong> <span class="ff-bullet-desc">${applyInlineHighlights(escapeHtml(td.description))}</span></span>`
        : `<span class="ff-bullet-text">${applyInlineHighlights(escapeHtml(bullet))}</span>`;
      return `<li>${leading}${textHtml}</li>`;
    })
    .join("");

  return `<ul class="${ulClasses.join(" ")}" data-ff-bullets-mode="${mode}">${itemsHtml}</ul>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderers spécialisés
// ─────────────────────────────────────────────────────────────────────────────
function gridClass(count: number): string {
  const cols = clamp(count, 1, 3);
  return `ff-grid-${cols}`;
}

function renderPricing(section: FunnelSection, nav?: PublicNavContext): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "pricing" } => it.kind === "pricing",
  );
  if (items.length === 0) return "";

  const cards = items
    .map((item, idx) => {
      const d = item.data;
      const highlighted = !!d.highlighted;
      const cardCls = highlighted
        ? "ff-pricing-card ff-card ff-card-elevated ff-pricing-card--highlighted"
        : "ff-pricing-card ff-card";

      const badge = highlighted
        ? `<div class="ff-pricing-badge">★ ${escapeHtml(d.badge ?? "Populaire")}</div>`
        : "";
      const desc = d.description
        ? `<p class="ff-pricing-desc">${escapeHtml(d.description)}</p>`
        : "";
      const period = d.period
        ? `<span class="ff-pricing-period">${escapeHtml(d.period)}</span>`
        : "";
      const featureIconSize = d.featureIcon ? resolveIconSizePx(d.featureIcon) : 16;
      const featureIconHtml = d.featureIcon
        ? renderIconSvg(
            normalizeIconName(d.featureIcon.name),
            featureIconSize,
            d.featureIcon.color,
          )
        : renderIconSvg("check", 16);
      const features = d.features?.length
        ? `<ul class="ff-pricing-features">
${d.features.map((f) => `  <li><span class="ff-feat-check">${featureIconHtml}</span><span>${escapeHtml(f)}</span></li>`).join("\n")}
</ul>`
        : "";
      const ctaHtml = d.cta?.label
        ? renderCtaButton(d.cta, "ff-pricing-cta", "fade-up", nav)
        : "";
      // 🆕 Prix d'ancrage barré. Rendu dans l'export AUSSI : un tunnel exporté
      // qui perdrait le prix barré afficherait une offre différente de celle
      // vue dans l'éditeur. Style en ligne — l'export ne dépend d'aucune
      // feuille externe.
      const anchor = d.originalPrice
        ? `<del style="display:block;font-size:18px;font-weight:600;opacity:.5;margin-bottom:2px">${escapeHtml(d.originalPrice)}</del>`
        : "";

      return `  <div class="${cardCls}">
    ${badge}
    <h3 class="ff-pricing-name">${escapeHtml(d.name || `Plan ${idx + 1}`)}</h3>
    ${desc}
    <div class="ff-pricing-price">
      ${anchor}
      <span class="ff-pricing-amount">${escapeHtml(d.price || "—")}</span>
      ${period}
    </div>
    ${features}
    ${ctaHtml}
  </div>`;
    })
    .join("\n");

  return `<div class="ff-pricing ${gridClass(items.length)}">
${cards}
</div>`;
}

function renderBonus(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "bonus" } => it.kind === "bonus",
  );
  if (items.length === 0) return "";

  const cards = items
    .map((item, idx) => {
      const d = item.data;
      const iconConfig: IconConfig =
        d.icon ?? { name: normalizeIconName(d.iconName ?? "gift") };
      const iconSize = resolveIconSizePx(iconConfig);
      const iconSvg = renderIconSvg(
        normalizeIconName(iconConfig.name),
        iconSize,
        iconConfig.color,
      );
      const value = d.value
        ? `<span class="ff-bonus-value">${escapeHtml(d.value)}</span>`
        : "";
      const desc = d.description
        ? `<p class="ff-bonus-desc">${escapeHtml(d.description)}</p>`
        : "";
      return `  <div class="ff-bonus-card">
    <div class="ff-bonus-icon">${iconSvg}</div>
    <div>
      <div class="ff-bonus-head">
        <h3 class="ff-bonus-title">${escapeHtml(d.title || `Bonus ${idx + 1}`)}</h3>
        ${value}
      </div>
      ${desc}
    </div>
  </div>`;
    })
    .join("\n");

  return `<div class="ff-bonus ${gridClass(items.length)}">
${cards}
</div>`;
}

function renderTestimonialMedia(media: {
  kind: "image" | "video";
  url: string;
  alt?: string;
  posterUrl?: string;
}): string {
  if (!media.url) return "";

  if (media.kind === "image") {
    return `<div class="ff-testimonial-media ff-testimonial-media--image">
  <img src="${escapeAttr(media.url)}" alt="${escapeAttr(media.alt || "")}" loading="lazy" />
</div>`;
  }

  const parsed = parseVideoUrl(media.url);
  if (!parsed) return "";

  if (parsed.kind === "file") {
    const poster = media.posterUrl ? ` poster="${escapeAttr(media.posterUrl)}"` : "";
    return `<div class="ff-testimonial-media ff-testimonial-media--video">
  <video controls preload="metadata"${poster} style="display:block;width:100%;height:auto;">
    <source src="${escapeAttr(parsed.src)}" />
  </video>
</div>`;
  }

  return `<div class="ff-testimonial-media ff-testimonial-media--video">
  <div class="ff-testimonial-media-frame" style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;">
    <iframe src="${escapeAttr(parsed.src)}" title="${escapeAttr(media.alt || "Témoignage vidéo")}" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>
  </div>
</div>`;
}

function renderTestimonialMediaGallery(
  medias: Array<{
    id: string;
    kind: "image" | "video";
    url: string;
    alt?: string;
    posterUrl?: string;
  }>,
): string {
  const list = medias.filter((m) => !!m.url);
  if (list.length === 0) return "";
  const colsClass =
    list.length === 1
      ? "ff-tm-cols-1"
      : list.length === 2
        ? "ff-tm-cols-2"
        : "ff-tm-cols-3";
  const cells = list.map((m) => renderTestimonialMedia(m)).join("\n");
  return `<div class="ff-testimonial-media-gallery ${colsClass}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;margin-bottom:1.25rem;">
${cells}
</div>`;
}

function renderTestimonials(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "testimonial" } => it.kind === "testimonial",
  );
  if (items.length === 0) return "";

  const cards = items
    .map((item) => {
      const d = item.data;
      const initials = (d.authorName || "?")
        .split(" ")
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const mediasHtml = Array.isArray(d.medias) && d.medias.length > 0
        ? renderTestimonialMediaGallery(d.medias)
        : "";

      const rating =
        d.rating && d.rating > 0
          ? `<div class="ff-testimonial-rating">${"★".repeat(clamp(d.rating, 0, 5))}${"☆".repeat(5 - clamp(d.rating, 0, 5))}</div>`
          : "";
      const quote = d.quote
        ? `<blockquote class="ff-testimonial-quote">« ${escapeHtml(d.quote)} »</blockquote>`
        : "";
      const avatar = d.avatarUrl
        ? `<img class="ff-testimonial-avatar" src="${escapeAttr(d.avatarUrl)}" alt="${escapeAttr(d.authorName || "")}" loading="lazy" />`
        : `<div class="ff-testimonial-avatar ff-testimonial-avatar--initials">${escapeHtml(initials)}</div>`;
      const role = d.authorRole
        ? `<div class="ff-testimonial-role">${escapeHtml(d.authorRole)}</div>`
        : "";

      return `  <div class="ff-testimonial-card ff-card">
    ${mediasHtml}
    ${rating}
    ${quote}
    <div class="ff-testimonial-author">
      ${avatar}
      <div class="ff-testimonial-meta">
        <div class="ff-testimonial-name">${escapeHtml(d.authorName || "")}</div>
        ${role}
      </div>
    </div>
  </div>`;
    })
    .join("\n");

  return `<div class="ff-testimonials ${gridClass(items.length)}">
${cards}
</div>`;
}

function renderFaq(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "faq" } => it.kind === "faq",
  );
  if (items.length === 0) return "";

  const list = items
    .map((item, idx) => {
      const d = item.data;
      const iconHtml = d.icon
        ? `<span class="ff-faq-icon">${renderIcon(d.icon, "lightbulb")}</span>`
        : "";
      return `  <details class="ff-faq-item">
    <summary class="ff-faq-q">
      <span class="ff-faq-q-text">${iconHtml}${escapeHtml(d.question || `Question ${idx + 1}`)}</span>
      <svg class="ff-faq-chevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </summary>
    <div class="ff-faq-a"><p>${escapeHtml(d.answer || "")}</p></div>
  </details>`;
    })
    .join("\n");

  return `<div class="ff-faq-list">
${list}
</div>`;
}

function renderGuarantee(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "guarantee" } => it.kind === "guarantee",
  );
  const item = items[0];
  if (!item) return "";
  const d = item.data;
  const iconConfig: IconConfig =
    d.icon ?? { name: normalizeIconName(d.iconName ?? "shield") };
  const iconSize = Math.max(28, resolveIconSizePx(iconConfig));
  const iconSvg = renderIconSvg(
    normalizeIconName(iconConfig.name),
    iconSize,
    iconConfig.color,
  );
  const duration = d.duration
    ? `<span class="ff-guarantee-duration">${escapeHtml(d.duration)}</span>`
    : "";
  const desc = d.description
    ? `<p class="ff-guarantee-desc">${escapeHtml(d.description)}</p>`
    : "";
  return `<div class="ff-guarantee">
  <div class="ff-guarantee-icon">${iconSvg}</div>
  <div>
    <div class="ff-guarantee-head">
      <h3 class="ff-guarantee-title">${escapeHtml(d.title || "Notre garantie")}</h3>
      ${duration}
    </div>
    ${desc}
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────────────────────────────────────
const TIMER_SIZE_CONFIG: Record<
  NonNullable<TimerItem["size"]>,
  { numFs: string; lblFs: string; gap: string; padX: string; padY: string }
> = {
  sm: { numFs: "1.25rem", lblFs: "0.625rem",  gap: "0.375rem", padX: "0.5rem",  padY: "0.375rem" },
  md: { numFs: "2rem",    lblFs: "0.75rem",   gap: "0.5rem",   padX: "0.75rem", padY: "0.625rem" },
  lg: { numFs: "3rem",    lblFs: "0.8125rem", gap: "0.75rem",  padX: "1rem",    padY: "0.875rem" },
  xl: { numFs: "4rem",    lblFs: "0.875rem",  gap: "1rem",     padX: "1.25rem", padY: "1.125rem" },
};

const TIMER_DEFAULT_LABELS: Record<
  string,
  { days: string; hours: string; minutes: string; seconds: string }
> = {
  fr: { days: "Jours", hours: "Heures", minutes: "Minutes", seconds: "Secondes" },
  en: { days: "Days",  hours: "Hours",  minutes: "Minutes", seconds: "Seconds"  },
  es: { days: "Días",  hours: "Horas",  minutes: "Minutos", seconds: "Segundos" },
};

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function computeInitialTimeLeft(timer: TimerItem): {
  days: number; hours: number; minutes: number; seconds: number;
} {
  let totalMs = 0;
  if (timer.mode === "countdown-date" && timer.targetDate) {
    const t = new Date(timer.targetDate).getTime();
    if (!isNaN(t)) totalMs = Math.max(0, t - Date.now());
  } else if (timer.mode === "countdown-duration") {
    const hours = (timer.durationHours && timer.durationHours > 0)
      ? timer.durationHours
      : 24;
    totalMs = Math.max(0, hours * 60 * 60 * 1000);
  }
  return {
    days: Math.floor(totalMs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((totalMs / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((totalMs / (1000 * 60)) % 60),
    seconds: Math.floor((totalMs / 1000) % 60),
  };
}

function buildTimerDataAttrs(
  timer: TimerItem,
  funnelId: string,
  pageId: string,
  language: string,
): string {
  const attrs: Record<string, string> = {
    "data-ff-timer": "true",
    "data-ff-timer-id": timer.id,
    "data-ff-timer-mode": timer.mode,
    "data-ff-timer-style": timer.style ?? "cards",
    "data-ff-timer-size": timer.size ?? "md",
    "data-ff-timer-on-expire": timer.onExpire ?? "keep-zero",
    "data-ff-timer-show-days": timer.showDays ? "true" : "false",
    "data-ff-timer-scope": `${funnelId}_${pageId}`,
    "data-ff-timer-lang": language,
  };
  if (timer.mode === "countdown-duration") {
    const hours = (timer.durationHours && timer.durationHours > 0)
      ? timer.durationHours
      : 24;
    attrs["data-ff-timer-duration-ms"] = String(hours * 60 * 60 * 1000);
  }
  if (timer.mode === "countdown-date" && timer.targetDate) {
    const t = new Date(timer.targetDate).getTime();
    if (!isNaN(t)) attrs["data-ff-timer-target-ms"] = String(t);
  }
  if (timer.mode === "seats-counter") {
    attrs["data-ff-timer-seats-total"] = String(timer.seatsTotal ?? 100);
    attrs["data-ff-timer-seats-remaining"] = String(timer.seatsRemaining ?? 0);
  }
  if (timer.expiredMessage) {
    attrs["data-ff-timer-expired-msg"] = timer.expiredMessage;
  }
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
}

function renderTimer(
  timer: TimerItem,
  funnel: Funnel,
  pageId: string,
): string {
  const lang = (funnel.language || "fr") as "fr" | "en" | "es";
  const labels = {
    ...TIMER_DEFAULT_LABELS[lang],
    ...(timer.labels ?? {}),
  };
  const sizeConf = TIMER_SIZE_CONFIG[timer.size ?? "md"];
  const accentColor = timer.color ?? "var(--ff-accent, #2563eb)";
  const scopeId = (funnel.funnelName || "default")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();
  const dataAttrs = buildTimerDataAttrs(timer, scopeId, pageId, lang);

  if (timer.mode === "seats-counter") {
    const remaining = timer.seatsRemaining ?? 0;
    const total = timer.seatsTotal ?? 100;
    const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
    const labelHtml = timer.label
      ? `<div class="ff-timer-label" style="text-align:center;font-weight:500;font-size:${sizeConf.lblFs};margin-bottom:0.5rem;">${escapeHtml(timer.label)}</div>`
      : "";
    return `<div class="ff-timer ff-timer--seats" ${dataAttrs} style="margin-top:1rem;margin-bottom:1rem;">
  ${labelHtml}
  <div style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;">
    <div style="font-weight:700;font-size:${sizeConf.numFs};color:${escapeAttr(accentColor)};">
      <span data-ff-timer-field="seats-remaining">${escapeHtml(String(remaining))}</span> / <span data-ff-timer-field="seats-total">${escapeHtml(String(total))}</span>
    </div>
    <div style="height:0.5rem;width:100%;max-width:28rem;overflow:hidden;border-radius:9999px;background:rgba(0,0,0,0.08);">
      <div data-ff-timer-field="seats-bar" style="height:100%;border-radius:9999px;width:${pct}%;background:${escapeAttr(accentColor)};transition:width .7s ease;"></div>
    </div>
  </div>
</div>`;
  }

  const t0 = computeInitialTimeLeft(timer);
  const units: Array<{ value: number; label: string; key: string }> = [];
  if (timer.showDays) units.push({ value: t0.days, label: labels.days, key: "days" });
  units.push({ value: t0.hours, label: labels.hours, key: "hours" });
  units.push({ value: t0.minutes, label: labels.minutes, key: "minutes" });
  units.push({ value: t0.seconds, label: labels.seconds, key: "seconds" });

  const style = timer.style ?? "cards";

  if (style === "inline") {
    const labelHtml = timer.label
      ? `<span style="font-size:${sizeConf.lblFs};margin-right:0.5rem;opacity:0.85;">${escapeHtml(timer.label)}</span>`
      : "";
    const inner = units
      .map((u) => `<span data-ff-timer-field="${u.key}">${pad2(u.value)}</span>`)
      .join(`<span style="opacity:0.5;"> : </span>`);
    return `<div class="ff-timer ff-timer--inline" ${dataAttrs} style="margin-top:1rem;margin-bottom:1rem;text-align:center;">
  ${labelHtml}<span style="font-size:${sizeConf.numFs};font-weight:700;font-variant-numeric:tabular-nums;color:${escapeAttr(accentColor)};">${inner}</span>
</div>`;
  }

  if (style === "digital") {
    const bgStyle = timer.backgroundColor
      ? `background:${escapeAttr(timer.backgroundColor)};padding:1rem;border-radius:12px;`
      : "";
    const labelHtml = timer.label
      ? `<div style="text-align:center;font-weight:500;font-size:${sizeConf.lblFs};opacity:0.85;margin-bottom:0.5rem;">${escapeHtml(timer.label)}</div>`
      : "";
    const cells = units
      .map(
        (u, i) =>
          `<div style="display:flex;align-items:center;gap:${sizeConf.gap};">
  <div style="display:flex;flex-direction:column;align-items:center;">
    <span data-ff-timer-field="${u.key}" style="font-size:${sizeConf.numFs};font-weight:800;color:${escapeAttr(accentColor)};line-height:1;font-family:'Courier New',monospace;letter-spacing:0.05em;">${pad2(u.value)}</span>
    <span style="font-size:${sizeConf.lblFs};opacity:0.7;margin-top:0.25rem;">${escapeHtml(u.label)}</span>
  </div>
  ${i < units.length - 1 ? `<span style="font-size:${sizeConf.numFs};font-weight:800;color:${escapeAttr(accentColor)};opacity:0.5;line-height:1;">:</span>` : ""}
</div>`,
      )
      .join("");
    return `<div class="ff-timer ff-timer--digital" ${dataAttrs} style="margin-top:1rem;margin-bottom:1rem;${bgStyle}">
  ${labelHtml}
  <div style="display:flex;align-items:center;justify-content:center;gap:${sizeConf.gap};font-variant-numeric:tabular-nums;">
    ${cells}
  </div>
</div>`;
  }

  const bgStyle = timer.backgroundColor
    ? `background:${escapeAttr(timer.backgroundColor)};padding:1rem;border-radius:12px;`
    : "";
  const labelHtml = timer.label
    ? `<div style="text-align:center;font-weight:500;font-size:${sizeConf.lblFs};opacity:0.85;margin-bottom:0.75rem;">${escapeHtml(timer.label)}</div>`
    : "";
  const cardBg = timer.backgroundColor
    ? "rgba(255,255,255,0.08)"
    : "color-mix(in srgb, currentColor 6%, transparent)";
  const cards = units
    .map(
      (u) =>
        `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:0.5rem;min-width:calc(${sizeConf.numFs} * 1.6);padding:${sizeConf.padY} ${sizeConf.padX};background:${cardBg};border:1px solid color-mix(in srgb, currentColor 12%, transparent);">
  <span data-ff-timer-field="${u.key}" style="font-size:${sizeConf.numFs};font-weight:800;color:${escapeAttr(accentColor)};line-height:1;">${pad2(u.value)}</span>
  <span style="font-size:${sizeConf.lblFs};opacity:0.7;margin-top:0.25rem;">${escapeHtml(u.label)}</span>
</div>`,
    )
    .join("");
  return `<div class="ff-timer ff-timer--cards" ${dataAttrs} style="margin-top:1rem;margin-bottom:1rem;${bgStyle}">
  ${labelHtml}
  <div style="display:flex;align-items:stretch;justify-content:center;flex-wrap:wrap;gap:${sizeConf.gap};font-variant-numeric:tabular-nums;">
    ${cards}
  </div>
</div>`;
}

function extractTimers(section: FunnelSection): TimerItem[] {
  if (!Array.isArray(section.items)) return [];
  return section.items
    .filter((it): it is SectionItem & { kind: "timer" } => it.kind === "timer")
    .map((it) => it.data);
}

function renderSectionTimers(
  section: FunnelSection,
  funnel: Funnel,
  pageId: string,
): string {
  const timers = extractTimers(section);
  if (timers.length === 0) return "";
  return timers.map((t) => renderTimer(t, funnel, pageId)).join("\n");
}

function pageHasTimer(sections: FunnelSection[]): boolean {
  for (const s of sections) {
    if (s.visible === false) continue;
    if (extractTimers(s).length > 0) return true;
  }
  return false;
}

const FF_TIMER_SCRIPT = `
<script>
(function(){
  if (window.__ffTimerBooted) return;
  window.__ffTimerBooted = true;
  function pad2(n){ return String(Math.max(0, n|0)).padStart(2, "0"); }
  function getStart(scope, id){
    try{
      var k = "ff_timer_" + scope + "_" + id;
      var v = window.localStorage.getItem(k);
      if (v) { var p = parseInt(v, 10); if (!isNaN(p)) return p; }
      var now = Date.now();
      window.localStorage.setItem(k, String(now));
      return now;
    } catch(e){ return Date.now(); }
  }
  function computeTarget(el){
    var mode = el.getAttribute("data-ff-timer-mode");
    if (mode === "countdown-date") {
      var t = parseInt(el.getAttribute("data-ff-timer-target-ms") || "0", 10);
      return isNaN(t) ? 0 : t;
    }
    if (mode === "countdown-duration") {
      var dur = parseInt(el.getAttribute("data-ff-timer-duration-ms") || "0", 10);
      if (isNaN(dur) || dur <= 0) return 0;
      var scope = el.getAttribute("data-ff-timer-scope") || "default";
      var id = el.getAttribute("data-ff-timer-id") || "t";
      return getStart(scope, id) + dur;
    }
    return 0;
  }
  function updateFields(el, total){
    var showDays = el.getAttribute("data-ff-timer-show-days") === "true";
    var days = Math.floor(total / 86400000);
    var hours = Math.floor((total / 3600000) % 24);
    var minutes = Math.floor((total / 60000) % 60);
    var seconds = Math.floor((total / 1000) % 60);
    if (!showDays) { hours = hours + days * 24; }
    var f = el.querySelectorAll("[data-ff-timer-field]");
    for (var i = 0; i < f.length; i++) {
      var k = f[i].getAttribute("data-ff-timer-field");
      if (k === "days") f[i].textContent = pad2(days);
      else if (k === "hours") f[i].textContent = pad2(hours);
      else if (k === "minutes") f[i].textContent = pad2(minutes);
      else if (k === "seconds") f[i].textContent = pad2(seconds);
    }
  }
  function handleExpire(el){
    var behavior = el.getAttribute("data-ff-timer-on-expire") || "keep-zero";
    if (behavior === "hide") { el.style.display = "none"; return; }
    if (behavior === "show-message") {
      var msg = el.getAttribute("data-ff-timer-expired-msg") || "";
      el.className = "ff-timer ff-timer--expired";
      el.style.textAlign = "center";
      var safe = String(msg).replace(/[<>]/g, "");
      el.innerHTML = '<span style="font-weight:600;color:var(--ff-accent,#2563eb);">' + safe + '</span>';
      return;
    }
    updateFields(el, 0);
  }
  function bootTimer(el){
    var mode = el.getAttribute("data-ff-timer-mode");
    if (mode === "seats-counter") return;
    var target = computeTarget(el);
    if (!target) return;
    var itv;
    function tick(){
      var total = Math.max(0, target - Date.now());
      if (total === 0) { handleExpire(el); clearInterval(itv); return; }
      updateFields(el, total);
    }
    tick();
    itv = setInterval(tick, 1000);
  }
  function boot(){
    var nodes = document.querySelectorAll("[data-ff-timer]");
    for (var i = 0; i < nodes.length; i++) bootTimer(nodes[i]);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
</script>`;

// 🆕 Scroll-reveal pour l'export : sans JS les `ff-anim-*` jouent au chargement
// (fallback). Avec JS, on bascule en mode scroll (.ff-anim-scroll) : chaque
// élément reste figé (opacity:0) jusqu'à entrer dans le viewport → reveal animé
// au scroll, avec un léger stagger entre frères. Respecte reduced-motion et
// data-ff-animations="off". Pur vanilla, aucune dépendance.
const FF_SCROLL_ANIM_SCRIPT = `<script>
(function(){
  if (window.__ffScrollAnimBooted) return;
  window.__ffScrollAnimBooted = true;
  function boot(){
    var roots = document.querySelectorAll(".ff-page");
    if (!roots.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    var all = [];
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      if (root.getAttribute("data-ff-animations") === "off") continue;
      var els = root.querySelectorAll('[class*="ff-anim-"]');
      if (!els.length) continue;
      root.classList.add("ff-anim-scroll");
      for (var i = 0; i < els.length; i++) all.push(els[i]);
    }
    if (!all.length) return;
    function reveal(el){
      if (el.classList.contains("ff-in")) return;
      var p = el.parentElement, idx = 0;
      if (p) {
        var sibs = p.children;
        for (var k = 0; k < sibs.length; k++) {
          if (sibs[k] === el) break;
          if (sibs[k].className && String(sibs[k].className).indexOf("ff-anim-") > -1) idx++;
        }
      }
      if (idx > 0) el.style.animationDelay = Math.min(idx * 0.07, 0.28) + "s";
      el.classList.add("ff-in");
    }
    var vh = function(){ return window.innerHeight || document.documentElement.clientHeight; };
    if (!("IntersectionObserver" in window)) { all.forEach(reveal); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    all.forEach(function(el){
      var rect = el.getBoundingClientRect();
      if (rect.top < vh() && rect.bottom > 0) reveal(el);
      else io.observe(el);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
</script>`;

// ─────────────────────────────────────────────────────────────────────────────
// renderSection
// ─────────────────────────────────────────────────────────────────────────────
type SectionContext = {
  funnel: Funnel;
  isSuccess: boolean;
  pageId?: string;
  /** 🆕 Présent uniquement pour le rendu public → active les liens inter-pages */
  nav?: PublicNavContext;
};

function resolveLayout(section: FunnelSection, ctx: SectionContext): string {
  if (ctx.isSuccess) return "centered";
  const raw = effectiveLayoutVariant(section, ctx.funnel);
  if (raw === "split-text-image" || raw === "split-image-text") return "split";
  if (raw === "left-aligned") return "left-aligned";
  if (raw === "wide-banner") return "wide-banner";
  if (raw === "stacked-card") return "stacked-card";
  return "centered";
}

/** 🆕 Nb de bullets rendues en CARTES (grid) pour cette section. 0 si la section
 *  rend ses bullets en liste/bande (pas des cartes) → pas de split par cartes. */
function sectionCardCount(section: FunnelSection): number {
  if (!section.bullets?.length) return 0;
  const t = String(section.type || "");
  if (BULLET_LIST_ONLY_SECTIONS.has(t)) return 0;
  if (!BULLET_LAYOUT_SECTIONS.has(t)) return 0;
  if (bulletsFitInlineStrip(section.bullets)) return 0;
  return section.bullets.length;
}

/** 🆕 Équilibre d'un split SANS image mais AVEC cartes : côte-à-côte si la pile
 *  reste proche de la hauteur du texte, sinon empilé (texte centré + grille).
 *  Mirroir de splitCardsBalance côté aperçu. */
function splitCardsBalanceExport(section: FunnelSection): "side" | "stacked" {
  const n = sectionCardCount(section);
  if (n <= 2) return "side";
  if (n >= 4) return "stacked";
  const textChars =
    (section.headline?.length ?? 0) +
    (section.subheadline?.length ?? 0) +
    (section.body?.length ?? 0);
  const textLines = Math.ceil(textChars / 42) + 2;
  const cardLines = n * 2.4;
  return cardLines <= textLines * 1.3 ? "side" : "stacked";
}

/** 🆕 Eyebrow rendu CENTRÉ au-dessus du split (sorti du bloc texte). */
function renderSplitEyebrowTop(section: FunnelSection): string {
  if (!section.eyebrow) return "";
  return `<div class="ff-split-eyebrow-top"><span class="ff-eyebrow ${animClass(
    animOf(section, "eyebrow", "fade-in"),
  )}">${applyInlineHighlights(escapeHtml(section.eyebrow))}</span></div>`;
}

function renderSectionHeroIcon(
  section: FunnelSection,
  ctx: SectionContext,
): string {
  if (!ctx.isSuccess) return "";

  const s = section as FunnelSection & {
    iconSize?: "sm" | "md" | "lg";
    iconAnimation?: string;
  };

  const name: IconName = normalizeIconName(section.iconName ?? "checkCircle");
  const sizeMap: Record<string, number> = { sm: 56, md: 72, lg: 96 };
  const px = sizeMap[s.iconSize ?? "md"];

  const anim =
    s.iconAnimation && s.iconAnimation !== "none"
      ? s.iconAnimation
      : animOf(section, "image", "zoom-in");
  const animCls = animClass(anim);

  const svg = renderIconSvg(name, px);
  return `<div class="ff-section-hero-icon ${animCls}" aria-hidden="true">${svg}</div>`;
}

function renderSectionInnerContent(
  section: FunnelSection,
  ctx: SectionContext,
): string {
  const heroIcon = renderSectionHeroIcon(section, ctx);

  const eyebrow = section.eyebrow
    ? `<span class="ff-eyebrow ${animClass(animOf(section, "eyebrow", "fade-in"))}">${applyInlineHighlights(escapeHtml(section.eyebrow))}</span>`
    : "";
  const headline = section.headline
    ? `<h2 class="ff-headline ${animClass(animOf(section, "headline", "fade-up"))}">${applyInlineHighlights(escapeHtml(section.headline))}</h2>`
    : "";
  const subheadline = section.subheadline
    ? `<p class="ff-subheadline ${animClass(animOf(section, "subheadline", "fade-up"))}">${applyInlineHighlights(escapeHtml(section.subheadline))}</p>`
    : "";
  const body = section.body
    ? `<p class="ff-body ${animClass(animOf(section, "body", "fade-up"))}">${applyInlineHighlights(escapeHtml(section.body))}</p>`
    : "";

  const type = section.type as string;
  const hasItems = Array.isArray(section.items) && section.items.length > 0;
  let specialized = "";
  if (hasItems) {
    if (type === "pricing" || type === "offer") specialized = renderPricing(section, ctx.nav);
    else if (type === "bonus") specialized = renderBonus(section);
    else if (type === "testimonials" || type === "proof")
      specialized = renderTestimonials(section);
    else if (type === "faq") specialized = renderFaq(section);
    else if (type === "guarantee") specialized = renderGuarantee(section);
  }

  const bullets =
    !specialized && section.bullets?.length ? renderBullets(section) : "";

  const formHtml =
    type === "form" ? renderFormFields(section, ctx) : "";

  const image = renderImage(
    section.image,
    ctx.funnel,
    animOf(section, "image", "fade-in"),
  );
  const video = renderVideo(
    section.video?.url,
    animOf(section, "video", "zoom-in"),
  );

  const timersHtml = renderSectionTimers(
    section,
    ctx.funnel,
    ctx.pageId ?? "default",
  );

  const ctaWrapStyle = ctaWrapInlineStyle(section.cta?.spacing);
  const ctaStyleAttr = ctaWrapStyle ? ` style="${escapeAttr(ctaWrapStyle)}"` : "";
  const cta =
    section.cta?.label && type !== "form"
      ? `<div class="ff-cta-wrap ${animClass(animOf(section, "cta", "fade-up"))}"${ctaStyleAttr}>${renderCtaButton(section.cta, "", animOf(section, "cta", "fade-up"), ctx.nav)}</div>`
      : "";

  // 🆕 CTA secondaire (lien discret « Non merci, continuer » des pages OTO).
  const decline = section.secondaryCta?.label
    ? `<div class="ff-decline-wrap"><a href="${escapeAttr(ctaHref(section.secondaryCta, ctx.nav))}" class="ff-decline-link" data-ff-decline="true">${escapeHtml(section.secondaryCta.label)}</a></div>`
    : "";

  // 🆕 Liens/CTA supplémentaires (canaux : WhatsApp, Telegram, Instagram…).
  const extraCtas = renderExtraCtas(section.ctas, ctx.nav);

  return `${heroIcon}${eyebrow}${headline}${subheadline}${body}${bullets}${specialized}${video}${image}${formHtml}${timersHtml}${cta}${decline}${extraCtas}`;
}

function renderFormFields(
  section: FunnelSection,
  ctx: SectionContext,
): string {
  const language = ctx.funnel.language;
  const fields = (section.items || []).filter(
    (it): it is SectionItem & { kind: "formField" } => it.kind === "formField",
  );
  const labels = {
    fr: { submit: "Envoyer" },
    en: { submit: "Submit" },
    es: { submit: "Enviar" },
  } as const;
  const l = labels[language] ?? labels.fr;
  const ctaLabel = section.cta?.label || l.submit;
  const list: FormFieldItem[] = fields.length
    ? fields.map((f) => f.data)
    : [{ name: "email", label: "Email", type: "email", required: true, width: "full" }];

  const fieldsHtml = list
    .map((f, idx) => {
      const isHalf = f.width === "half";
      const wrapCls = `ff-field${isHalf ? " ff-field--half" : ""}`;
      const name = escapeAttr(f.name || `field_${idx}`);
      const label = f.label
        ? `<label class="ff-field-label" for="${name}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label>`
        : "";
      const ph = escapeAttr(f.placeholder || "");
      const req = f.required ? " required" : "";
      let input = "";
      if (f.type === "textarea") {
        input = `<textarea class="ff-input" id="${name}" name="${name}" placeholder="${ph}" rows="4"${req}></textarea>`;
      } else if (f.type === "select") {
        const opts = (f.options || [])
          .map((o) => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`)
          .join("");
        input = `<select class="ff-input" id="${name}" name="${name}"${req}><option value="">${escapeHtml(f.placeholder || "—")}</option>${opts}</select>`;
      } else if (f.type === "checkbox") {
        input = `<label class="ff-checkbox"><input type="checkbox" id="${name}" name="${name}"${req} /><span>${escapeHtml(f.placeholder || f.label || "")}</span></label>`;
        return `<div class="${wrapCls}">${input}</div>`;
      } else {
        input = `<input class="ff-input" type="${f.type}" id="${name}" name="${name}" placeholder="${ph}"${req} />`;
      }
      return `<div class="${wrapCls}">${label}${input}</div>`;
    })
    .join("\n");

  const reassuranceRaw = section.reassurance;
  const reassuranceText =
    reassuranceRaw === undefined
      ? DEFAULT_REASSURANCE
      : reassuranceRaw.trim() === ""
        ? null
        : reassuranceRaw;
  const reassuranceHtml = reassuranceText
    ? `<p class="ff-reassurance">${escapeHtml(reassuranceText)}</p>`
    : "";

  const nav = ctx.nav;
  const captureTags = section.formConfig?.captureTags ?? [];
  const tagsAttr =
    captureTags.length > 0 ? ` data-ff-tags="${escapeAttr(captureTags.join(","))}"` : "";
  const dataAttrs = nav
    ? ` data-ff-funnel-slug="${escapeAttr(nav.publicSlug)}"` +
      ` data-ff-page-slug="${escapeAttr(ctx.pageId ? nav.pageSlugById[ctx.pageId] ?? "" : "")}"` +
      ` data-ff-section-id="${escapeAttr(section.id ?? "")}"` +
      (nav.nextUrl ? ` data-ff-next-url="${escapeAttr(nav.nextUrl)}"` : "") +
      tagsAttr
    : "";

  return `<form class="ff-form-fields" action="#" method="post"${dataAttrs}>
${fieldsHtml}
<button type="submit" class="ff-btn ff-form-submit">${escapeHtml(ctaLabel)}</button>
${reassuranceHtml}
</form>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 FIX PARITÉ SKINS — CTA final & cartes programme/process
//
// Constat (vérifié en base sur un funnel réel) : les templates "factory"
// (bold-energy, lead-snap, story-sell, clean-light, premium-minimal,
// trust-pro) ont, dans l'aperçu live, un DEUXIÈME système de rendu qui prend
// le dessus sur le rendu générique ET sur le système de "patterns" — le skin
// (components/funnel/templates/skins/factory.tsx). Pour ces templates,
// `section.pattern` est ignoré : c'est skin.sections[section.type] qui décide
// du rendu (ex. "cta" → panneau sombre avec halo, "process"/"program" → cartes
// à badge numéroté coloré). L'export n'a jamais porté ce système, d'où le CTA
// final et les cartes "3 étapes" visuellement différents entre aperçu et
// export SIO. On reproduit ici, à l'identique, UNIQUEMENT les deux rendus
// explicitement signalés (cta / process / program), pilotés par les mêmes
// tokens que le live (T2–T7_TOKENS) pour rester fidèle aux 6 templates d'un
// coup. Un template non couvert (ex. sharp-launch, bespoke) retombe sans
// changement sur le rendu générique existant — zéro régression.
// ─────────────────────────────────────────────────────────────────────────────

const FACTORY_SKIN_TOKENS: Record<string, SkinTokens> = {
  "lead-snap": T2_TOKENS,
  "story-sell": T3_TOKENS,
  "clean-light": T4_TOKENS,
  "premium-minimal": T5_TOKENS,
  "trust-pro": T6_TOKENS,
  "bold-energy": T7_TOKENS,
};

/** Port fidèle de factory.tsx → brandAware() : les tokens hex "figés" du
 *  template (ink/body/muted/cardBg/cardBorder) deviennent des expressions
 *  var(--ff-brand-*, fallback) — actives UNIQUEMENT quand une couleur de
 *  marque est active (ces variables ne sont posées, en inline style, que par
 *  buildThemeRootAttrs() quand design.brandColorsEnabled === true). */
function brandAwareSkinTokens(t: SkinTokens): SkinTokens {
  const isHex = (v: string) => /^#([0-9a-f]{3,8})$/i.test(v.trim());
  const wrap = (v: string, name: string) => (isHex(v) ? `var(${name}, ${v})` : v);
  return {
    ...t,
    ink: `var(--ff-brand-ink, ${t.ink})`,
    body: `var(--ff-brand-body, ${t.body})`,
    muted: `var(--ff-brand-muted, ${t.muted})`,
    cardBg: wrap(t.cardBg, "--ff-brand-card-bg"),
    cardBorder: wrap(t.cardBorder, "--ff-brand-card-border"),
    faqBg: wrap(t.faqBg, "--ff-brand-card-bg"),
    faqBorder: wrap(t.faqBorder, "--ff-brand-card-border"),
  };
}

function getFactorySkinTokens(funnel: Funnel): SkinTokens | undefined {
  const meta = funnel.meta as { templateId?: string } | undefined;
  const design = (funnel.design ?? {}) as { templateId?: string };
  const templateId = meta?.templateId ?? design.templateId;
  const raw = templateId ? FACTORY_SKIN_TOKENS[templateId] : undefined;
  return raw ? brandAwareSkinTokens(raw) : undefined;
}

/** Bloc eyebrow/headline/subheadline/body + CTA(s), factorisé pour être
 *  réutilisé par les rendus "skin" ci-dessous à la place de
 *  renderSectionInnerContent() (dont on ne veut PAS la portion `bullets`,
 *  remplacée par `cardsHtml`). */
function renderSkinTextAndCta(
  section: FunnelSection,
  ctx: SectionContext,
  cardsHtml: string,
  splitMediaHtml?: string,
): string {
  // 🆕 FIX PARITÉ Head() (factory.tsx) : pour les sections cartes/étapes
  // (qualification/solution/benefits/process/program), le skin live n'utilise
  // JAMAIS le rendu générique eyebrow+headline+subheadline+body — il rend
  // le bloc "Head" : eyebrow + titre + UN SEUL sous-titre COURT, TOUJOURS
  // CENTRÉ (y compris la dernière ligne), max-width 620px, jamais justifié.
  // "section.body" (corps long-forme) n'est JAMAIS affiché par Head/
  // makeProcess/makeCards — la justification est réservée aux cartes/about.
  // L'ancien code de l'export affichait subheadline JUSTIFIÉ (classe
  // générique .ff-subheadline) PUIS body en plus → sous-titre mal aligné
  // ("Places limitées" non centré) et paragraphe fantôme absent de l'aperçu
  // live, d'où le "décalage" signalé entre les deux blocs de texte.
  const eyebrow = section.eyebrow
    ? `<div class="ff-eyebrow ${animClass(animOf(section, "eyebrow", "fade-in"))}" style="text-align:center">${applyInlineHighlights(escapeHtml(section.eyebrow))}</div>`
    : "";
  const headline = section.headline
    ? `<h2 class="ff-headline ${animClass(animOf(section, "headline", "fade-up"))}">${applyInlineHighlights(escapeHtml(section.headline))}</h2>`
    : "";
  const subheadline = section.subheadline
    ? `<p class="ff-subheadline ${animClass(animOf(section, "subheadline", "fade-up"))}" style="text-align:center;max-width:620px;margin:14px auto 0">${applyInlineHighlights(escapeHtml(section.subheadline))}</p>`
    : "";
  const ctaWrapStyle = ctaWrapInlineStyle(section.cta?.spacing);
  const ctaStyleAttr = ctaWrapStyle ? ` style="${escapeAttr(ctaWrapStyle)}"` : "";
  const cta = section.cta?.label
    ? `<div class="ff-cta-wrap ${animClass(animOf(section, "cta", "fade-up"))}"${ctaStyleAttr}>${renderCtaButton(section.cta, "", animOf(section, "cta", "fade-up"), ctx.nav)}</div>`
    : "";
  const extraCtas = renderExtraCtas(section.ctas, ctx.nav);
  const headHtml = eyebrow || headline || subheadline
    ? `<div style="text-align:center;margin-bottom:44px">${eyebrow}${headline}${subheadline}</div>`
    : "";

  // 🆕 FIX PARITÉ withSectionImage() (factory.tsx) : quand la section porte
  // une image, le skin live garde le Head() centré PLEINE LARGEUR au-dessus,
  // et ne met en grille split (contre l'image) que les cartes/étapes — pas
  // l'eyebrow/titre comme pour le hero. Avant ce fix, une section process/
  // program AVEC image sortait entièrement du rendu skin (retombait sur le
  // rendu générique hors-split) → sous-titre non centré et body fantôme
  // réapparaissaient, d'où le "recadrage hors sections split pas effectif".
  if (splitMediaHtml) {
    const variant = effectiveLayoutVariant(section, ctx.funnel);
    const order =
      variant === "split-image-text"
        ? `<div class="ff-split-media">${splitMediaHtml}</div><div class="ff-split-text">${cardsHtml}</div>`
        : `<div class="ff-split-text">${cardsHtml}</div><div class="ff-split-media">${splitMediaHtml}</div>`;
    const ctaCentered =
      cta ? `<div style="text-align:center;margin-top:40px">${cta}</div>` : "";
    return `${headHtml}<div class="ff-split-grid">${order}</div>${ctaCentered}${extraCtas}`;
  }

  return `${headHtml}${cardsHtml}${cta}${extraCtas}`;
}

/** Port de factory.tsx → makeFinalCta(). Panneau plein (fond sombre du
 *  template, halo radial en accent) — remplace le rendu générique du CTA
 *  final pour les templates factory-skinnés. */
function renderSkinCtaFinalSection(
  section: FunnelSection,
  t: SkinTokens,
  ctx: SectionContext,
): string {
  const eyebrowHtml = section.eyebrow
    ? `<div class="ff-skin-cta-final__eyebrow">${applyInlineHighlights(escapeHtml(section.eyebrow))}</div>`
    : "";
  const headlineHtml = section.headline
    ? `<h2 class="ff-skin-cta-final__headline">${applyInlineHighlights(escapeHtml(section.headline))}</h2>`
    : "";
  const subBody = section.subheadline || section.body;
  const subHtml = subBody
    ? `<p class="ff-skin-cta-final__sub">${applyInlineHighlights(escapeHtml(subBody))}</p>`
    : "";
  const ctaHtml = section.cta?.label
    ? renderCtaButton(section.cta, "ff-skin-cta-final__btn", animOf(section, "cta", "fade-up"), ctx.nav)
    : "";
  const extraCtasHtml = renderExtraCtas(section.ctas, ctx.nav);
  const reassuranceHtml = section.reassurance
    ? `<p class="ff-skin-cta-final__reassurance">${applyInlineHighlights(escapeHtml(section.reassurance))}</p>`
    : "";

  const boxStyle = [
    `border-radius:${t.cardRadius + 10}px`,
    `background:${t.ctaPanelBg}`,
    `--sk-cta-ink:${t.ctaPanelInk}`,
    `--sk-cta-sub:${t.ctaPanelSub}`,
    `--sk-accent:${t.accent}`,
  ].join(";");
  const glowStyle = `background:radial-gradient(circle, color-mix(in srgb, ${t.accent} 30%, transparent), transparent 65%)`;

  return `<section id="${escapeAttr(section.id)}" class="ff-section ff-cta ff-layout-centered" data-ff-section="cta" data-ff-section-id="${escapeAttr(section.id)}" data-ff-custom-bg="true">
  <div class="ff-section-inner">
    <div class="ff-skin-cta-final" style="${escapeAttr(boxStyle)}">
      <div class="ff-skin-cta-final__glow" aria-hidden="true" style="${escapeAttr(glowStyle)}"></div>
      <div class="ff-skin-cta-final__content">
        ${eyebrowHtml}${headlineHtml}${subHtml}${ctaHtml}${extraCtasHtml}${reassuranceHtml}
      </div>
    </div>
  </div>
</section>`;
}

/** Port de factory.tsx → makeProcess() / renderCardsVariant(). Cartes à badge
 *  numéroté (couleur accent/accent2 alternée) ou lignes numérotées ("editorial"),
 *  selon t.processRows — remplace la liste à puces générique pour les sections
 *  process/program des templates factory-skinnés. */
function renderSkinProcessCards(section: FunnelSection, t: SkinTokens): string {
  const bullets = (Array.isArray(section.bullets) ? section.bullets : []).filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (bullets.length === 0) return "";

  if (t.processRows) {
    const rows = bullets
      .map((b, i) => {
        const split = splitBulletTitleDesc(b);
        const isLast = i === bullets.length - 1;
        const textHtml = split
          ? `<div><h3 class="ff-skin-process-row__title">${applyInlineHighlights(escapeHtml(split.title))}</h3><p class="ff-skin-process-row__desc">${applyInlineHighlights(escapeHtml(split.description))}</p></div>`
          : `<p class="ff-skin-process-row__desc">${applyInlineHighlights(escapeHtml(b))}</p>`;
        return `<div class="ff-skin-process-row${isLast ? " ff-skin-process-row--last" : ""}"><div class="ff-skin-process-row__num">${String(i + 1).padStart(2, "0")}</div>${textHtml}</div>`;
      })
      .join("\n");
    return `<div class="ff-skin-process-rows">${rows}</div>`;
  }

  const cards = bullets
    .map((b, i) => {
      const split = splitBulletTitleDesc(b);
      const badgeBg = t.numberVariant === "chip-grad" ? t.grad : i % 2 === 0 ? t.accent : t.accent2;
      const badgeCircle = t.numberVariant === "circle";
      const badgeStyle = [
        `width:${badgeCircle ? 50 : 58}px`,
        `height:${badgeCircle ? 50 : 58}px`,
        `border-radius:${badgeCircle ? "50%" : "14px"}`,
        `background:${badgeBg}`,
      ].join(";");
      const cardStyle = [
        `border-radius:${t.cardRadius}px`,
        `background:${t.cardBg}`,
        `border:${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
      ].join(";");
      const textHtml = split
        ? `<h3 class="ff-skin-process-card__title">${applyInlineHighlights(escapeHtml(split.title))}</h3><p class="ff-skin-process-card__desc">${applyInlineHighlights(escapeHtml(split.description))}</p>`
        : `<p class="ff-skin-process-card__desc">${applyInlineHighlights(escapeHtml(b))}</p>`;
      return `<div class="ff-skin-process-card" style="${escapeAttr(cardStyle)}"><div class="ff-skin-process-card__num" style="${escapeAttr(badgeStyle)}">${i + 1}</div>${textHtml}</div>`;
    })
    .join("\n");
  const cols = Math.min(3, Math.max(2, bullets.length));
  return `<div class="ff-skin-process-grid" data-cols="${cols}">${cards}</div>`;
}

function renderSkinProcessSection(
  section: FunnelSection,
  t: SkinTokens,
  ctx: SectionContext,
  hasImage: boolean,
): string {
  const cardsHtml = renderSkinProcessCards(section, t);
  // 🆕 Variante avec image (port withSectionImage()) : cf. commentaire dans
  // renderSkinTextAndCta. Ne s'applique qu'aux sections process/program
  // portant une image réelle — sinon comportement inchangé.
  const mediaHtml = hasImage
    ? renderImage(section.image, ctx.funnel, animOf(section, "image", "fade-in"))
    : "";
  const inner = renderSkinTextAndCta(section, ctx, cardsHtml, mediaHtml || undefined);
  const layoutClass = mediaHtml ? "ff-layout-split" : "ff-layout-centered";
  const layoutAttr = mediaHtml ? "split" : "centered";
  return `<section id="${escapeAttr(section.id)}" class="ff-section ff-${escapeAttr(section.type as string)} ${layoutClass}" data-ff-section="${escapeAttr(section.type as string)}" data-ff-section-id="${escapeAttr(section.id)}" data-ff-layout="${layoutAttr}">
  <div class="ff-section-inner">${inner}</div>
</section>`;
}

/** Port de factory.tsx → makeUrgency(). Le skin live n'affiche JAMAIS
 *  section.subheadline pour l'urgence : un SEUL titre (priorité
 *  timer.label > headline > eyebrow), en petit badge centré, au-dessus du
 *  compte à rebours — dans un panneau aux couleurs dédiées (t.urgencyBg).
 *  L'ancien rendu générique de l'export affichait headline ET subheadline
 *  ("Places limitées") côte à côte, non centré → contenu fantôme absent de
 *  l'aperçu live, d'où le signalement. Le minuteur lui-même réutilise
 *  renderSectionTimers (script JS partagé, inchangé). */
function renderSkinUrgencySection(
  section: FunnelSection,
  t: SkinTokens,
  ctx: SectionContext,
): string {
  const timers = extractTimers(section);
  const title = (timers[0]?.label || section.headline || section.eyebrow || "").trim();
  const titleHtml = title
    ? `<div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:${escapeAttr(t.accent)};font-weight:700;margin-bottom:22px;text-align:center">${applyInlineHighlights(escapeHtml(title))}</div>`
    : "";
  // 🆕 Le titre ci-dessus (titleHtml) reprend déjà timer.label en priorité —
  // on le retire des items avant renderSectionTimers() pour éviter un
  // doublon (renderTimer() ré-affiche sinon timer.label DANS le panneau).
  const sectionForTimer: FunnelSection = Array.isArray(section.items)
    ? {
        ...section,
        items: section.items.map((it) =>
          it.kind === "timer" && it.data.label
            ? { ...it, data: { ...it.data, label: undefined } }
            : it,
        ),
      }
    : section;
  const timerHtml = renderSectionTimers(sectionForTimer, ctx.funnel, ctx.pageId ?? "default");
  const panelStyle = [
    `background:${t.urgencyBg}`,
    `border:${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
    `border-radius:${t.cardRadius + 8}px`,
    `padding:40px 28px`,
    `text-align:center`,
  ].join(";");
  return `<section id="${escapeAttr(section.id)}" class="ff-section ff-urgency ff-layout-centered" data-ff-section="urgency" data-ff-section-id="${escapeAttr(section.id)}">
  <div class="ff-section-inner">
    <div style="${escapeAttr(panelStyle)}">
      ${titleHtml}${timerHtml}
    </div>
  </div>
</section>`;
}

function renderSection(
  section: FunnelSection,
  ctx: SectionContext,
  isFirst: boolean,
): string {
  const hasVideoEarly = isUsableMediaUrl(section.video?.url);
  const hasImageEarly =
    !!section.image &&
    section.image.mode !== "none" &&
    (isUsableMediaUrl(section.image.url) ||
      isUsableMediaUrl(materializeSectionImage(section.image, ctx.funnel)?.url));

  // 🆕 FIX PARITÉ SKINS (voir bloc de commentaires ci-dessus) : pour les
  // templates "factory" (bold-energy, lead-snap, story-sell, clean-light,
  // premium-minimal, trust-pro), le CTA final, l'urgence et les cartes
  // process/program ont un rendu bespoke qui prend le dessus sur le rendu
  // générique dans l'aperçu live — on reproduit ce comportement ici. Scopé
  // aux sections SANS image/vidéo pour cta-final/urgency (makeFinalCta/
  // makeUrgency ne gèrent pas d'image côté live) ; avec image, on retombe
  // sur le rendu générique existant (inchangé) pour ces deux-là.
  const skinTokens = getFactorySkinTokens(ctx.funnel);
  if (!hasImageEarly && !hasVideoEarly) {
    if (skinTokens) {
      if (
        section.type === "cta" &&
        (section.headline || section.cta?.label || section.body || section.subheadline)
      ) {
        return renderSkinCtaFinalSection(section, skinTokens, ctx);
      }
      if (
        section.type === "urgency" &&
        (section.headline || section.eyebrow || extractTimers(section).length > 0)
      ) {
        return renderSkinUrgencySection(section, skinTokens, ctx);
      }
    }
  }
  // 🆕 process/program : contrairement à cta-final/urgency, le skin live
  // (makeProcess() + withSectionImage()) GÈRE le cas avec image — le Head()
  // reste centré pleine largeur, seules les cartes/étapes passent en split
  // contre l'image. On ne sort donc PAS du rendu skin quand une image est
  // présente (seule la vidéo, non gérée par le skin, retombe sur le
  // générique) — avant ce fix, une section process/program avec image
  // perdait tout le fix de centrage/alignement du Head().
  if (!hasVideoEarly && skinTokens) {
    if (
      (section.type === "process" || section.type === "program") &&
      Array.isArray(section.bullets) &&
      section.bullets.some((b) => typeof b === "string" && b.trim().length > 0)
    ) {
      return renderSkinProcessSection(section, skinTokens, ctx, hasImageEarly);
    }
  }

  // 🆕 FIX SPLIT SKIN (hero à image) : dans l'aperçu live, makeHero() force
  // TOUJOURS le layout "split" (texte à gauche, CTA sous le texte, média à
  // droite) dès qu'une IMAGE réelle est présente — indépendamment de
  // `section.layoutVariant` stocké (souvent resté à "centered" par défaut).
  // resolveLayout(), lui, respecte tel quel un layoutVariant explicite
  // non-split → d'où le hero qui ressortait centré à l'export alors qu'il
  // est split dans l'aperçu. On reproduit ici la même règle.
  // ⚠️ Scopé au SEUL type "hero" : pour qualification/solution/benefits/
  // process/program, le skin garde le TITRE centré pleine largeur (Head, tou-
  // jours textAlign:center) et ne « split » que les cartes/étapes contre
  // l'image (withSectionImage), PAS l'ensemble eyebrow+titre+CTA comme le
  // hero. Le layout "split" générique de l'export, lui, met tout le bloc
  // texte (y compris titre) dans la colonne de gauche → forcer split ici
  // pour ces types désalignerait le titre au lieu de le corriger.
  const skinForcesSplit =
    !!skinTokens &&
    !ctx.isSuccess &&
    hasImageEarly &&
    !hasVideoEarly &&
    section.type === "hero" &&
    sectionHasSubstantialText(section);

  const layout = skinForcesSplit ? "split" : resolveLayout(section, ctx);
  const isHero = section.type === "hero" || isFirst;
  const hasVideo = hasVideoEarly;
  const hasImage = hasImageEarly;

  const shadow = buildShadowStyle(section.style);

  const classes = ["ff-section", `ff-${section.type}`, `ff-layout-${layout}`];
  if (isHero) classes.push("ff-hero");

  if (hasVideo && layout === "split") classes.push("ff-layout-video-stack");

  const spacing = (section.style as { spacing?: string } | undefined)?.spacing;
  if (spacing === "compact") classes.push("ff-spacing-compact");
  if (spacing === "large") classes.push("ff-spacing-large");

  if (shadow.className) classes.push(shadow.className.trim());

  const baseInlineStyle = buildSectionInlineStyle(section);
  const mergedInlineStyle = [baseInlineStyle, shadow.inline]
    .filter((s) => s && s.length > 0)
    .join(";")
    .replace(/;;+/g, ";");
  const styleAttr = mergedInlineStyle
    ? ` style="${escapeAttr(mergedInlineStyle)}"`
    : "";

  const overlay = sectionOverlay(section);

  let inner = "";
  if (layout === "split" && hasImage && !hasVideo) {
    const eyebrowTop = renderSplitEyebrowTop(section);
    const textBlock = renderSectionInnerContent(
      { ...section, eyebrow: undefined, image: undefined, video: undefined } as FunnelSection,
      ctx,
    );
    const mediaBlock = renderImage(
      section.image,
      ctx.funnel,
      animOf(section, "image", "fade-in"),
    );
    const variant = effectiveLayoutVariant(section, ctx.funnel);
    const order =
      variant === "split-image-text"
        ? `<div class="ff-split-media">${mediaBlock}</div><div class="ff-split-text">${textBlock}</div>`
        : `<div class="ff-split-text">${textBlock}</div><div class="ff-split-media">${mediaBlock}</div>`;
    inner = `<div class="ff-section-inner">${eyebrowTop}<div class="ff-split-grid">${order}</div></div>`;
  } else if (
    layout === "split" &&
    !hasImage &&
    !hasVideo &&
    sectionCardCount(section) > 0 &&
    splitCardsBalanceExport(section) === "side"
  ) {
    // 🆕 Split SANS image mais AVEC cartes : texte d'un côté, cartes de l'autre.
    const eyebrowTop = renderSplitEyebrowTop(section);
    const textBlock = renderSectionInnerContent(
      { ...section, eyebrow: undefined, bullets: undefined, image: undefined, video: undefined } as FunnelSection,
      ctx,
    );
    const cardsBlock = renderBullets(section);
    const variant = effectiveLayoutVariant(section, ctx.funnel);
    const order =
      variant === "split-image-text"
        ? `<div class="ff-split-media ff-split-cards">${cardsBlock}</div><div class="ff-split-text">${textBlock}</div>`
        : `<div class="ff-split-text">${textBlock}</div><div class="ff-split-media ff-split-cards">${cardsBlock}</div>`;
    inner = `<div class="ff-section-inner">${eyebrowTop}<div class="ff-split-grid">${order}</div></div>`;
  } else if (hasVideo) {
    const textBlock = renderSectionInnerContent(
      { ...section, image: undefined, video: undefined } as FunnelSection,
      ctx,
    );
    const videoBlock = renderVideo(
      section.video?.url,
      animOf(section, "video", "zoom-in"),
    );
    inner = `<div class="ff-section-inner"><div class="ff-split-grid"><div class="ff-split-text">${textBlock}</div>${videoBlock ? `<div class="ff-split-media">${videoBlock}</div>` : ""}</div></div>`;
  } else {
    inner = `<div class="ff-section-inner">${renderSectionInnerContent(section, ctx)}</div>`;
  }

  // 🆕 FIX ATTRIBUT MANQUANT : "data-ff-section" n'était jamais posé sur le
  // rendu générique (seuls les rendus "skin" dédiés — cta/process/urgency —
  // l'avaient). Or plusieurs règles CSS du thème en dépendent (alternance de
  // fonds testimonials/faq/pricing/..., proportions image/texte de "about",
  // etc.) → elles ne matchaient JAMAIS pour la quasi-totalité des sections
  // exportées. Miroir de FunnelPreview.tsx qui pose déjà data-ff-section
  // partout dans l'aperçu live.
  return `<section id="${escapeAttr(section.id)}" class="${classes.join(" ")}"${styleAttr} data-ff-section="${escapeAttr(section.type as string)}" data-ff-layout="${layout}"${hasVideo ? ' data-ff-has-video="true"' : ""}>
${overlay}${inner}
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header & Footer
// ─────────────────────────────────────────────────────────────────────────────
function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const seps = [" - ", " – ", " — ", " | ", " : "];
  for (const s of seps) {
    const i = fullName.indexOf(s);
    if (i > 0) return fullName.slice(0, i).trim();
  }
  return fullName.trim();
}

function renderHeader(funnel: Funnel, nav?: PublicNavContext): string {
  const h: FunnelHeader = funnel.header ?? {};
  if (h.enabled === false) return "";
  const logo = h.logoUrl ?? funnel.meta?.logoUrl;
  const brand = h.brandName ?? extractBrandName(funnel.funnelName || "");
  const displayMode = h.displayMode ?? "both";
  const showLogo = (displayMode === "logo" || displayMode === "both") && !!logo;
  const showName = (displayMode === "name" || displayMode === "both") && !!brand;
  // 🆕 Badge événement (mode Live) — voir components/funnel/FunnelHeader.tsx.
  const eventLabel = formatEventBadge(h.eventDateTime, funnel.language);
  if (!showLogo && !showName && !h.cta?.label && !eventLabel) return "";

  const classes = ["ff-brand-bar"];
  if (h.sticky) classes.push("ff-brand-bar--sticky");
  if (h.transparent) classes.push("ff-brand-bar--transparent");

  let brandType: "text" | "logo" | "both" = "text";
  if (showLogo && showName) brandType = "both";
  else if (showLogo) brandType = "logo";
  else if (showName) brandType = "text";

  const hasCta = !!h.cta?.label;
  const ctaHtml = h.cta?.label ? renderBrandCtaButton(h.cta, nav) : "";
  const eventHtml = eventLabel
    ? `<div class="ff-header-event"><span class="ff-header-event-dot" aria-hidden="true"></span><span>${escapeHtml(eventLabel)}</span></div>`
    : "";

  return `<div class="${classes.join(" ")}" data-ff-brand-type="${brandType}" data-ff-brand-has-cta="${hasCta ? "true" : "false"}">
  <div class="ff-brand-bar-inner">
    <div class="ff-brand-id">
      ${showLogo ? `<img src="${escapeAttr(logo!)}" alt="" />` : ""}
      ${showName ? `<span>${escapeHtml(brand)}</span>` : ""}
    </div>
    ${eventHtml}
    ${ctaHtml}
  </div>
</div>`;
}

// 🆕 FIX PARITÉ FOOTER — miroir de components/funnel/FunnelFooter.tsx (aperçu
// live), qui propose 3 variantes pilotées par funnel.meta.footerVariant.
// L'export n'implémentait QUE l'équivalent de "footer-minimal-centered" et
// ignorait totalement footerVariant → un funnel réglé sur "footer-grid-sitemap"
// (marque+description / Navigation / Contact, 3 colonnes) retombait sur un
// footer minimal (nom + copyright), d'où l'écart signalé entre aperçu et export.
const FOOTER_I18N: Record<
  "fr" | "en" | "es",
  {
    rights: string;
    legalFallback: string;
    contactLabel: string;
    nav: string;
    newsletterTitle: string;
    newsletterSubtitle: string;
    emailPlaceholder: string;
    subscribe: string;
  }
> = {
  fr: {
    rights: "Tous droits réservés",
    legalFallback:
      "Ce site n'est pas affilié à Facebook, Google, ou toute autre plateforme tierce. Les résultats mentionnés ne sont pas garantis et peuvent varier selon votre engagement et votre situation personnelle.",
    contactLabel: "Contact",
    nav: "Navigation",
    newsletterTitle: "Reste informé",
    newsletterSubtitle: "Reçois nos meilleurs conseils et nos nouveautés directement par email.",
    emailPlaceholder: "Votre adresse email",
    subscribe: "Je m'inscris",
  },
  en: {
    rights: "All rights reserved",
    legalFallback:
      "This site is not affiliated with Facebook, Google, or any other third-party platform. Results mentioned are not guaranteed and may vary based on your engagement and personal situation.",
    contactLabel: "Contact",
    nav: "Navigation",
    newsletterTitle: "Stay in the loop",
    newsletterSubtitle: "Get our best tips and latest updates straight to your inbox.",
    emailPlaceholder: "Your email address",
    subscribe: "Subscribe",
  },
  es: {
    rights: "Todos los derechos reservados",
    legalFallback:
      "Este sitio no está afiliado a Facebook, Google ni a ninguna otra plataforma de terceros. Los resultados mencionados no están garantizados y pueden variar según su compromiso y situación personal.",
    contactLabel: "Contacto",
    nav: "Navegación",
    newsletterTitle: "Mantente al día",
    newsletterSubtitle: "Recibe nuestros mejores consejos y novedades directamente en tu correo.",
    emailPlaceholder: "Tu correo electrónico",
    subscribe: "Suscribirme",
  },
};

function normalizeFooterVariant(
  v: string | undefined,
): "footer-minimal-centered" | "footer-grid-sitemap" | "footer-cta-newsletter" {
  if (v === "footer-grid-sitemap" || v === "footer-cta-newsletter") return v;
  return "footer-minimal-centered";
}

function renderFooter(funnel: Funnel, nav?: PublicNavContext): string {
  const meta = funnel.meta;
  const lang = (funnel.language as "fr" | "en" | "es") || "fr";
  const t = FOOTER_I18N[lang] ?? FOOTER_I18N.fr;

  const businessName = meta?.businessName?.trim();
  const displayName =
    businessName ||
    funnel.header?.brandName?.trim() ||
    extractBrandName(funnel.funnelName || "") ||
    funnel.funnelName?.trim() ||
    "—";

  const legalNotice = meta?.legalNotice?.trim() || t.legalFallback;
  const contactEmail = meta?.contactEmail?.trim();
  const year = new Date().getFullYear();

  const copyHtml = `<div class="ff-footer-copy">© ${year} ${escapeHtml(displayName)} — ${escapeHtml(t.rights)}</div>`;

  const variant = normalizeFooterVariant(meta?.footerVariant);

  if (variant === "footer-grid-sitemap") {
    const pages = (funnel.pages ?? []).filter((p) => p.visible !== false);
    const navCol =
      pages.length > 0
        ? `<div class="ff-footer-col">
      <div class="ff-footer-col-title">${escapeHtml(t.nav)}</div>
      ${pages
        .map((p) => {
          const href = nav ? publicPageUrl(nav, p.id) : null;
          const label = escapeHtml(p.name || p.slug || "");
          return href
            ? `<a class="ff-footer-nav-link" href="${escapeAttr(href)}">${label}</a>`
            : `<span class="ff-footer-nav-link ff-footer-nav-link--static">${label}</span>`;
        })
        .join("\n      ")}
    </div>`
        : "";

    const contactCol = `<div class="ff-footer-col">
      <div class="ff-footer-col-title">${escapeHtml(t.contactLabel)}</div>
      ${
        contactEmail
          ? `<a class="ff-footer-nav-link ff-footer-nav-link--accent" href="mailto:${escapeAttr(contactEmail)}">${escapeHtml(contactEmail)}</a>`
          : `<span class="ff-footer-nav-link ff-footer-nav-link--static">—</span>`
      }
    </div>`;

    return `<footer class="ff-footer ff-footer--sitemap">
  <div class="ff-footer-inner ff-footer-inner--grid">
    <div class="ff-footer-grid">
      <div class="ff-footer-col ff-footer-col--brand">
        <div class="ff-footer-brand">${escapeHtml(displayName)}</div>
        <div class="ff-footer-legal">${escapeHtml(legalNotice)}</div>
      </div>
      ${navCol}
      ${contactCol}
    </div>
    ${copyHtml}
  </div>
</footer>`;
  }

  if (variant === "footer-cta-newsletter") {
    return `<footer class="ff-footer ff-footer--newsletter">
  <div class="ff-footer-inner ff-footer-inner--newsletter">
    <div class="ff-footer-newsletter-title">${escapeHtml(t.newsletterTitle)}</div>
    <p class="ff-footer-newsletter-sub">${escapeHtml(t.newsletterSubtitle)}</p>
    <a class="ff-btn ff-footer-newsletter-btn" href="#lead-form">${escapeHtml(t.subscribe)}</a>
    <div class="ff-footer-newsletter-divider">
      <div class="ff-footer-brand">${escapeHtml(displayName)}</div>
      <div class="ff-footer-legal">${escapeHtml(legalNotice)}</div>
      ${contactEmail ? `<div><a class="ff-footer-link" href="mailto:${escapeAttr(contactEmail)}">${escapeHtml(contactEmail)}</a></div>` : ""}
      ${copyHtml}
    </div>
  </div>
</footer>`;
  }

  // footer-minimal-centered (défaut historique)
  return `<footer class="ff-footer">
  <div class="ff-footer-inner">
    <div class="ff-footer-brand">${escapeHtml(displayName)}</div>
    <div class="ff-footer-legal">${escapeHtml(legalNotice)}</div>
    ${contactEmail ? `<div><a class="ff-footer-link" href="mailto:${escapeAttr(contactEmail)}">${escapeHtml(contactEmail)}</a></div>` : ""}
    ${copyHtml}
  </div>
</footer>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compression images
// ─────────────────────────────────────────────────────────────────────────────
async function compressDataUrlImage(
  dataUrl: string,
  maxWidth = 1200,
  maxBytes = 120_000,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  if (dataUrl.length <= maxBytes) return dataUrl;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("img load failed"));
      i.src = dataUrl;
    });

    const ratio = Math.min(1, maxWidth / img.naturalWidth);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const qualities = [0.82, 0.7, 0.6, 0.5, 0.4];
    let best: string | null = null;
    for (const q of qualities) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (out.length <= maxBytes) return out;
      best = out;
    }
    return best;
  } catch (e) {
    console.warn("[ff-export] compressDataUrlImage failed:", e);
    return null;
  }
}

export async function prepareImagesForExport(funnel: Funnel): Promise<Funnel> {
  if (typeof window === "undefined") return funnel;

  const clone: Funnel = JSON.parse(JSON.stringify(funnel));
  let nb = 0;

  if (clone.header?.logoUrl?.startsWith("data:image/") && clone.header.logoUrl.length > 60_000) {
    const c = await compressDataUrlImage(clone.header.logoUrl, 320, 40_000);
    if (c) { clone.header.logoUrl = c; nb++; }
  }

  const allSections: FunnelSection[] = [
    ...(clone.sections ?? []),
    ...((clone.pages ?? []).flatMap((p) => p.sections ?? [])),
  ];

  for (const section of allSections) {
    const img = section.image;
    if (img?.url?.startsWith("data:image/") && img.url.length > 150_000) {
      const c = await compressDataUrlImage(img.url, 1200, 120_000);
      if (c) { img.url = c; nb++; }
    }

    const bg = section.background;
    if (bg?.imageUrl?.startsWith("data:image/") && bg.imageUrl.length > 150_000) {
      const c = await compressDataUrlImage(bg.imageUrl, 1600, 140_000);
      if (c) { bg.imageUrl = c; nb++; }
    }

    if (Array.isArray(section.items)) {
      for (const it of section.items) {
        if (it.kind === "testimonial") {
          const d = it.data;
          if (d.avatarUrl?.startsWith("data:image/") && d.avatarUrl.length > 30_000) {
            const c = await compressDataUrlImage(d.avatarUrl, 120, 15_000);
            if (c) { d.avatarUrl = c; nb++; }
          }
          if (Array.isArray(d.medias)) {
            for (const m of d.medias) {
              if (m.kind === "image" && m.url?.startsWith("data:image/") && m.url.length > 150_000) {
                const c = await compressDataUrlImage(m.url, 1200, 120_000);
                if (c) { m.url = c; nb++; }
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(clone.media)) {
    for (const m of clone.media) {
      if (m.kind === "image" && m.url?.startsWith("data:image/") && m.url.length > 150_000) {
        const c = await compressDataUrlImage(m.url, 1200, 120_000);
        if (c) { m.url = c; nb++; }
      }
    }
  }

  if (nb > 0) {
    console.info(`[ff-export] prepareImagesForExport : ${nb} image(s) compressee(s) pour l'export SIO.`);
  }
  return clone;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 PARTIE 2 — Restylage du POPUP NATIF systeme.io aux couleurs du tunnel.
// On NE crée PAS de contenu (ça doublait la carte) : on génère un <style> CSS
// ciblé sur l'id du popup SIO, qui recolore fond/texte/bouton. Aucun JS, aucun
// overlay : SIO garde son formulaire, son CTA et son déclencheur. À coller dans
// un bloc Code HTML à l'intérieur du popup (un <style> s'applique globalement).
// ─────────────────────────────────────────────────────────────────────────────

/** Luminance perçue 0..1 d'une couleur hex (#rgb ou #rrggbb). 0.5 si inconnue. */
function hexLuminance(hex?: string): number {
  if (!hex) return 0.5;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texte lisible (sombre/clair) sur un fond donné. */
function inkOn(bg?: string): string {
  return hexLuminance(bg) < 0.5 ? "#ffffff" : "#0f172a";
}

/**
 * Extrait l'id du popup systeme.io depuis ce que l'utilisateur colle (script,
 * bloc HTML, ou id brut comme « row-c66ce9c8 »). Retourne un id CSS sûr ou null.
 */
export function extractSioPopupId(raw: string): string | null {
  if (!raw) return null;
  const text = raw.trim();

  // ⚠️ `form-script-tag-…` est l'id du SCRIPT de formulaire SIO, PAS un élément
  // du DOM du popup → inutilisable comme sélecteur. On l'exclut.
  const isUsable = (id: string) =>
    /^[A-Za-z][\w-]*$/.test(id) && !/^form-script-tag/i.test(id) && !/script/i.test(id);

  // 1) id brut collé tel quel (ex. row-c66ce9c8 ou #row-c66ce9c8)
  if (/^#?[A-Za-z][\w-]*$/.test(text)) {
    const id = text.replace(/^#/, "");
    if (isUsable(id)) return id;
  }

  // 2) Priorité aux ids d'ÉLÉMENTS stylables SIO (row-/col-/section-/el-)
  const elPat = text.match(/\b((?:row|col|section|el)[-_][0-9a-zA-Z]{4,})\b/);
  if (elPat?.[1] && isUsable(elPat[1])) return elPat[1];

  // 3) Repli : id="..." (en excluant les ids de script)
  const idAttrs = [...text.matchAll(/id\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const cand of idAttrs) {
    if (isUsable(cand)) return cand;
  }

  // 4) Repli : sélecteur #... (en excluant les ids de script)
  const hashes = [...text.matchAll(/#([A-Za-z][\w-]+)/g)].map((m) => m[1]);
  for (const cand of hashes) {
    if (isUsable(cand)) return cand;
  }

  return null;
}

/** Mélange deux couleurs hex (ratio 0..1 vers `target`). Repli : retourne base. */
function mixHex(base: string, target: string, ratio: number): string {
  const parse = (hx: string): [number, number, number] | null => {
    let h = hx.trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const a = parse(base);
  const b = parse(target);
  if (!a || !b) return base;
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * ratio));
  return "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Génère un <style> qui recolore le popup natif SIO aux VRAIES couleurs du
 * thème du tunnel. CSS pur, aucun JS. Cible le bloc du popup, et optionnellement
 * le CTA (dégradé animé) et les champs de saisie via leurs ids.
 */
export function renderPopupRestyleCss(
  funnel: Funnel,
  popupId: string,
  opts: { ctaId?: string; inputIds?: string[]; textIds?: string[] } = {},
): string {
  const id = popupId.replace(/^#/, "");
  // 🆕 Vraies couleurs du thème (pas funnel.design générique).
  const { bg, ink, accent } = getThemeColors(funnel);
  const btnInk = inkOn(accent);
  const accent2 = mixHex(accent, "#ffffff", 0.38); // 2ᵉ teinte pour le dégradé
  const fieldBorder = "rgba(0,0,0,0.15)";

  const ctaId = opts.ctaId?.replace(/^#/, "");
  const inputIds = (opts.inputIds ?? []).map((x) => x.replace(/^#/, "")).filter(Boolean);

  const rules: string[] = [
    `#${id}{background:${bg} !important;}`,
    `#${id},#${id} h1,#${id} h2,#${id} h3,#${id} h4,#${id} h5,#${id} p,#${id} span,#${id} li,#${id} label,#${id} div{color:${ink} !important;}`,
    // Boutons génériques du popup → accent (repli si pas d'id CTA précis)
    `#${id} a,#${id} button,#${id} [type="submit"],#${id} input[type="button"],#${id} input[type="submit"]{background:${accent} !important;border-color:${accent} !important;}`,
    `#${id} a,#${id} a *,#${id} button,#${id} button *,#${id} [type="submit"],#${id} [type="submit"] *{color:${btnInk} !important;}`,
    // Champs de saisie du popup → lisibles
    `#${id} input[type="text"],#${id} input[type="email"],#${id} input[type="tel"],#${id} input[type="number"],#${id} textarea,#${id} select{color:#0f172a !important;background:#ffffff !important;border:1px solid ${fieldBorder} !important;}`,
  ];

  // 🆕 CTA précis : dégradé animé aux couleurs du thème.
  if (ctaId) {
    rules.push(
      `@keyframes ffPopupCtaGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`,
      `#${ctaId},#${ctaId} button{background:linear-gradient(90deg,${accent},${accent2},${accent}) !important;background-size:200% 100% !important;border:0 !important;animation:ffPopupCtaGrad 3s ease infinite !important;box-shadow:0 6px 18px ${mixHex(accent, "#000000", 0.2)}55 !important;}`,
      `#${ctaId},#${ctaId} *{color:${btnInk} !important;}`,
    );
  }

  // 🆕 Champs de saisie précis (ids fournis).
  for (const inId of inputIds) {
    rules.push(
      `#${inId}{color:#0f172a !important;background:#ffffff !important;border:1px solid ${fieldBorder} !important;}`,
    );
  }

  // 🆕 Textes / titres précis (ids fournis) → couleur d'encre du thème, y
  // compris les <span> internes qui portent une couleur inline.
  const textIds = (opts.textIds ?? []).map((x) => x.replace(/^#/, "")).filter(Boolean);
  for (const tId of textIds) {
    rules.push(`#${tId},#${tId} *{color:${ink} !important;}`);
  }

  const css = rules.join("\n");
  return (
    `<!-- Restyle du popup systeme.io « ${id} » aux couleurs du thème (CSS only, no JS).\n` +
    `     À coller dans un bloc Code HTML placé À L'INTÉRIEUR du popup. SIO garde\n` +
    `     son formulaire, son CTA et son déclencheur. -->\n` +
    `<style>\n${css}\n</style>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 1 — Page complète standalone
// ─────────────────────────────────────────────────────────────────────────────
export type RenderFunnelHtmlOptions = {
  targetPageId?: string;
  fullDocument?: boolean;
  /** 🆕 Slug public du funnel. Présent → active les liens inter-pages /p/<slug>/... */
  publicSlug?: string;
};

export function renderFunnelHtml(
  funnel: Funnel,
  options: RenderFunnelHtmlOptions = {},
): string {
  const { sections: pageSections, role, isHome, pageId } = resolveExportPage(
    funnel,
    options.targetPageId,
  );

  // 🆕 Contexte de navigation publique : uniquement si un publicSlug est fourni.
  const nav: PublicNavContext | undefined = options.publicSlug
    ? {
        publicSlug: options.publicSlug,
        homePageId: (funnel.pages ?? []).find((p) => p.isHome)?.id,
        pageSlugById: Object.fromEntries(
          (funnel.pages ?? []).map((p) => [p.id, p.slug]),
        ),
      }
    : undefined;

  // 🆕 URL de la page suivante (après soumission de formulaire / CTA sans cible).
  if (nav) {
    const pages = funnel.pages ?? [];
    const curIdx = pages.findIndex((p) => p.id === pageId);
    if (curIdx >= 0 && curIdx < pages.length - 1) {
      nav.nextUrl = publicPageUrl(nav, pages[curIdx + 1].id) ?? undefined;
    }
  }

  const ctx: SectionContext = {
    funnel,
    isSuccess:
      role === "thankyou" || role === "delivery" || role === "confirmation",
    pageId,
    nav,
  };

  const visibleSections = pageSections.filter((s) => s.visible !== false);

  const isFullyClonedFunnel = pageIsAllRawHtml(visibleSections);
  const hasAnyRawHtml = pageHasRawHtml(visibleSections);

  const clonedHeadHtml = isFullyClonedFunnel
    ? extractClonedHeadForExport(funnel)
    : "";

  const themeCssBlock = isFullyClonedFunnel
    ? ""
    : `<style>
${getFunnelThemeCss()}
</style>`;

  // 🆕 FIX couleurs de marque : les overrides --ff-bg/--ff-accent/... sont
  // désormais posés en inline style par buildThemeRootAttrs() (voir
  // theme-css.ts) — un <style> séparé (ancien renderDesignOverrideCss) perdait
  // la bataille de spécificité CSS contre .ff-page[data-ff-theme="..."].
  const designOverrideBlock = "";

  const rootAttrs = isFullyClonedFunnel
    ? { dataAttrs: {} as Record<string, string>, inlineStyle: "" }
    : buildThemeRootAttrs(funnel);

  const sectionsHtml = visibleSections
    .map((section, idx) => {
      if (isRawHtmlSection(section)) return renderRawHtmlSection(section);
      return renderSection(section, ctx, idx === 0);
    })
    .join("\n");

  const needsSystemeScript = pageHasSystemePopup(visibleSections, funnel);
  const systemeIntegrationScript =
    needsSystemeScript && funnel.integrations?.systemeIoScriptId
      ? `\n${funnel.integrations.systemeIoScriptId.trim()}\n`
      : "";

  const timerScript = pageHasTimer(visibleSections) ? FF_TIMER_SCRIPT : "";

  // 🆕 FAQ runtime : injecté dès qu'il y a au moins une section raw-html.
  // Sur la page publique, les FAQ démarrent fermées (cf. RAW_HTML_EXPORT_CSS)
  // et ce script gère l'ouverture/fermeture au clic.
  const faqRuntimeScript = hasAnyRawHtml ? FAQ_RUNTIME_SCRIPT : "";

  const rawHtmlExtraCss = hasAnyRawHtml ? RAW_HTML_EXPORT_CSS : "";

  const styleAttr = rootAttrs.inlineStyle
    ? ` style="${escapeAttr(rootAttrs.inlineStyle)}"`
    : "";

  const pageRoleAttr = role ? ` data-ff-page-role="${escapeAttr(role)}"` : "";
  const pageHomeAttr = isHome ? ` data-ff-page-home="true"` : "";
  const clonedFlagAttr = isFullyClonedFunnel ? ` data-ff-fully-cloned="true"` : "";

  const dataAttrsHtml = serializeDataAttrs(rootAttrs.dataAttrs);

  // 🆕 Header uniquement sur la page d'accueil : un tunnel est un parcours, les
  // pages secondaires (merci, accès, etc.) n'ont pas besoin du header de l'optin.
  const headerHtml = isFullyClonedFunnel || !isHome ? "" : renderHeader(funnel, nav);
  const footerHtml = isFullyClonedFunnel ? "" : renderFooter(funnel, nav);

  // 🆕 CTA runtime : overlay popup interne + script de capture/redirection.
  const internalPopup =
    !isFullyClonedFunnel && pageHasInternalPopup(visibleSections, funnel);
  const popupLabel =
    visibleSections.find((s) => ctaIsInternalPopup(s.cta))?.cta?.label ||
    funnel.header?.cta?.label ||
    "";
  const popupCaptureTags = internalPopup
    ? collectInternalPopupTags(visibleSections, funnel)
    : [];
  const popupOverlayHtml = internalPopup
    ? renderInternalPopupOverlay(funnel, nav, popupLabel, pageId, popupCaptureTags)
    : "";
  const formScript = isFullyClonedFunnel ? "" : FF_FORM_SCRIPT;
  // 🆕 Animations au scroll (révèle les sections en descendant). Inutile sur un
  // funnel entièrement cloné (HTML brut → pas de classes ff-anim-*).
  const scrollAnimScript = isFullyClonedFunnel ? "" : FF_SCROLL_ANIM_SCRIPT;

  const body = `${themeCssBlock}
${designOverrideBlock}
${clonedHeadHtml}
${rawHtmlExtraCss}
<div class="ff-page"
     data-ff-export="true"
     ${dataAttrsHtml}${pageRoleAttr}${pageHomeAttr}${clonedFlagAttr}${styleAttr}>

${headerHtml}
${sectionsHtml}
${footerHtml}
</div>
${popupOverlayHtml}
${systemeIntegrationScript}${timerScript}${faqRuntimeScript}${formScript}${scrollAnimScript}`;

  if (!options.fullDocument) return body;

  const title = escapeHtml(funnel.funnelName || "Funnel");
  return `<!doctype html>
<html lang="${escapeAttr(funnel.language || "fr")}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
</head>
<body>
${body}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 2 — Blocs individuels autonomes (Systeme.io)
// NB : aucun `nav` passé ici → les CTA pageId retombent sur l'ancre, ce qui est
// le comportement voulu pour l'export Systeme.io (les pages y sont publiées
// séparément, mappées via funnel.integrations.sioPageUrls).
// ─────────────────────────────────────────────────────────────────────────────
export type SystemeBlock = {
  id: string;
  label: string;
  type: string;
  html: string;
};

export type CreateSystemeBlocksOptions = {
  targetPageId?: string;
};

function makeBlockScopeClass(section: FunnelSection): string {
  const raw = `ffblk-${section.type}-${section.id}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

export function createSystemeBlocks(
  funnel: Funnel,
  options: CreateSystemeBlocksOptions = {},
): SystemeBlock[] {
  const rootAttrs = buildThemeRootAttrs(funnel);
  const { sections: pageSections, role, pageId } = resolveExportPage(
    funnel,
    options.targetPageId,
  );

  const ctx: SectionContext = {
    funnel,
    isSuccess:
      role === "thankyou" || role === "delivery" || role === "confirmation",
    pageId,
  };

  const clonedHeadHtml = extractClonedHeadForExport(funnel);

  return pageSections
    .filter((s) => s.visible !== false)
    .map((section, idx) => {
      const scopeClass = makeBlockScopeClass(section);

      // 🆕 RAW HTML — Cas section clonée
      if (isRawHtmlSection(section)) {
        const sectionHtml = renderRawHtmlSection(section);
        const html = `<style>
  .${scopeClass} { width: 100%; max-width: 100%; margin: 0; padding: 0; display: block; }
  .${scopeClass} .ff-raw-html { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; display: block; }
  .${scopeClass} .ff-raw-html > section,
  .${scopeClass} .ff-raw-html > div,
  .${scopeClass} .ff-raw-html > main,
  .${scopeClass} .ff-raw-html > article {
    max-width: 100% !important;
    width: 100% !important;
  }
  .${scopeClass} img,
  .${scopeClass} video { max-width: 100%; height: auto; }

  /* Neutraliser animations JS-dépendantes */
  .${scopeClass} [data-aos],
  .${scopeClass} .aos-init {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .${scopeClass} [id^="image-"] {
    opacity: 1 !important;
    transform: none !important;
  }
  .${scopeClass} .animate-on-load,
  .${scopeClass} [class*="animate__"] {
    opacity: 1 !important;
    animation: none !important;
  }
  .${scopeClass} img,
  .${scopeClass} video,
  .${scopeClass} picture {
    opacity: 1 !important;
    visibility: visible !important;
  }

  /* Cliquabilité des CTA */
  .${scopeClass} a,
  .${scopeClass} a[id^="button-"],
  .${scopeClass} [data-test-ui="open-url-button"],
  .${scopeClass} [role="button"] {
    pointer-events: auto !important;
    cursor: pointer !important;
  }

  /* 🆕 FAQ : état initial FERMÉ dans le bloc public */
  .${scopeClass} [data-ff-faq-grid] .ff-faq-closed { display: none !important; }
  .${scopeClass} [data-ff-faq-grid] .ff-faq-open {
    display: block !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  .${scopeClass} [data-ff-faq-grid] [data-ff-active] {
    cursor: pointer !important;
    user-select: none !important;
  }
</style>
${clonedHeadHtml}
${SCROLL_ANIMATION_REVEAL_CSS}
<div class="${scopeClass}" data-ff-export="true" data-ff-raw-html-block="true">
${sectionHtml}
</div>
${FAQ_RUNTIME_SCRIPT}`;

        const sizeKB = Math.round(html.length / 1024);
        if (sizeKB > 800) {
          console.warn(`[ff-export] Bloc RAW HTML ${section.id} = ${sizeKB} KB (limite SIO ~1024 KB)`);
        }

        return {
          id: section.id,
          label:
            (section.headline && section.headline.trim()) ||
            `Section ${idx + 1}`,
          type: "raw-html",
          html,
        };
      }

      // ── Cas natif
      const scopedTheme = getScopedFunnelThemeCss(scopeClass);
      const sectionHtml = renderSection(section, ctx, idx === 0);

      const sectionHasSystemePopup =
        (section.cta && isSystemePopup(section.cta)) ||
        (Array.isArray(section.items) &&
          section.items.some(
            (it) =>
              it.kind === "pricing" &&
              it.data.cta &&
              isSystemePopup(it.data.cta),
          ));
      const systemeIntegrationScript =
        sectionHasSystemePopup && funnel.integrations?.systemeIoScriptId
          ? `\n${funnel.integrations.systemeIoScriptId.trim()}\n`
          : "";

      const sectionHasTimer = extractTimers(section).length > 0;
      const timerScript = sectionHasTimer ? FF_TIMER_SCRIPT : "";

      const styleAttr = rootAttrs.inlineStyle
        ? ` style="${escapeAttr(rootAttrs.inlineStyle)}"`
        : "";

      const dataAttrsHtml = serializeDataAttrs(rootAttrs.dataAttrs);

      const html = `<style>
${scopedTheme}
</style>
<div class="${scopeClass} ff-page"
     data-ff-export="true"
     ${dataAttrsHtml}${styleAttr}>
${sectionHtml}
</div>
${systemeIntegrationScript}${timerScript}`;

      return {
        id: section.id,
        label: section.headline || section.type,
        type: section.type,
        html,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc formulaire final (lead-form autonome)
// ─────────────────────────────────────────────────────────────────────────────
export function createSystemeFormBlock(funnel: Funnel): SystemeBlock {
  const scopeClass = "ffblk-lead-form";
  const scopedTheme = getScopedFunnelThemeCss(scopeClass);
  const rootAttrs = buildThemeRootAttrs(funnel);

  const labels = {
    fr: {
      title: "Recevoir les détails",
      name: "Votre nom",
      email: "Email",
      submit: "Continuer",
    },
    en: {
      title: "Get the details",
      name: "Your name",
      email: "Email",
      submit: "Continue",
    },
    es: {
      title: "Recibir los detalles",
      name: "Tu nombre",
      email: "Email",
      submit: "Continuar",
    },
  } as const;
  const l = labels[funnel.language] ?? labels.fr;

  const styleAttr = rootAttrs.inlineStyle
    ? ` style="${escapeAttr(rootAttrs.inlineStyle)}"`
    : "";

  const dataAttrsHtml = serializeDataAttrs(rootAttrs.dataAttrs);

  const html = `<style>
${scopedTheme}
</style>
<div class="${scopeClass} ff-page"
     data-ff-export="true"
     ${dataAttrsHtml}${styleAttr}>

  <section id="lead-form" class="ff-section ff-form ff-layout-centered">
    <div class="ff-section-inner">
      <h2 class="ff-headline ff-anim-fade-up">${escapeHtml(l.title)}</h2>
      <form class="ff-form-fields" action="#" method="post">
        <div class="ff-field"><label class="ff-field-label" for="lf-name">${escapeHtml(l.name)} *</label><input class="ff-input" type="text" id="lf-name" name="name" required /></div>
        <div class="ff-field"><label class="ff-field-label" for="lf-email">${escapeHtml(l.email)} *</label><input class="ff-input" type="email" id="lf-email" name="email" required /></div>
        <button type="submit" class="ff-btn ff-form-submit">${escapeHtml(l.submit)}</button>
      </form>
    </div>
  </section>
</div>`;

  return {
    id: "lead-form",
    label: l.title,
    type: "form",
    html,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide d'import
// ─────────────────────────────────────────────────────────────────────────────
export function createImportGuide(language: Funnel["language"] = "fr"): string {
  const guides = {
    fr: [
      "Guide d'import dans systeme.io",
      "",
      "1. Ouvrez systeme.io et créez un nouveau tunnel",
      "2. Ajoutez la page de capture ou de vente correspondant à votre objectif",
      "3. Glissez un bloc HTML personnalisé dans la section voulue",
      "4. Collez le contenu de funnel-complet.html (mode complet) OU collez chaque bloc de blocs/ un par un dans l'ordre indiqué",
      "5. Aucun ajustement de marge n'est nécessaire",
      "6. Vérifiez que vos liens CTA pointent vers vos pages de paiement, formulaires ou rendez-vous",
      "7. Pour les CTA popup Systeme.io : créez d'abord une étape « Formulaire » dans Systeme.io, copiez le script <script id=\"form-script-tag-…\"> et collez-le dans Paramètres du funnel → Liaison Systeme.io → Script Systeme.io. Renseignez ensuite l'ID du popup dans chaque CTA concerné.",
      "8. Prévisualisez la page sur mobile avant publication",
    ],
    en: [
      "systeme.io import guide",
      "",
      "1. Open systeme.io and create a new funnel",
      "2. Add the capture or sales page that matches your goal",
      "3. Drag a Custom HTML block into the target section",
      "4. Paste the content of funnel-complete.html (full mode) OR paste each file from blocks/ one by one in order",
      "5. No margin adjustment needed",
      "6. Make sure your CTA links point to your payment pages, forms or booking links",
      "7. For Systeme.io popup CTAs: first create a Form step in Systeme.io, copy the <script id=\"form-script-tag-…\"> and paste it into Funnel settings → Systeme.io Link → Systeme.io script. Then fill the popup ID in each CTA.",
      "8. Preview the page on mobile before publishing",
    ],
    es: [
      "Guía de importación en systeme.io",
      "",
      "1. Abre systeme.io y crea un nuevo embudo",
      "2. Añade la página de captura o de venta que corresponda a tu objetivo",
      "3. Arrastra un bloque HTML personalizado en la sección deseada",
      "4. Pega el contenido de embudo-completo.html (modo completo) O pega cada archivo de bloques/ uno a uno en orden",
      "5. No es necesario ajustar márgenes",
      "6. Comprueba que tus enlaces CTA apuntan a tus páginas de pago, formularios o citas",
      "7. Para CTAs popup de Systeme.io: crea primero un paso de Formulario en Systeme.io, copia el <script id=\"form-script-tag-…\"> y pégalo en Ajustes del embudo → Enlace Systeme.io → Script Systeme.io. Luego rellena el ID del popup en cada CTA.",
      "8. Previsualiza la página en móvil antes de publicar",
    ],
  } as const;
  return (guides[language] ?? guides.fr).join("\n");
}

// 🆕 renderDesignOverrideCss (ancien mécanisme de couleurs de marque) a été
// retiré : il émettait un <style>.ff-page{...} qui perdait systématiquement
// la bataille de spécificité CSS contre .ff-page[data-ff-theme="..."], et
// ignorait design.brandColorsEnabled (recolorait même les funnels non
// brandés). Remplacé par l'injection inline (style="") dans
// theme-css.ts → buildThemeRootAttrs(), gardée par brandColorsEnabled et
// alignée sur components/funnel/TemplateThemeProvider.tsx (aperçu live).

// ─────────────────────────────────────────────────────────────────────────────
// ZIP exports
// ─────────────────────────────────────────────────────────────────────────────
export async function createHtmlZipBase64(funnel: Funnel): Promise<string> {
  const compressed = await prepareImagesForExport(funnel);
  const prepared = flattenRawHtmlPatches(compressed);
  const fullHtml = renderFunnelHtml(prepared, { fullDocument: true });
  const blocks = createSystemeBlocks(prepared);
  const formBlock = createSystemeFormBlock(prepared);
  const guide = createImportGuide(prepared.language);

  const fileNames = {
    fr: "funnel-complet.html",
    en: "funnel-complete.html",
    es: "embudo-completo.html",
  } as const;

  const files: Record<string, Uint8Array> = {
    [fileNames[prepared.language] ?? "funnel-complete.html"]: strToU8(fullHtml),
    "guide-import-systeme.txt": strToU8(guide),
  };

  blocks.forEach((b, i) => {
    const safe = `${String(i + 1).padStart(2, "0")}-${b.type}-${b.id}`
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase();
    files[`blocs/${safe}.html`] = strToU8(b.html);
  });
  files[`blocs/99-form-${formBlock.id}.html`] = strToU8(formBlock.html);

  const zipped = zipSync(files);
  return Buffer.from(zipped).toString("base64");
}

export async function createSystemeIoZipBase64(funnel: Funnel): Promise<string> {
  const compressed = await prepareImagesForExport(funnel);
  const prepared = flattenRawHtmlPatches(compressed);

  // Debug : log léger pour traquer les patches non flattenés
  console.log("[ff-export DEBUG] env=", typeof document,
    "pages=", (prepared?.pages || []).map((pg: any) => ({
      pageId: pg.id,
      slug: pg.slug,
      sections: (pg.sections || []).map((s: any) => ({
        id: s.id,
        type: s.type,
        hasPatches: !!s.rawHtmlPatches,
        textKeys: Object.keys(s.rawHtmlPatches?.texts || {}),
        linkKeys: Object.keys(s.rawHtmlPatches?.links || {}),
      })),
    })),
  );

  const fullHtml = renderFunnelHtml(prepared, { fullDocument: true });
  const blocks = createSystemeBlocks(prepared);
  const formBlock = createSystemeFormBlock(prepared);

  const { sections: activeSections } = resolveExportPage(prepared);

  const previewName = {
    fr: "apercu-complet.html",
    en: "funnel-complete.html",
    es: "embudo-completo.html",
  } as const;

  const blockEntries = blocks.map((b, i) => {
    const safe = `${String(i + 1).padStart(2, "0")}-${b.type}-${b.id}`
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase();
    const fileName = `${safe}.html`;
    const section = activeSections.find((s) => s.id === b.id);
    const hasPopup = section?.cta?.mode === "popup";
    const sizeKB = Math.round(b.html.length / 1024);
    if (sizeKB > 800) {
      console.warn(`[ff-export] Bloc ${b.id} = ${sizeKB} KB (limite SIO ~1024 KB)`);
    }
    return {
      fileName: `blocs-systeme-io/${fileName}`,
      type: b.type,
      label: b.label,
      hasPopup,
      _zipPath: `blocs-systeme-io/${fileName}`,
      _html: b.html,
    };
  });

  const formFileName = `99-form-${formBlock.id}.html`
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
  blockEntries.push({
    fileName: `blocs-systeme-io/${formFileName}`,
    type: "form",
    label: formBlock.label,
    hasPopup: false,
    _zipPath: `blocs-systeme-io/${formFileName}`,
    _html: formBlock.html,
  });

  const readme = createReadme(
    prepared,
    blockEntries.map((b) => ({
      fileName: b.fileName.replace("blocs-systeme-io/", ""),
      type: b.type,
      label: b.label,
      hasPopup: b.hasPopup,
    })),
  );

  const files: Record<string, Uint8Array> = {
    "README.md": strToU8(readme),
    [previewName[prepared.language] ?? "apercu-complet.html"]: strToU8(fullHtml),
  };
  blockEntries.forEach((b) => {
    files[b._zipPath] = strToU8(b._html);
  });

  const zipped = zipSync(files);
  return Buffer.from(zipped).toString("base64");
}

export function renderFunnelCss(_funnel?: Funnel): string {
  // CSS scopé sous .ff-page, SANS reset global (body/html/*) : ce CSS est
  // destiné à être injecté dans un contexte existant (preview/éditeur, bloc
  // systeme.io) où des règles globales body/html parasiteraient la page hôte.
  return getFunnelThemeCssNoGlobalReset();
}
