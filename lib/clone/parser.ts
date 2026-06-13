// lib/clone/parser.ts
/**
 * Parser principal du pipeline de clonage.
 *
 * Reçoit le HTML brut + Cheerio API, retourne ParsedPageData :
 * - sections détectées (natives ou raw-html)
 * - palette de couleurs
 * - typographie
 * - liste des médias à uploader
 *
 * Stratégie de détection :
 * 1. Découpe la page en "blocs candidats" (section, div racine, main > *)
 * 2. Pour chaque bloc, scoring sémantique pour décider du FunnelSectionType
 * 3. Si score < seuil → fallback raw-html
 */

import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";
import { extractPalette } from "./color-extractor";
import type {
  ClonedMediaAsset,
  ClonedSection,
  ExtractedTypography,
  NativeClonedSection,
  ParsedPageData,
  RawHtmlClonedSection,
} from "./types";
import type { FunnelSectionType } from "@/lib/funnels/types";

const MIN_BLOCK_TEXT_LENGTH = 30;
const MAX_RAW_HTML_LENGTH = 50_000;

/**
 * Point d'entrée principal.
 */
export function parsePage(
  html: string,
  sourceUrl: string
): ParsedPageData {
  console.log(`[parser] Parsing ${html.length} chars from ${sourceUrl}`);

  const $ = cheerio.load(html);

  // 🆕 IMPORTANT : capturer le <head> AVANT stripNoise (qui pourrait retirer
  // les <style>). Ce head sera injecté dans l'iframe raw-html pour restituer
  // fidèlement le rendu visuel du site source (fonts + CSS).
  const globalHead = captureGlobalHead($, sourceUrl);

  stripNoise($);

  const title = $("title").first().text().trim() || "Untitled";
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || undefined;

  const palette = extractPalette($, html);
  const typography = extractTypography($);

  // Scan global des médias (utile pour la bibliothèque média du Funnel,
  // même si l'iframe utilise les URLs originales via <base href>).
  const mediaAssets: ClonedMediaAsset[] = [];
  scanAllMedia($, sourceUrl, mediaAssets);
  console.log(`[parser] Global media scan : ${mediaAssets.length} medias`);

  // 🆕 MODE "SINGLE-IFRAME" (Solution A) :
  // On prend le <body> entier comme UNE SEULE section raw-html.
  // Avantages :
  //   - rendu visuel fidèle (le CSS source gère les transitions inter-sections)
  //   - pas de blanc entre sections
  //   - pas de doublons natifs/raw-html
  //   - hauteur exacte de la page source
  // Inconvénient : non éditable par section. À reclassifier en Phase 2 (AI).
  const bodyHtml = $("body").html() ?? "";
  const singleSection: ClonedSection = {
    kind: "raw-html",
    html: bodyHtml,
    scopedCss: "",
    estimatedHeight: 0,
  };
  const sections: ClonedSection[] = [singleSection];

  console.log(
    `[parser] ✅ Done (single-iframe mode) : 1 raw-html section (${bodyHtml.length} chars), ${mediaAssets.length} medias`
  );

  // ─── Ancien mode multi-sections (conservé pour réactivation future) ───
  // const blocks = findCandidateBlocks($);
  // console.log(`[parser] ${blocks.length} candidate blocks found`);
  // const sections: ClonedSection[] = [];
  // blocks.each((index, block) => {
  //   const section = parseBlock($, block, sourceUrl, mediaAssets, index);
  //   if (section) sections.push(section);
  // });
  // const stats = {
  //   native: sections.filter((s) => s.kind === "native").length,
  //   rawHtml: sections.filter((s) => s.kind === "raw-html").length,
  // };
  // console.log(
  //   `[parser] ✅ Done : ${sections.length} sections (${stats.native} native, ${stats.rawHtml} raw-html), ${mediaAssets.length} medias`
  // );

  return {
    sourceUrl,
    title,
    metaDescription,
    sections,
    palette,
    typography,
    mediaAssets,
    globalHead,
  };
}


/**
 * Supprime les éléments non pertinents pour le clonage (scripts, styles inline,
 * iframes de tracking, noscript, etc.).
 */
function stripNoise($: CheerioAPI): void {
  $("script, noscript, link[rel='preload'], link[rel='dns-prefetch']").remove();
  $("svg[aria-hidden='true'], svg[role='presentation']").remove();
  // Tracking pixels & iframes
  $('iframe[src*="facebook"], iframe[src*="google"], iframe[src*="hotjar"], iframe[src*="segment"]').remove();
  $('img[src*="facebook.com/tr"], img[width="1"][height="1"]').remove();
}
/**
 * Scan global du document : collecte tous les médias (img + background-image
 * + video) avant le découpage en sections. Garantit qu'aucun média n'est perdu,
 * même si sa section finit en raw-html.
 *
 * Gère les guillemets HTML échappés (&quot;) injectés par ScrapingBee.
 */
