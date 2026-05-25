// lib/funnels/resolveMedia.ts
import type { Funnel, FunnelSection, SectionImage, MediaItem } from "./types";

/**
 * Trouve un MediaItem par son id dans funnel.media[].
 */
export function findMediaById(
  funnel: Funnel | undefined,
  mediaId: string
): MediaItem | undefined {
  if (!funnel?.media || !mediaId) return undefined;
  return funnel.media.find((m) => m.id === mediaId);
}

/**
 * Résout l'URL effective d'une SectionImage :
 *  - Si image.url est défini (data-URL ou URL hébergée), retourne tel quel.
 *  - Sinon, si image.mediaRef pointe vers un MediaItem du funnel, retourne
 *    l'URL du média.
 *  - Sinon, retourne undefined.
 *
 * Utilisé par :
 *  - MediaTab (éditeur) pour pré-remplir l'aperçu d'image quand le wizard
 *    a écrit uniquement mediaRef.
 *  - lib/export/html.ts pour produire la balise <img src=...>.
 */
export function resolveImageUrl(
  image: SectionImage | undefined,
  funnel: Funnel | undefined
): string | undefined {
  if (!image) return undefined;
  if (image.url && image.url.trim().length > 0) return image.url;
  if (image.mediaRef) {
    const media = findMediaById(funnel, image.mediaRef);
    if (media?.url) return media.url;
  }
  return undefined;
}

/**
 * Retourne une SectionImage "matérialisée" où `url` est garanti d'être
 * rempli si une source existait (via url ou mediaRef).
 * Utilisé par l'éditeur pour afficher l'aperçu sans toucher au stockage.
 */
export function materializeSectionImage(
  image: SectionImage | undefined,
  funnel: Funnel | undefined
): SectionImage | undefined {
  if (!image) return undefined;
  if (image.url) return image;
  const resolved = resolveImageUrl(image, funnel);
  if (!resolved) return image;
  return { ...image, url: resolved };
}

/**
 * Détection robuste de l'image utilisable (mode != none + URL valide).
 */
export function sectionHasUsableImage(
  section: FunnelSection,
  funnel: Funnel | undefined
): boolean {
  if (!section.image) return false;
  const resolved = materializeSectionImage(section.image, funnel);
  return !!(resolved && resolved.mode !== "none" && resolved.url);
}

/**
 * Détecte si une section contient du texte substantiel (subheadline, body, bullets, items).
 */
export function sectionHasSubstantialText(section: FunnelSection): boolean {
  if (section.headline && section.headline.trim().length > 0) return true;
  if (section.subheadline && section.subheadline.trim().length > 0) return true;
  if (section.body && section.body.trim().length > 0) return true;
  if (Array.isArray(section.bullets) && section.bullets.length > 0) return true;
  if (Array.isArray(section.items) && section.items.length > 0) return true;
  return false;
}

/**
 * Variant de layout effectif. Si la section n'en a pas mais a image + texte,
 * on déduit split-text-image (cohérent avec le preview).
 */
export function effectiveLayoutVariant(
  section: FunnelSection,
  funnel: Funnel | undefined
): string {
  const v = section.layoutVariant;
  if (v) return v;
  if (sectionHasUsableImage(section, funnel) && sectionHasSubstantialText(section)) {
    return "split-text-image";
  }
  return "centered";
}

/**
 * Patch utilitaire : prend une section et retourne une copie avec
 * son image résolue. Pratique pour l'export.
 */
export function resolveSectionImage(
  section: FunnelSection,
  funnel: Funnel | undefined
): FunnelSection {
  if (!section.image) return section;
  const materialized = materializeSectionImage(section.image, funnel);
  if (materialized === section.image) return section;
  return { ...section, image: materialized };
}
