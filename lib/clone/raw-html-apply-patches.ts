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
  images?: Record<string, { src?: string; alt?: string }>;
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
      if (patch) {
        // On capture l'ancien src AVANT toute modification, pour pouvoir
        // propager le nouveau aux variantes responsive (desktop/tablet/mobile)
        // qui partageaient la même URL d'origine.
        const oldSrc = spot.element.getAttribute("src") || "";

        if (typeof patch.src === "string" && patch.src) {
          spot.element.setAttribute("src", patch.src);
          spot.element.removeAttribute("srcset");
        }
        if (typeof patch.alt === "string") {
          spot.element.setAttribute("alt", patch.alt);
        }

        // Propagation aux variantes responsive
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

  // ─────────────────────────────────────────────────────────────
  // PASSE 3 : fond de section
  // ─────────────────────────────────────────────────────────────
  if (p.background) {
    applyBackgroundPatch(root, p.background);
  }

  return root.innerHTML;
}
