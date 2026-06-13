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

  // Cherche le premier conteneur "section" significatif.
  // ⚠️ Pas de "> div" dans un querySelector — on tombe sur firstElementChild en fallback.
  const candidate: Element | null =
    root.querySelector("section, [data-section], .section, main, article") ||
    root.firstElementChild;

  if (!candidate) return { kind: "none" };

  const style = (candidate.getAttribute("style") || "").toLowerCase();

  // 1) background-image inline (url("..."))
  const imgMatch = style.match(
    /background(?:-image)?\s*:\s*[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i,
  );
  if (imgMatch && imgMatch[1]) {
    return { kind: "image", imageUrl: imgMatch[1] };
  }

  // 2) background-color inline
  const colorMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  if (colorMatch && colorMatch[1] && !/url\(/i.test(colorMatch[1])) {
    const c = colorMatch[1].trim();
    if (c && c !== "transparent" && c !== "none") {
      return { kind: "color", color: c };
    }
  }

  // 3) Attribut bgcolor legacy
  const bg = candidate.getAttribute("bgcolor");
  if (bg) return { kind: "color", color: bg };

  return { kind: "none" };
}

