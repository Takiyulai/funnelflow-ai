// lib/clone/raw-html-apply-patches.ts
//
// Applique des patches sur le HTML brut cloné.
// Procède en 3 passes :
//   1) Collecte des spots (DOM intact)
//   2) Application des patches texte / lien / image + annotation
//   3) Application du patch de fond de section
//
// NB : ce module utilise `document` (DOM natif du navigateur).
//      Côté serveur (export SIO), passer par
//      `lib/clone/raw-html-apply-patches.server.ts` qui injecte un
//      document jsdom via globalThis avant de réutiliser cette fonction.

import { walkEditable, replaceTextContentSmart, type Spot } from "./raw-html-walker";
import type { RawHtmlBackgroundPatch } from "@/lib/funnels/types";

export interface RawHtmlPatch {
  texts?: Record<string, string>;
  links?: Record<string, { href?: string; label?: string }>;
  images?: Record<
    string,
    { src?: string; alt?: string; mediaType?: "image" | "video" | "embed" }
  >;
  colors?: Record<string, string>;
  background?: RawHtmlBackgroundPatch;
}

export interface ApplyPatchesOptions {
  annotate?: boolean;
  /** Si fourni, sera rempli avec les spots collectés (ordre + IDs finaux). */
  collectInto?: Spot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers : fond de section
// ─────────────────────────────────────────────────────────────────────────────

function applyBackgroundPatch(root: HTMLElement, bg: RawHtmlBackgroundPatch): void {
  if (!bg || !bg.mode || bg.mode === "original") return;

  const candidates: HTMLElement[] = [];

  const rootEl = root.firstElementChild as HTMLElement | null;
  if (!rootEl) return;
  candidates.push(rootEl);

  Array.from(rootEl.children).forEach((child) => {
    if (!child || (child as Node).nodeType !== 1) return;
    const el = child as HTMLElement;
    const inline = (el.getAttribute("style") || "").toLowerCase();
    if (/background/.test(inline)) {
      candidates.push(el);
    }
  });

  const buildStyle = (prevStyle: string): string => {
    const cleaned = prevStyle
      .split(";")
      .map((s) => s.trim())
      .filter(
        (s) =>
          s &&
          !/^background(-color|-image|-position|-size|-repeat|-attachment)?\s*:/i.test(s),
      )
      .join("; ");

    const parts: string[] = cleaned ? [cleaned] : [];

    if (!/position\s*:/i.test(cleaned)) {
      parts.push("position: relative");
    }

    if (bg.mode === "none") {
      parts.push("background: transparent !important");
      parts.push("background-image: none !important");
    } else if (bg.mode === "color" && bg.color) {
      parts.push(`background-color: ${bg.color} !important`);
      parts.push("background-image: none !important");
    } else if (bg.mode === "image" && bg.imageUrl) {
      const safeUrl = bg.imageUrl.replace(/"/g, '\\"');
      let bgImage = `url("${safeUrl}")`;

      if (
        bg.overlayColor &&
        typeof bg.overlayOpacity === "number" &&
        bg.overlayOpacity > 0
      ) {
        const opacity = Math.min(100, Math.max(0, bg.overlayOpacity)) / 100;
        const rgb = hexToRgb(bg.overlayColor) || { r: 0, g: 0, b: 0 };
        const overlay = `linear-gradient(rgba(${rgb.r},${rgb.g},${rgb.b},${opacity}), rgba(${rgb.r},${rgb.g},${rgb.b},${opacity}))`;
        bgImage = `${overlay}, url("${safeUrl}")`;
      }

      parts.push(`background-image: ${bgImage} !important`);
      parts.push(`background-size: ${bg.size || "cover"} !important`);
      parts.push(`background-position: ${bg.position || "center"} !important`);
      parts.push("background-repeat: no-repeat !important");
      parts.push(`background-attachment: ${bg.attachment || "scroll"} !important`);
      parts.push("background-color: transparent !important");
    }

    return parts.join("; ");
  };

  candidates.forEach((el) => {
    const prev = el.getAttribute("style") || "";
    el.setAttribute("style", buildStyle(prev));
    el.setAttribute("data-ff-bg-applied", bg.mode);
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) {
    const rm = hex.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rm) return { r: +rm[1], g: +rm[2], b: +rm[3] };
    return null;
  }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : propagation d'une nouvelle URL d'image aux variantes responsive
// ─────────────────────────────────────────────────────────────────────────────
//
// Systeme.io génère fréquemment plusieurs <img> pour la même image logique :
// une variante par breakpoint (desktop / tablet / mobile), basculées via
// des wrappers en `display:none` selon les media queries.
//
// Lorsqu'on patche une image via son data-ff-spot-id, on ne modifie qu'UNE
// seule de ces variantes — celle qui était visible dans l'éditeur. Les autres
// gardent l'ancienne URL CloudFront, ce qui fait réapparaître l'image
// d'origine dès qu'on bascule sur un autre breakpoint.
//
// Cette fonction propage donc le nouveau src à :
//   1) toutes les <img> du document dont l'attribut src === oldSrc
//   2) tous les <img srcset> qui contiennent oldSrc
//   3) tous les <source srcset> (dans <picture>) qui contiennent oldSrc
//
// On copie aussi l'alt si fourni, pour rester cohérent.

function propagateImageSrcToResponsiveVariants(
  root: HTMLElement,
  exclude: Element,
  oldSrc: string,
  newSrc: string,
  newAlt: string | undefined,
): void {
  if (!oldSrc || oldSrc === newSrc) return;

  // 1) Autres <img> avec exactement le même src
  const imgs = root.querySelectorAll("img");
  imgs.forEach((img) => {
    if (img === exclude) return;
    const sib = img as HTMLImageElement;

    if (sib.getAttribute("src") === oldSrc) {
      sib.setAttribute("src", newSrc);
      sib.removeAttribute("srcset");
      if (typeof newAlt === "string") {
        sib.setAttribute("alt", newAlt);
      }
    } else {
      // Cas où le src diffère mais un srcset contient l'ancienne URL
      const srcset = sib.getAttribute("srcset");
      if (srcset && srcset.includes(oldSrc)) {
        sib.setAttribute("srcset", srcset.split(oldSrc).join(newSrc));
      }
    }
  });

  // 2) <source srcset> dans <picture>
  const sources = root.querySelectorAll("source[srcset]");
  sources.forEach((s) => {
    const ss = s.getAttribute("srcset") || "";
    if (ss.includes(oldSrc)) {
      s.setAttribute("srcset", ss.split(oldSrc).join(newSrc));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Phase 1B — Conversion de média (image ↔ vidéo ↔ embed)
// ─────────────────────────────────────────────────────────────────────────────
//
// Un GIF/visuel cloné est dans une <img>. Pour permettre de le remplacer par
// une VRAIE vidéo (fichier mp4/webm) ou un embed (YouTube/Vimeo), on remplace
// la balise par <video> ou <iframe> au moment de l'application des patches.

type MediaTypeChoice = "image" | "video" | "embed";

/** Convertit une URL YouTube/Vimeo "watch" en URL d'embed. Sinon renvoie tel quel. */
function toEmbedUrl(src: string): string {
  if (!src) return src;
  try {
    // YouTube : youtu.be/ID, watch?v=ID, shorts/ID, /embed/ID (déjà bon)
    const yt = src.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
    );
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    // Vimeo : vimeo.com/123 ou player.vimeo.com/video/123 (déjà bon)
    const vm = src.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  } catch {
    // ignore
  }
  return src;
}

/** URL qui DOIT être rendue en iframe (impossible à lire dans une balise <video>). */
function isEmbeddableUrl(src: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia/i.test(src || "");
}

/**
 * Construit l'élément média de remplacement (video/iframe/img) en reprenant les
 * attributs visuels de l'élément d'origine (class, id, width).
 *
 * Règles :
 *  - "embed" → toujours <iframe> (URL convertie en URL d'embed).
 *  - "video" + URL YouTube/Vimeo/Loom → <iframe> (un lien YT ne joue pas dans
 *    <video>). Sinon → vraie balise <video> (fichier mp4/webm).
 *  - tout média a un aspect-ratio 16/9 + largeur pour ne pas s'effondrer à 0px.
 */
function buildMediaElement(
  type: MediaTypeChoice,
  src: string,
  alt: string,
  original: Element,
): Element {
  const doc = original.ownerDocument || document;
  const cls = original.getAttribute("class");
  const id = original.getAttribute("id");
  const width = original.getAttribute("width");

  const sizeStyle = (el: HTMLElement, withAspect: boolean) => {
    if (cls) el.setAttribute("class", cls);
    if (id) el.setAttribute("id", id);
    // 🆕 Marqueur : média RECONSTRUIT par FunnelFlow. Permet au CSS de rendu
    // (#ff-media-fix) de NE PAS écraser ses dimensions (sinon le conteneur
    // s'effondre à 0px car width/height:auto + parent de hauteur nulle).
    el.setAttribute("data-ff-converted", type);
    el.style.display = "block";
    el.style.width = width ? `${width}px` : "100%";
    el.style.maxWidth = "100%";
    if (withAspect) {
      el.style.aspectRatio = "16 / 9";
      el.style.height = "auto";
    }
  };

  const makeIframe = (): HTMLElement => {
    const f = doc.createElement("iframe");
    f.setAttribute("src", toEmbedUrl(src));
    f.setAttribute("frameborder", "0");
    f.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    f.setAttribute("allowfullscreen", "");
    if (alt) f.setAttribute("title", alt);
    sizeStyle(f, true);
    f.style.border = "0";
    return f;
  };

  if (type === "embed") return makeIframe();

  if (type === "video") {
    // Lien YouTube/Vimeo/Loom → iframe (illisible dans <video>).
    if (isEmbeddableUrl(src)) return makeIframe();
    const v = doc.createElement("video");
    if (src) v.setAttribute("src", src);
    v.setAttribute("controls", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("preload", "metadata");
    if (alt) v.setAttribute("title", alt);
    sizeStyle(v, true);
    v.style.background = "#000";
    return v;
  }

  // image
  const img = doc.createElement("img");
  if (src) img.setAttribute("src", src);
  if (alt) img.setAttribute("alt", alt);
  if (width) img.setAttribute("width", width);
  img.setAttribute("loading", "lazy");
  sizeStyle(img, false);
  img.style.height = "auto";
  return img;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyRawHtmlPatches
// ─────────────────────────────────────────────────────────────────────────────

export function applyRawHtmlPatches(
  html: string,
  patches: RawHtmlPatch | undefined,
  options: ApplyPatchesOptions = {},
): string {
  if (!patches && !options.annotate && !options.collectInto) return html;

  if (typeof document === "undefined") return html;

  const annotate = options.annotate === true;
  const p: RawHtmlPatch = patches || {};

  const root = document.createElement("div");
  root.innerHTML = html;

  // ─────────────────────────────────────────────────────────────
  // PASSE 1 : identifier tous les spots sur le DOM INTACT.
  // ─────────────────────────────────────────────────────────────
  const collected: Spot[] = [];
  walkEditable(root, (spot) => {
    collected.push(spot);
  });
  if (options.collectInto) {
    options.collectInto.push(...collected);
  }

  // ─────────────────────────────────────────────────────────────
  // PASSE 2 : application des patches + annotation
  // ─────────────────────────────────────────────────────────────
  for (const spot of collected) {
    if (spot.kind === "text") {
      const patch = p.texts?.[spot.id];
      if (typeof patch === "string" && patch && patch !== spot.original) {
        replaceTextContentSmart(spot.element, patch);
      }
      if (annotate) {
        spot.element.setAttribute("data-ff-spot-id", spot.id);
      }
    } else if (spot.kind === "link") {
      const patch = p.links?.[spot.id];
      const tag = spot.element.tagName.toLowerCase();

      if (patch) {
        if (typeof patch.href === "string" && patch.href && tag === "a") {
          spot.element.setAttribute("href", patch.href);
          spot.element.setAttribute("data-ff-href", patch.href);
        }
        if (
          typeof patch.label === "string" &&
          patch.label &&
          patch.label !== spot.label
        ) {
          replaceTextContentSmart(spot.element, patch.label);
        }
      }

      if (annotate && tag === "a") {
        const currentHref = spot.element.getAttribute("href");
        if (currentHref && !spot.element.hasAttribute("data-ff-href")) {
          spot.element.setAttribute("data-ff-href", currentHref);
        }
      }

      if (annotate) {
        spot.element.setAttribute("data-ff-link-id", spot.id);
      }
    } else if (spot.kind === "image") {
      const patch = p.images?.[spot.id];
      const currentTag = spot.element.tagName.toLowerCase();
      const desiredType = patch?.mediaType;

      // Faut-il CONVERTIR la balise (ex: <img> → <video>/<iframe>) ?
      const needsConversion =
        !!desiredType &&
        ((desiredType === "video" && currentTag !== "video") ||
          (desiredType === "embed" && currentTag !== "iframe") ||
          (desiredType === "image" && currentTag !== "img"));

      if (needsConversion) {
        const newSrc =
          typeof patch?.src === "string" && patch.src
            ? patch.src
            : spot.element.getAttribute("src") || "";
        const newAlt =
          typeof patch?.alt === "string"
            ? patch.alt
            : spot.element.getAttribute("alt") || "";
        const replacement = buildMediaElement(
          desiredType as MediaTypeChoice,
          newSrc,
          newAlt,
          spot.element,
        );
        if (annotate) {
          replacement.setAttribute("data-ff-spot-id", spot.id);
        }
        spot.element.replaceWith(replacement);
      } else {
        // Pas de conversion : patch src/alt en place (comportement existant).
        if (patch) {
          const oldSrc = spot.element.getAttribute("src") || "";
          if (typeof patch.src === "string" && patch.src) {
            spot.element.setAttribute("src", patch.src);
            spot.element.removeAttribute("srcset");
          }
          if (typeof patch.alt === "string") {
            spot.element.setAttribute("alt", patch.alt);
          }
          if (typeof patch.src === "string" && patch.src && oldSrc) {
            propagateImageSrcToResponsiveVariants(
              root,
              spot.element,
              oldSrc,
              patch.src,
              typeof patch.alt === "string" ? patch.alt : undefined,
            );
          }
        }
        if (annotate) {
          spot.element.setAttribute("data-ff-spot-id", spot.id);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PASSE 3 : fond de section
  // ─────────────────────────────────────────────────────────────
  if (p.background) {
    applyBackgroundPatch(root, p.background);
  }

  return root.innerHTML;
}
