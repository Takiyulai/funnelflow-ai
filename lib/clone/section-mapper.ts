// lib/clone/section-mapper.ts
/**
 * Transforme un ParsedPageData (sortie du parser) en Funnel complet
 * prêt à être sauvegardé et chargé par l'éditeur existant.
 *
 * Responsabilités :
 * 1. Mapper chaque ClonedSection → FunnelSection avec headline obligatoire.
 * 2. Si une section raw-html contient plusieurs <section> top-level,
 *    l'éclater en N FunnelSection distinctes (édition fine du fond).
 * 3. Construire la FunnelPage racine (rôle "landing" par défaut).
 * 4. Assembler le Funnel complet avec design, médias, SEO et thank-you par défaut.
 * 5. Référencer les médias par mediaRef vers la bibliothèque centrale.
 * 6. Encapsuler le HTML brut dans `body` (préfixé) pour les sections raw-html.
 */

import {
  makePageId,
  FUNNEL_SCHEMA_VERSION,
  type Funnel,
  type FunnelPage,
  type FunnelSection,
  type FunnelSectionType,
  type Language,
  type MediaItem,
  type PageRole,
} from "@/lib/funnels/types";
import type {
  ClonedMediaAsset,
  ClonedSection,
  NativeClonedSection,
  ParsedPageData,
  RawHtmlClonedSection,
} from "./types";

/**
 * Marqueur en début de body pour identifier une section raw-html.
 */
export const RAW_HTML_BODY_MARKER = "[[RAW_HTML]]";

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────────────────────────────────────

