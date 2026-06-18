// lib/clone/raw-html-editable.ts
//
// Construit un inventaire des éléments éditables d'un HTML brut cloné.
// ⚠️ Source unique : l'inventaire est désormais collecté VIA applyRawHtmlPatches
// (même passage que l'annotation de l'iframe) pour garantir que les IDs
// — et leurs suffixes anti-collision — soient strictement identiques entre
// le panneau d'édition et les data-ff-spot-id posés dans l'iframe.

import type { Spot } from "./raw-html-walker";
import { applyRawHtmlPatches } from "./raw-html-apply-patches";

export type EditableTextKind = "title" | "subtitle" | "paragraph" | "short";

export interface EditableTextSpot {
  id: string;                       // hash stable, ex: "t-a3f9c102"
  kind: EditableTextKind;
  original: string;
  tag: string;
  hasInlineStyles?: boolean;
  styledFragments?: string[];
}

export interface EditableLinkSpot {
  id: string;                       // hash stable, ex: "a-7b2e1f50"
  href: string;
  label: string;
  isExternal: boolean;
  isCta: boolean;
}

export interface EditableImageSpot {
  id: string;                       // hash stable, ex: "img-c8b9d213"
  src: string;
  alt: string;
  /** 🆕 Phase 1B : "image" | "video" | "embed" — détermine le flux d'édition. */
  mediaType: "image" | "video" | "embed";
}

export interface RawHtmlInventory {
  texts: EditableTextSpot[];
  links: EditableLinkSpot[];
  images: EditableImageSpot[];
}

export function buildRawHtmlInventory(html: string): RawHtmlInventory {
  const texts: EditableTextSpot[] = [];
  const links: EditableLinkSpot[] = [];
  const images: EditableImageSpot[] = [];

  // On collecte les spots via le MÊME passage que l'annotation de l'iframe
  // (applyRawHtmlPatches), pour garantir des IDs strictement identiques.
  // patches=undefined → on veut l'inventaire des ORIGINAUX (pour le reset).
  const collected: Spot[] = [];
  applyRawHtmlPatches(html, undefined, {
    annotate: false,
    collectInto: collected,
  });

  for (const spot of collected) {
    if (spot.kind === "text") {
      texts.push({
        id: spot.id,
        kind: spot.subKind,
        original: spot.original,
        tag: spot.tag,
        hasInlineStyles: spot.hasInlineStyles || undefined,
        styledFragments:
          spot.styledFragments.length > 0 ? spot.styledFragments : undefined,
      });
    } else if (spot.kind === "link") {
      links.push({
        id: spot.id,
        href: spot.href,
        label: spot.label,
        isExternal: spot.isExternal,
        isCta: spot.isCta,
      });
    } else if (spot.kind === "image") {
      images.push({
        id: spot.id,
        src: spot.src,
        alt: spot.alt,
        mediaType: spot.mediaType,
      });
    }
  }

  return { texts, links, images };
}
export interface DetectedBackground {
  kind: "color" | "image" | "none";
  color?: string;          // ex: "rgb(10, 10, 10)"
  imageUrl?: string;       // URL extraite de url("...")
}

/**
 * Inspecte l'élément racine du HTML cloné pour déterminer son fond actuel.
 * Lit en priorité le style inline, puis les attributs bgcolor/background,
 * puis les classes utilitaires courantes.
 */
export function detectRawHtmlBackground(html: string): DetectedBackground {
  if (typeof document === "undefined") return { kind: "none" };

  const root = document.createElement("div");
  root.innerHTML = html;

  // Depuis la Phase 1A, le fond réel est capturé au scraping et écrit en style
  // inline (data-ff-bg-captured) sur la section ou un de ses wrappers. On
  // inspecte donc une petite liste de candidats : la section explicite, la
  // racine du fragment, et ses 1ers enfants — et on retient le premier fond
  // significatif trouvé (image prioritaire sur couleur).
  const candidates: Element[] = [];
  const pushUnique = (el: Element | null | undefined) => {
    if (el && !candidates.includes(el)) candidates.push(el);
  };

  pushUnique(root.querySelector("[data-ff-bg-captured]"));
  pushUnique(
    root.querySelector("section, [data-section], .section, main, article"),
  );
  pushUnique(root.firstElementChild);
  if (root.firstElementChild) {
    Array.from(root.firstElementChild.children)
      .slice(0, 4)
      .forEach((c) => pushUnique(c));
  }

  if (candidates.length === 0) return { kind: "none" };

  let colorFallback: string | null = null;

  for (const candidate of candidates) {
    const style = (candidate.getAttribute("style") || "").toLowerCase();

    // 1) background-image inline (url("..."))  → prioritaire, on retourne tout de suite
    const imgMatch = style.match(
      /background(?:-image)?\s*:\s*[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i,
    );
    if (imgMatch && imgMatch[1]) {
      return { kind: "image", imageUrl: imgMatch[1] };
    }

    // 2) background-color inline → mémorisé comme fallback (au cas où un autre
    //    candidat porterait une image)
    if (!colorFallback) {
      const colorMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
      if (colorMatch && colorMatch[1] && !/url\(/i.test(colorMatch[1])) {
        const c = colorMatch[1].trim();
        if (c && c !== "transparent" && c !== "none") {
          colorFallback = c;
        }
      }
      // 3) Attribut bgcolor legacy
      const bg = candidate.getAttribute("bgcolor");
      if (bg) colorFallback = colorFallback ?? bg;
    }
  }

  if (colorFallback) return { kind: "color", color: colorFallback };

  return { kind: "none" };
}

