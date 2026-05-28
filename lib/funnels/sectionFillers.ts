// lib/funnels/sectionFillers.ts
import type {
  FunnelBrief,
  FunnelSection,
  FunnelSectionType,
} from "@/lib/funnels/types";

/**
 * Détermine si une section est vide (pas de contenu substantiel).
 * - hero / cta : on tolère qu'ils n'aient qu'un headline (titre suffit)
 * - autres : il faut body ≥ 30 chars OU items[] non vide OU image/vidéo
 */
export function isSectionEmpty(section: FunnelSection): boolean {
  const hasHeadline = (section.headline?.trim().length ?? 0) >= 5;
  const hasSubheadline = (section.subheadline?.trim().length ?? 0) >= 10;
  const hasBody = (section.body?.trim().length ?? 0) >= 30;
  const hasBullets = Array.isArray(section.bullets) && section.bullets.length > 0;
  const hasItems = Array.isArray(section.items) && section.items.length > 0;
  const hasImage = !!section.image?.url;
  const hasVideo = !!section.video?.url;

  // hero et cta sont valides dès qu'ils ont un headline fort
  if (section.type === "hero" || section.type === "cta" || section.type === "thank_you") {
    return !hasHeadline && !hasBody && !hasImage && !hasVideo;
  }

  // form : valide dès qu'il a un headline (le contenu est dans formConfig)
  if (section.type === "form") {
    return !hasHeadline;
  }

  return !hasBody && !hasBullets && !hasItems && !hasImage && !hasVideo && !hasSubheadline;
}

/**
 * Tente de remplir une section vide en utilisant les champs disponibles du brief.
 * Retourne true si la section a pu être remplie, false sinon.
 *
 * Note : les sections faq/testimonials/pricing/bonus/guarantee ont déjà
 * leurs builders dédiés (buildFallbackXxxItems) appelés en amont dans
 * enrichFunnelPages — donc on ne s'en occupe PAS ici (sinon double remplissage).
 */
export function tryFillSectionFromBrief(
  section: FunnelSection,
  brief: FunnelBrief
): boolean {
  switch (section.type) {
    case "hero":
      // Hero est toujours réparable depuis le brief
      if (!section.headline?.trim()) {
        section.headline = brief.promise || brief.brandName;
      }
      if (!section.subheadline?.trim() && brief.mainPain) {
        section.subheadline = brief.mainPain;
      }
      return true;

    case "about":
      if (brief.aboutText && brief.aboutText.trim().length >= 30) {
        section.body = brief.aboutText;
        if (!section.headline?.trim()) {
          section.headline = `À propos de ${brief.brandName}`;
        }
        return true;
      }
      return false;

    case "cta":
      if (!section.headline?.trim()) {
        section.headline = brief.ctaLabel || brief.primaryCta?.label || brief.promise || "Passez à l'action";
      }
      return true;

    case "thank_you":
      if (!section.headline?.trim()) {
        section.headline = "Merci !";
      }
      if (!section.body?.trim()) {
        section.body = `Votre inscription à ${brief.offerName} est bien enregistrée.`;
      }
      return true;

    default:
      // benefits, process, program, proof, problem, solution, offer, video,
      // pricing, bonus, guarantee, faq, testimonials, form, webinar, qualification
      // → aucun champ correspondant dans le brief minimaliste → impossible de remplir.
      // Les builders dédiés (buildFallbackXxxItems) ont déjà eu leur chance en amont.
      return false;
  }
}

/**
 * Nettoie les sections d'une page :
 *   1. Supprime les sections dont le type n'est pas dans allowedTypes
 *   2. Pour les sections vides restantes : tente de remplir depuis le brief,
 *      sinon supprime.
 *
 * Retourne des stats pour le logging.
 */
export function removeOrFillEmptySections(
  page: { sections: FunnelSection[] },
  allowedTypes: FunnelSectionType[] | undefined,
  brief: FunnelBrief
): { kept: number; removed: number; filled: number } {
  const allowedSet = allowedTypes ? new Set<FunnelSectionType>(allowedTypes) : null;
  let removed = 0;
  let filled = 0;

  const next: FunnelSection[] = [];
  for (const section of page.sections) {
    // Règle 1 : type non autorisé pour cette page → suppression
    if (allowedSet && !allowedSet.has(section.type)) {
      removed++;
      continue;
    }
    // Règle 2 : section vide → tenter de remplir, sinon supprimer
    if (isSectionEmpty(section)) {
      const wasFilled = tryFillSectionFromBrief(section, brief);
      if (wasFilled) {
        filled++;
        next.push(section);
      } else {
        removed++;
      }
      continue;
    }
    // Section non vide et autorisée → on garde
    next.push(section);
  }

  page.sections = next;
  return { kept: next.length, removed, filled };
}