export function mapToFunnel(
  parsed: ParsedPageData,
  language: Language,
  sourceUrl: string
): Funnel {
  console.log(
    `[section-mapper] Mapping ${parsed.sections.length} sections → Funnel`
  );

  // 1. Bibliothèque de médias (utilise uploadedUrl si dispo, sinon sourceUrl)
  const mediaLibrary = buildMediaLibrary(parsed.mediaAssets);

  // 2. Sections du Funnel (aplatissement des éclatements raw-html)
  const funnelSections: FunnelSection[] = [];
  parsed.sections.forEach((section, index) => {
    const mapped = mapSection(section, index, parsed.mediaAssets, language);
    if (Array.isArray(mapped)) {
      funnelSections.push(...mapped);
    } else {
      funnelSections.push(mapped);
    }
  });

  console.log(
    `[section-mapper] Après éclatement raw-html : ${funnelSections.length} FunnelSection(s) au total.`
  );

  // 3. Page racine (landing par défaut sur un clone)
  const homePage: FunnelPage = {
    id: makePageId(),
    slug: "home",
    name: parsed.title || "Home",
    role: "landing" satisfies PageRole,
    sections: funnelSections,
    visible: true,
    isHome: true,
    seo: {
      title: parsed.title,
      description: parsed.metaDescription,
    },
    meta: {
      createdAt: new Date().toISOString(),
    },
  };

  // 4. Funnel complet
  const funnel: Funnel = {
    funnelName: parsed.title || "Cloned funnel",
    language,

    pages: [homePage],

    // Legacy alias obligatoire (rétrocompat éditeur)
    sections: funnelSections,

    thankYouPage: buildDefaultThankYou(language),
    emails: [],

    seo: {
      title: parsed.title || "Cloned funnel",
      description: parsed.metaDescription || `Cloned from ${sourceUrl}`,
    },

    design: {
      primaryColor: parsed.palette.primary,
      secondaryColor: parsed.palette.secondary,
      accentColor: parsed.palette.accent,
      style: "modern",
      animationsEnabled: true,
    },

    media: mediaLibrary,

    meta: {
      creationMode: "free",
      schemaVersion: FUNNEL_SCHEMA_VERSION,
      clonedHead: parsed.globalHead,
      // 🆕 Phase 1A : attributs du <body> source, réappliqués au <body> de
      // l'iframe pour que les règles body{…}/body.x{…}/#id{…} et le style
      // inline du body s'appliquent (fond fidèle).
      clonedBody: {
        className: parsed.bodyClass,
        id: parsed.bodyId,
        style: parsed.bodyStyle,
      },
    } as Funnel["meta"],
  };

  console.log(
    `[section-mapper] ✅ Funnel built : ${funnel.pages?.[0].sections.length} sections, ${funnel.media?.length ?? 0} medias, design=${funnel.design.primaryColor}/${funnel.design.secondaryColor}/${funnel.design.accentColor}, head=${parsed.globalHead.length} chars`
  );

  return funnel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Médias
// ─────────────────────────────────────────────────────────────────────────────

function buildMediaLibrary(assets: ClonedMediaAsset[]): MediaItem[] {
  return assets.map((asset) => ({
    id: asset.id,
    kind: asset.type,
    url: asset.uploadedUrl ?? asset.sourceUrl,
    alt: asset.alt,
    description: asset.alt,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping d'une section
// ─────────────────────────────────────────────────────────────────────────────

function mapSection(
  section: ClonedSection,
  index: number,
  mediaAssets: ClonedMediaAsset[],
  language: Language
): FunnelSection | FunnelSection[] {
  if (section.kind === "native") {
    return mapNativeSection(section, index, mediaAssets, language);
  }
  return mapRawHtmlSection(section, index, language);
}

function mapNativeSection(
  section: NativeClonedSection,
  index: number,
  mediaAssets: ClonedMediaAsset[],
  language: Language
): FunnelSection {
  const sectionId = makeSectionId(section.type, index);
  const { content, type } = section;

  const firstMediaId = content.mediaIds?.[0];
  const firstMedia = firstMediaId
    ? mediaAssets.find((m) => m.id === firstMediaId)
    : undefined;

  const headline = ensureHeadline(content.headline, type, language);

  const funnelSection: FunnelSection = {
    id: sectionId,
    type,
    headline,
    subheadline: content.subHeadline,
    body: content.body,
    visible: true,
  };

  if (firstMedia) {
    funnelSection.image = {
      mode: "upload",
      url: firstMedia.uploadedUrl ?? firstMedia.sourceUrl,
      alt: firstMedia.alt,
      mediaRef: firstMedia.id,
      size: "lg",
    };
  }

  if (content.ctaLabel) {
    funnelSection.cta = {
      label: content.ctaLabel,
      mode: content.ctaHref?.startsWith("#") ? "anchor" : "redirect",
      url: content.ctaHref?.startsWith("#") ? undefined : content.ctaHref,
      anchorId: content.ctaHref?.startsWith("#")
        ? content.ctaHref.slice(1)
        : undefined,
      target: "_self",
    };
  }

  if (content.items && content.items.length > 0) {
    funnelSection.bullets = content.items
      .map((it) => it.title || it.description || "")
      .filter(Boolean)
      .slice(0, 8);
  }

  return funnelSection;
}

/**
 * Mappe une section raw-html. Si le HTML contient plusieurs <section>
 * top-level, on les éclate en plusieurs FunnelSection distinctes pour
 * permettre une édition fine (fond, contenu) section par section.
 */
function mapRawHtmlSection(
  section: RawHtmlClonedSection,
  index: number,
  language: Language
): FunnelSection | FunnelSection[] {
  const subSections = splitRawHtmlIntoSections(section.html);

  // Cas 1 : un seul bloc → comportement actuel
  if (subSections.length <= 1) {
    return {
      id: makeSectionId("raw-html", index),
      type: "raw-html",
      headline: getRawHtmlPlaceholderHeadline(language, 0),
      body: `${RAW_HTML_BODY_MARKER}${section.html}`,
      visible: true,
      style: { spacing: "default" },
    };
  }

  // 🆕 Bugs #8 (section vide sous le header) / #1 (espace vide sous le footer) :
  // le découpage produit parfois des <section> sans AUCUN contenu visible
  // (spacers, wrappers résiduels). Sur la source elles n'apparaissent pas
  // (hauteur nulle). On les retire — sauf si tout serait vide (garde-fou).
  const nonEmpty = subSections.filter((h) => !isEmptySectionHtml(h));
  const kept = nonEmpty.length > 0 ? nonEmpty : subSections;
  if (kept.length !== subSections.length) {
    console.log(
      `[section-mapper] ${subSections.length - kept.length} sous-section(s) vide(s) retirée(s).`
    );
  }

  // Cas 2 : N blocs → N FunnelSection
  console.log(
    `[section-mapper] Raw-HTML section index=${index} éclatée en ${kept.length} sous-sections.`
  );

  return kept.map((subHtml, subIdx) => {
    const detectedTitle = extractFirstHeadingText(subHtml);
    const baseLabel = getRawHtmlPlaceholderHeadline(language, subIdx + 1);
    const headline = detectedTitle
      ? truncate(detectedTitle, 60)
      : baseLabel;

    return {
      id: makeSectionId("raw-html", index * 100 + subIdx),
      type: "raw-html" as FunnelSectionType,
      headline,
      body: `${RAW_HTML_BODY_MARKER}${subHtml}`,
      visible: true,
      style: { spacing: "default" },
    };
  });
}

/**
 * 🆕 Une <section> est « vide » (et donc à retirer) si elle n'a AUCUN contenu
 * visible : pas de texte, pas de média (img/video/iframe/picture/svg), pas de
 * fond image inline, pas d'overlay préservé. Les spacers/wrappers résiduels du
 * découpage tombent dans ce cas et créaient des bandes vides (sous le header /
 * sous le footer).
 */
function isEmptySectionHtml(html: string): boolean {
  if (!html) return true;
  // Texte visible (tags retirés) ?
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 0) return false;
  // Média ou fond image ?
  if (/<(img|video|iframe|picture|svg|source)\b/i.test(html)) return false;
  if (/background-image\s*:|background\s*:\s*url\(/i.test(html)) return false;
  // Overlay préservé (WhatsApp/popup) ?
  if (/data-ff-overlays|wa\.me|whatsapp/i.test(html)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Découpage du HTML brut en sous-sections
// ─────────────────────────────────────────────────────────────────────────────

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * Découpe un HTML brut en N sous-sections en se basant sur les <section>
 * top-level présentes dans le wrapper racine.
 *
 * Stratégie :
 * 1. On descend dans les wrappers <div> mono-enfants jusqu'à atteindre
 *    un niveau qui contient plusieurs <section> directes.
 * 2. On extrait chaque <section> avec un scanner à pile (robuste aux
 *    sections imbriquées éventuelles, aux attributs, à la casse).
 */
function splitRawHtmlIntoSections(html: string): string[] {
  let inner = html.trim();

  // Descend dans les wrappers englobants pour atteindre le niveau qui
  // contient plusieurs sections.
  for (let depth = 0; depth < 5; depth++) {
    const sectionCount = countTopLevelSections(inner);
    if (sectionCount >= 2) break;

    const m = inner.match(/^\s*<div\b[^>]*>([\s\S]*)<\/div>\s*$/i);
    if (!m) break;
    inner = m[1].trim();
  }

  const topLevelSections = countTopLevelSections(inner);
  if (topLevelSections < 2) {
    // Rien à éclater → on garde le HTML d'origine intact
    return [html];
  }

  // 🆕 Bugs #5 (WhatsApp flottant) / #6 (popup) : le découpage en <section>
  // jetait TOUT nœud top-level qui n'était pas une <section> (lien wa.me
  // `position:fixed`, popups/modales, scripts qui les pilotent…). Sur la page
  // publique, les sections sont concaténées dans UN SEUL document : un élément
  // flottant (fixed/sticky) rattaché à n'importe quelle section flotte donc
  // correctement au-dessus de toute la page. On collecte ces orphelins et on
  // les rattache à la DERNIÈRE sous-section pour ne plus rien perdre.
  const orphans: string[] = [];
  const sections = extractTopLevelSections(inner, orphans);

  const overlayOrphans = orphans.filter(isOverlayOrphan);
  if (overlayOrphans.length > 0 && sections.length > 0) {
    console.log(
      `[section-mapper] ${overlayOrphans.length} orphelin(s) top-level (overlay/flottant) préservé(s) et rattaché(s) à la dernière section.`
    );
    // ⚠️ Sécurité layout : on enveloppe les orphelins dans un conteneur
    // HORS-FLUX (0×0, overflow visible). Ainsi :
    //  - un overlay flottant (position:fixed/sticky via sa propre CSS) flotte
    //    normalement (fixed = relatif au viewport, le wrapper ne le gêne pas) ;
    //  - un popup caché (display:none) reste caché ;
    //  - un élément resté statique ne RAJOUTE PAS de hauteur à la section
    //    (évite l'« espace vide sous le footer »).
    sections[sections.length - 1] +=
      `\n<div data-ff-overlays style="position:absolute;left:0;top:0;width:0;height:0;overflow:visible">` +
      overlayOrphans.join("\n") +
      `</div>`;
  }

  return sections;
}

/**
 * 🆕 Un orphelin top-level mérite d'être préservé s'il s'agit d'un élément
 * flottant/overlay (bouton chat, popup, modale) ou du script/style qui le
 * pilote. Ces éléments sont positionnés hors flux (fixed/sticky) ou cachés
 * jusqu'à déclenchement : leur emplacement exact dans le DOM n'a pas d'impact
 * visuel, donc les rattacher à la dernière section est sûr.
 */
function isOverlayOrphan(html: string): boolean {
  const h = html.trim();
  if (!h) return false;
  return (
    /position\s*:\s*(fixed|sticky)/i.test(h) ||
    /wa\.me|api\.whatsapp\.com|whatsapp/i.test(h) ||
    /\b(popup|modal|overlay|lightbox|fixed-|floating|float-btn|chat-widget)\b/i.test(h) ||
    /^<script\b/i.test(h) ||
    /^<style\b/i.test(h)
  );
}

function countTopLevelSections(html: string): number {
  return extractTopLevelSections(html).length;
}

/**
 * Extrait les <section>...</section> qui sont à profondeur 0 dans la chaîne.
 * Scanner linéaire à pile : on suit toutes les balises ouvrantes/fermantes
 * pour maintenir la profondeur exacte.
 */
function extractTopLevelSections(html: string, orphansOut?: string[]): string[] {
  const sections: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?>/g;

  let depth = 0;             // profondeur globale dans le DOM
  let sectionStart = -1;     // index de début de la section top-level en cours
  let lastEnd = 0;           // 🆕 fin de la dernière section top-level (capture orphelins)
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(html)) !== null) {
    const full = m[0];
    const tagName = m[1].toLowerCase();
    const isClosing = full.startsWith("</");
    const isSelfClosing = full.endsWith("/>");
    const isVoid = VOID_TAGS.has(tagName);

    if (tagName === "section") {
      if (!isClosing) {
        if (sectionStart === -1 && depth === 0) {
          // Début d'une section top-level
          sectionStart = m.index;
          // 🆕 Tout ce qui précède (depuis la dernière section) est orphelin.
          if (orphansOut) {
            const gap = html.slice(lastEnd, m.index).trim();
            if (gap) orphansOut.push(gap);
          }
        }
        if (!isSelfClosing) depth++;
      } else {
        depth--;
        if (sectionStart !== -1 && depth === 0) {
          // Fin de la section top-level en cours
          const end = m.index + full.length;
          sections.push(html.slice(sectionStart, end));
          sectionStart = -1;
          lastEnd = end; // 🆕
        }
      }
    } else {
      // Autres tags : on suit la profondeur seulement si on est DANS
      // une section top-level (sinon profondeur globale = 0).
      if (sectionStart !== -1) {
        if (!isClosing && !isSelfClosing && !isVoid) {
          depth++;
        } else if (isClosing) {
          depth--;
        }
      }
    }
  }

  // 🆕 Orphelin final : tout ce qui suit la dernière section top-level
  // (popups/modales et scripts de fin de page y figurent souvent).
  if (orphansOut) {
    const tail = html.slice(lastEnd).trim();
    if (tail) orphansOut.push(tail);
  }

  return sections;
}

/**
 * Extrait le texte du premier <h1>, <h2> ou <h3> trouvé dans un HTML brut.
 * Sert à nommer intelligemment les sous-sections dans la sidebar.
 */
function extractFirstHeadingText(html: string): string | null {
  const m = html.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (!m) return null;
  const text = m[1]
    .replace(/<[^>]+>/g, " ") // strip tags
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ─────────────────────────────────────────────────────────────────────────────
// Headlines de secours
// ─────────────────────────────────────────────────────────────────────────────

function ensureHeadline(
  headline: string | undefined,
  type: FunnelSectionType,
  language: Language
): string {
  if (headline && headline.trim().length > 0) return headline.trim();
  return getFallbackHeadline(type, language);
}

function getFallbackHeadline(
  type: FunnelSectionType,
  language: Language
): string {
  const fallbacks: Record<Language, Partial<Record<FunnelSectionType, string>>> = {
    fr: {
      hero: "Bienvenue",
      about: "À propos",
      problem: "Le problème",
      solution: "La solution",
      benefits: "Les bénéfices",
      proof: "Preuves sociales",
      testimonials: "Témoignages",
      offer: "Notre offre",
      bonus: "Bonus",
      guarantee: "Notre garantie",
      faq: "Questions fréquentes",
      cta: "Passez à l'action",
      form: "Inscrivez-vous",
      pricing: "Tarifs",
      program: "Programme",
      process: "Comment ça marche",
      webinar: "Webinaire",
      video: "Vidéo",
      qualification: "Cette offre est faite pour vous si…",
      thank_you: "Merci !",
    },
    en: {
      hero: "Welcome",
      about: "About",
      problem: "The problem",
      solution: "The solution",
      benefits: "Benefits",
      proof: "Social proof",
      testimonials: "Testimonials",
      offer: "Our offer",
      bonus: "Bonus",
      guarantee: "Our guarantee",
      faq: "FAQ",
      cta: "Take action",
      form: "Sign up",
      pricing: "Pricing",
      program: "Program",
      process: "How it works",
      webinar: "Webinar",
      video: "Video",
      qualification: "This is for you if…",
      thank_you: "Thank you!",
    },
    es: {
      hero: "Bienvenido",
      about: "Acerca de",
      problem: "El problema",
      solution: "La solución",
      benefits: "Beneficios",
      proof: "Prueba social",
      testimonials: "Testimonios",
      offer: "Nuestra oferta",
      bonus: "Bonus",
      guarantee: "Nuestra garantía",
      faq: "Preguntas frecuentes",
      cta: "Actúa ahora",
      form: "Regístrate",
      pricing: "Precios",
      program: "Programa",
      process: "Cómo funciona",
      webinar: "Webinar",
      video: "Video",
      qualification: "Esto es para ti si…",
      thank_you: "Thank you!",
    },
  };
  return fallbacks[language][type] ?? "Section";
}

function getRawHtmlPlaceholderHeadline(language: Language, n: number): string {
  const map: Record<Language, string> = {
    fr: "Section personnalisée",
    en: "Custom section",
    es: "Sección personalizada",
  };
  const base = map[language];
  return n > 0 ? `${base} ${n}` : base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thank-you par défaut
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultThankYou(language: Language): Funnel["thankYouPage"] {
  const map: Record<
    Language,
    { headline: string; body: string }
  > = {
    fr: {
      headline: "Merci pour votre inscription !",
      body: "Vous recevrez un email de confirmation dans quelques minutes.",
    },
    en: {
      headline: "Thank you for signing up!",
      body: "You'll receive a confirmation email within a few minutes.",
    },
    es: {
      headline: "¡Gracias por registrarte!",
      body: "Recibirás un correo de confirmación en unos minutos.",
    },
  };
  return {
    headline: map[language].headline,
    body: map[language].body,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'ID
// ─────────────────────────────────────────────────────────────────────────────

function makeSectionId(type: FunnelSectionType, index: number): string {
  const safeType = type.replace(/[^a-z0-9-]/gi, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `sec_${safeType}_${index}_${rand}`;
}