function scanAllMedia(
  $: CheerioAPI,
  sourceUrl: string,
  mediaAssets: ClonedMediaAsset[]
): void {
  // Skip les images du chrome ClickFunnels (boutons modaux, etc.)
  const SKIP_PATTERNS = [
    /clickfunnels\.com\/images\//i,
    /closemodal/i,
    /\bpixel\b/i,
    /\btracking\b/i,
  ];

  const shouldSkip = (url: string) =>
    SKIP_PATTERNS.some((rx) => rx.test(url));

  // 1. Toutes les balises <img>
  $("img").each((_, img) => {
    const $img = $(img);
    const src =
      $img.attr("src") ||
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      $img.attr("data-original") ||
      $img.attr("data-srcset")?.split(" ")[0] ||
      $img.attr("srcset")?.split(" ")[0];
    if (!src || src.startsWith("data:")) return;
    const absoluteUrl = resolveUrl(src, sourceUrl);
    if (!absoluteUrl || shouldSkip(absoluteUrl)) return;
    registerMedia(mediaAssets, absoluteUrl, "image", {
      alt: $img.attr("alt") || undefined,
      width: parseDimension($img.attr("width")),
      height: parseDimension($img.attr("height")),
    });
  });

  // 2. Toutes les déclarations background-image (style inline)
  $("[style*='background-image']").each((_, el) => {
    const style = $(el).attr("style") || "";
    extractBackgroundImageUrls(style).forEach((src) => {
      const absoluteUrl = resolveUrl(src, sourceUrl);
      if (!absoluteUrl || shouldSkip(absoluteUrl)) return;
      registerMedia(mediaAssets, absoluteUrl, "image");
    });
  });

  // 3. Balises <style> internes qui contiennent du background-image
  $("style").each((_, el) => {
    const css = $(el).html() || "";
    extractBackgroundImageUrls(css).forEach((src) => {
      const absoluteUrl = resolveUrl(src, sourceUrl);
      if (!absoluteUrl || shouldSkip(absoluteUrl)) return;
      registerMedia(mediaAssets, absoluteUrl, "image");
    });
  });

  // 4. Vidéos
  $("video source, video").each((_, v) => {
    const src = $(v).attr("src");
    if (!src) return;
    const absoluteUrl = resolveUrl(src, sourceUrl);
    if (!absoluteUrl) return;
    registerMedia(mediaAssets, absoluteUrl, "video");
  });
}

/**
 * Extrait toutes les URLs depuis une chaîne CSS contenant des
 * background-image. Gère les guillemets normaux (" ') et échappés (&quot;).
 */
function extractBackgroundImageUrls(css: string): string[] {
  const urls: string[] = [];
  // Regex permissive : url( [optional quote] url [optional quote] )
  // Couvre " ' &quot; et pas de quote du tout
  const regex = /url\(\s*(?:["']|&quot;|&#34;|&#x22;)?\s*([^"')&]+?)\s*(?:["']|&quot;|&#34;|&#x22;)?\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith("data:")) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Identifie les blocs racine candidats à être des sections.
 * Essaie plusieurs stratégies dans l'ordre, retourne la première qui donne ≥ 2 blocs.
 */
function findCandidateBlocks($: CheerioAPI): Cheerio<Element> {
  const strategies: Array<{ name: string; selector: string }> = [
    { name: "semantic-sections", selector: "body section" },
    {
      name: "main-children",
      selector: "body > main > *, body main > section, body main > div[class]",
    },
    {
      name: "clickfunnels-rows",
      selector: ".row, [class*='row-'], [class*='Row'], [class*='elRow'], [class*='elSection']",
    },
    {
      name: "page-builders",
      selector:
        "[class*='section'], [class*='Section'], [data-section], [class*='block-'], [class*='Block']",
    },
    { name: "body-divs", selector: "body > div" },
    { name: "deep-divs", selector: "body > div > div" },
  ];

  for (const { name, selector } of strategies) {
    const candidates = $(selector).filter((_, el) => {
      const text = $(el).text().trim();
      if (text.length < MIN_BLOCK_TEXT_LENGTH) return false;
      // Évite les blocs imbriqués les uns dans les autres : ne garde
      // que ceux dont aucun parent n'est lui-même candidat avec ce sélecteur.
      const $parents = $(el).parents(selector);
      return $parents.length === 0;
    });

    if (candidates.length >= 2) {
      console.log(
        `[parser] Strategy "${name}" → ${candidates.length} candidate blocks`
      );
      return candidates as unknown as Cheerio<Element>;
    }
    console.log(
      `[parser] Strategy "${name}" → only ${candidates.length} blocks, trying next…`
    );
  }

  // Dernier recours : tous les enfants directs du body
  console.warn(
    "[parser] ⚠️ No multi-block strategy worked, falling back to body children"
  );
  return $("body > *") as unknown as Cheerio<Element>;
}

/**
 * Parse un bloc candidat : tente d'abord la détection native, fallback raw-html.
 */
function parseBlock(
  $: CheerioAPI,
  block: Element,
  sourceUrl: string,
  mediaAssets: ClonedMediaAsset[],
  index: number
): ClonedSection | null {
  const $block = $(block);
  const detected = detectSectionType($, $block, index);

  if (detected) {
    return buildNativeSection($, $block, detected, sourceUrl, mediaAssets);
  }
  return buildRawHtmlSection($, $block);
}

/**
 * Heuristiques de détection du type de section.
 * Retourne null si aucun type ne matche assez fort → fallback raw-html.
 */
function detectSectionType(
  $: CheerioAPI,
  $block: Cheerio<Element>,
  index: number
): FunnelSectionType | null {
  const text = $block.text().toLowerCase();
  const classes = ($block.attr("class") || "").toLowerCase();
  const id = ($block.attr("id") || "").toLowerCase();
  const tagSignature = `${classes} ${id}`;

  const h1Count = $block.find("h1").length;
  const h2Count = $block.find("h2").length;
  const formCount = $block.find("form").length;
  const buttonCount = $block.find("button, a.btn, a[class*='button'], a[class*='cta']").length;
  const imageCount = $block.find("img").length;
  const videoCount = $block.find("video, iframe[src*='youtube'], iframe[src*='vimeo']").length;
  const liCount = $block.find("li").length;

  // HERO : premier bloc avec h1 ou très grand h2 et CTA
  if (index === 0 && (h1Count > 0 || (h2Count > 0 && buttonCount > 0))) {
    return "hero";
  }
  if (/\bhero\b|banner|masthead/.test(tagSignature)) return "hero";

  // PRICING
  if (
    /\bpric/.test(tagSignature) ||
    /\bplan\b/.test(tagSignature) ||
    (/\$\d|€\d|\d+\s*(€|\$|usd|eur)/.test(text) && buttonCount > 0)
  ) {
    return "pricing";
  }

  // TESTIMONIALS
  if (
    /testimo|review|témoign|avis/.test(tagSignature) ||
    /testimo|témoign|"\s*[A-Z]/.test(text.slice(0, 500))
  ) {
    return "testimonials";
  }

  // FAQ
  if (
    /\bfaq\b|question/.test(tagSignature) ||
    (/question|q\s*:|q\./i.test(text) && liCount > 2)
  ) {
    return "faq";
  }

  // FORM (lead capture)
  if (formCount > 0 && $block.find("input[type='email'], input[type='text']").length > 0) {
    return "form";
  }

  // BENEFITS / FEATURES : listes avec icônes
  if (
    /benefit|feature|avantage|fonctionnalité/.test(tagSignature) ||
    (liCount >= 3 && imageCount === 0)
  ) {
    return "benefits";
  }

  // ABOUT : bloc avec image + paragraphe long
  if (
    /about|qui-sommes|à-propos|founder|fondateur/.test(tagSignature) ||
    (imageCount === 1 && $block.find("p").text().length > 200)
  ) {
    return "about";
  }

  // CTA : bloc court avec gros bouton
  if (buttonCount > 0 && text.length < 300) {
    return "cta";
  }

  // VIDEO embed dominant
  if (videoCount > 0 && text.length < 500) {
    return "hero"; // souvent un VSL en hero
  }

  // Pas de match fiable
  return null;
}

/**
 * Construit une section native à partir du bloc détecté.
 */
function buildNativeSection(
  $: CheerioAPI,
  $block: Cheerio<Element>,
  type: FunnelSectionType,
  sourceUrl: string,
  mediaAssets: ClonedMediaAsset[]
): NativeClonedSection {
  const headline = $block.find("h1, h2").first().text().trim() || undefined;
  const subHeadline =
    $block.find("h2, h3, .subtitle, .sub-headline").not(":first").first().text().trim() ||
    undefined;
  const body =
    $block.find("p").map((_, p) => $(p).text().trim()).get().filter(Boolean).join("\n\n") ||
    undefined;

  const mediaIds: string[] = [];

  // Images : couvre src + lazy-loading + srcset + background-image
  $block.find("img").each((_, img) => {
    const $img = $(img);
    const src =
      $img.attr("src") ||
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      $img.attr("data-original") ||
      $img.attr("data-srcset")?.split(" ")[0] ||
      $img.attr("srcset")?.split(" ")[0];
    if (!src) return;
    if (src.startsWith("data:")) return;
    const absoluteUrl = resolveUrl(src, sourceUrl);
    if (!absoluteUrl) return;
    const asset = registerMedia(mediaAssets, absoluteUrl, "image", {
      alt: $img.attr("alt") || undefined,
      width: parseDimension($img.attr("width")),
      height: parseDimension($img.attr("height")),
    });
    mediaIds.push(asset.id);
  });

  // Images en background-image CSS (ClickFunnels, Elementor, etc.)
  $block.find("[style*='background-image']").each((_, el) => {
    const style = $(el).attr("style") || "";
    const match = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
    if (!match) return;
    const src = match[1];
    if (src.startsWith("data:")) return;
    const absoluteUrl = resolveUrl(src, sourceUrl);
    if (!absoluteUrl) return;
    const asset = registerMedia(mediaAssets, absoluteUrl, "image");
    mediaIds.push(asset.id);
  });

  // Vidéos
  $block.find("video source, video").each((_, v) => {
    const src = $(v).attr("src");
    if (!src) return;
    const absoluteUrl = resolveUrl(src, sourceUrl);
    if (!absoluteUrl) return;
    const asset = registerMedia(mediaAssets, absoluteUrl, "video");
    mediaIds.push(asset.id);
  });

  const items = extractItems($, $block, type);

  const firstCta = $block.find("button, a.btn, a[class*='button'], a[class*='cta']").first();
  const ctaLabel = firstCta.text().trim() || undefined;
  const ctaHref = firstCta.attr("href") || undefined;

  return {
    kind: "native",
    type,
    content: {
      headline,
      subHeadline,
      body,
      items: items.length > 0 ? items : undefined,
      mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      ctaLabel,
      ctaHref,
    },
  };
}

/**
 * Extrait les items (cards, list-items) selon le type de section.
 */
function extractItems(
  $: CheerioAPI,
  $block: Cheerio<Element>,
  type: FunnelSectionType
): Array<{ title?: string; description?: string }> {
  const items: Array<{ title?: string; description?: string }> = [];

  // FAQ : pairs question/réponse
  if (type === "faq") {
    $block.find("details, .faq-item, .question").each((_, el) => {
      const $el = $(el);
      const title = $el.find("summary, h3, h4, .question-title").first().text().trim();
      const description = $el.find("p, .answer, .question-body").first().text().trim();
      if (title || description) items.push({ title, description });
    });
    if (items.length > 0) return items;
  }

  // Benefits / pricing : listes
  $block.find("li, .feature, .benefit, .plan").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h3, h4, strong, .title").first().text().trim();
    const description = $el.find("p, .description").first().text().trim();
    const fallbackText = $el.clone().children().remove().end().text().trim();
    if (title || description || fallbackText) {
      items.push({
        title: title || undefined,
        description: description || fallbackText || undefined,
      });
    }
  });

  return items.slice(0, 8); // borne raisonnable
}

/**
 * Fallback : encapsule le HTML brut dans une section raw-html.
 */
function buildRawHtmlSection(
  $: CheerioAPI,
  $block: Cheerio<Element>
): RawHtmlClonedSection {
  let html = $.html($block) || "";
  if (html.length > MAX_RAW_HTML_LENGTH) {
    html = html.slice(0, MAX_RAW_HTML_LENGTH) + "<!-- TRUNCATED -->";
  }

  // Pas de CSS scopé séparé pour l'instant — l'iframe gérera l'isolation
  const scopedCss = "";

  // Estimation de hauteur : ~25px par 100 chars de texte, min 200, max 1500
  const textLength = $block.text().trim().length;
  const estimatedHeight = Math.min(1500, Math.max(200, Math.floor(textLength / 4)));

  return {
    kind: "raw-html",
    html,
    scopedCss,
    estimatedHeight,
  };
}

/**
 * Enregistre un média et retourne l'asset créé (déduplique par URL source).
 */
function registerMedia(
  mediaAssets: ClonedMediaAsset[],
  sourceUrl: string,
  type: "image" | "video",
  meta?: { alt?: string; width?: number; height?: number }
): ClonedMediaAsset {
  const existing = mediaAssets.find((a) => a.sourceUrl === sourceUrl);
  if (existing) return existing;

  const asset: ClonedMediaAsset = {
    id: `media-${mediaAssets.length + 1}`,
    sourceUrl,
    type,
    alt: meta?.alt,
    width: meta?.width,
    height: meta?.height,
  };
  mediaAssets.push(asset);
  return asset;
}

/**
 * Résout une URL relative en URL absolue par rapport à la page source.
 */
function resolveUrl(src: string, baseUrl: string): string | null {
  if (!src) return null;
  try {
    const trimmed = src.trim();
    if (trimmed.startsWith("data:")) return null; // base64 inline ignoré
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseDimension(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Extrait la typographie : font-family dominantes.
 */
function extractTypography($: CheerioAPI): ExtractedTypography {
  const counts = new Map<string, number>();

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const matches = style.match(/font-family\s*:\s*([^;]+)/gi);
    if (!matches) return;
    matches.forEach((m) => {
      const family = m
        .replace(/font-family\s*:\s*/i, "")
        .replace(/['"]/g, "")
        .split(",")[0]
        .trim();
      if (family && family.length > 1) {
        counts.set(family, (counts.get(family) ?? 0) + 1);
      }
    });
  });

  $("style").each((_, el) => {
    const css = $(el).html() || "";
    const matches = css.match(/font-family\s*:\s*([^;}]+)/gi);
    if (!matches) return;
    matches.forEach((m) => {
      const family = m
        .replace(/font-family\s*:\s*/i, "")
        .replace(/['"]/g, "")
        .split(",")[0]
        .trim();
      if (family && family.length > 1 && !/var\(/.test(family)) {
        counts.set(family, (counts.get(family) ?? 0) + 1);
      }
    });
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  const headingFont = sorted[0]?.[0] || "Inter";
  const bodyFont = sorted[1]?.[0] || sorted[0]?.[0] || "Inter";

  console.log(
    `[parser] Typography : heading="${headingFont}", body="${bodyFont}" (${sorted.length} fonts detected)`
  );

  return {
    headingFont,
    bodyFont,
    allFonts: sorted.map(([font, count]) => ({ font, count })),
  };
}
/**
 * Capture le <head> de la page source pour injection dans les iframes raw-html.
 * Garde :
 *   - <base href> dynamique (résout les URLs relatives type //go.heartrepreneur.com/...)
 *   - <link rel="stylesheet"> avec href absolutisé
 *   - <link rel="preconnect"> et fonts Google
 *   - <style> globaux (toutes les règles CSS embarquées)
 *   - Meta charset + viewport
 * Strip :
 *   - <script> (sécurité — sandbox les bloque de toute façon)
 *   - <link rel="preload"> (inutiles dans iframe)
 *   - <meta http-equiv="...">  (CSP, refresh, etc.)
 */
function captureGlobalHead($: cheerio.CheerioAPI, sourceUrl: string): string {
  const parts: string[] = [];
  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push(`<base href="${escapeHtmlAttr(sourceUrl)}">`);

  // 1. Stylesheets externes (absolutisées)
  $("head link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = resolveUrl(href, sourceUrl);
    if (!absolute) return;
    const media = $(el).attr("media");
    parts.push(
      `<link rel="stylesheet" href="${escapeHtmlAttr(absolute)}"${media ? ` media="${escapeHtmlAttr(media)}"` : ""}>`
    );
  });

  // 2. Preconnect / dns-prefetch vers domaines de fonts
  $("head link[rel='preconnect'], head link[rel='dns-prefetch']").each((_, el) => {
    const href = $(el).attr("href");
    const rel = $(el).attr("rel");
    if (!href || !rel) return;
    if (/fonts\.googleapis|fonts\.gstatic|typekit|fontawesome/i.test(href)) {
      parts.push(`<link rel="${escapeHtmlAttr(rel)}" href="${escapeHtmlAttr(href)}" crossorigin>`);
    }
  });

  // 3. Tous les <style> embarqués
  $("head style, body style").each((_, el) => {
    const css = $(el).html();
    if (!css || css.trim().length === 0) return;
    parts.push(`<style>${css}</style>`);
  });

  // 4. Reset minimal pour éviter scrollbars dans iframe
  parts.push(`<style>
    html, body { margin: 0; padding: 0; overflow-x: hidden; }
    body { background: transparent; }
    img, video { max-width: 100%; height: auto; }
    a { pointer-events: none; cursor: default; }
  </style>`);

  const head = parts.join("\n");
  console.log(`[parser] Global head captured : ${head.length} chars (${parts.length} parts)`);
  return head;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
