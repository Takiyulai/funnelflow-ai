// lib/funnels/applyTemplate.ts

import type {
  AnimationPreset,
  AnimationTarget,
  Funnel,
  FunnelBrief,
  FunnelSection,
  FunnelSectionType,
  SectionAnimations,
  SectionLayoutVariant,
  TemplateCondition,
  TemplateDefinition,
  TemplateLayoutRule,
  TemplateSectionSlot,
  VideoSource,
} from "@/lib/funnels/types";

// ─────────────────────────────────────────────────────────────────────────────
// Évaluation de TemplateCondition (union discriminée)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Évalue une TemplateCondition contre le brief utilisateur.
 * Si la condition est absente (slot sans includeIf), elle est satisfaite.
 */
export function evaluateCondition(
  condition: TemplateCondition | undefined,
  brief: FunnelBrief
): boolean {
  if (!condition) return true;

  if ("always" in condition) {
    return condition.always === true;
  }

  if ("has" in condition) {
    switch (condition.has) {
      case "video":
        return Boolean(brief.videoUrl && brief.videoUrl.trim().length > 0);
      case "about":
        return Boolean(brief.aboutText && brief.aboutText.trim().length > 0);
      case "logo":
        return Boolean(brief.logoUrl && brief.logoUrl.trim().length > 0);
      default:
        return false;
    }
  }

  if ("funnelKindIn" in condition) {
    if (!brief.funnelKind) return false;
    return condition.funnelKindIn.includes(brief.funnelKind);
  }

  if ("moodIn" in condition) {
    if (!brief.moodId) return false;
    return condition.moodIn.includes(brief.moodId);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution du layoutVariant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détermine si une règle de layout s'applique à la section IA candidate.
 */
function ruleMatchesSection(
  rule: TemplateLayoutRule,
  aiSection: FunnelSection | undefined
): boolean {
  const when = rule.when;
  if ("sectionMissing" in when) {
    switch (when.sectionMissing) {
      case "image":
        return !aiSection?.image?.url;
      case "video":
        return !aiSection?.video?.url;
      case "bullets":
        return !aiSection?.bullets || aiSection.bullets.length === 0;
      default:
        return false;
    }
  }
  return false;
}

/**
 * Layouts dont l'esthétique repose sur une image.
 */
const IMAGE_DEPENDENT_LAYOUTS: SectionLayoutVariant[] = [
  "split-text-image",
  "split-image-text",
];

/**
 * Layouts dont l'esthétique repose sur une vidéo.
 */
const VIDEO_DEPENDENT_LAYOUTS: SectionLayoutVariant[] = [
  "wide-banner",
];

/**
 * Résout le layoutVariant final d'un slot, en appliquant les règles de fallback
 * du template (ex : pas d'image dans la section IA -> centered).
 */
export function resolveLayout(
  slot: TemplateSectionSlot,
  rules: TemplateLayoutRule[] | undefined,
  aiSection: FunnelSection | undefined
): SectionLayoutVariant {
  const baseLayout: SectionLayoutVariant = slot.layoutVariant;
  if (!rules || rules.length === 0) return baseLayout;

  for (const rule of rules) {
    if (!ruleMatchesSection(rule, aiSection)) continue;

    // On ne déclenche le fallback "image manquante" que si le layout de base
    // dépend réellement d'une image, sinon on garde le layout d'origine.
    if (
      "sectionMissing" in rule.when &&
      rule.when.sectionMissing === "image" &&
      !IMAGE_DEPENDENT_LAYOUTS.includes(baseLayout)
    ) {
      continue;
    }

    if (
      "sectionMissing" in rule.when &&
      rule.when.sectionMissing === "video" &&
      !VIDEO_DEPENDENT_LAYOUTS.includes(baseLayout)
    ) {
      continue;
    }

    return rule.fallbackLayout;
  }

  return baseLayout;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching IA ↔ slot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trouve la section IA correspondant à un slot (par id, sinon par type).
 */
export function findMatchingAiSection(
  slot: TemplateSectionSlot,
  aiSections: FunnelSection[]
): FunnelSection | undefined {
  const byId = aiSections.find((s) => s.id === slot.id);
  if (byId) return byId;
  return aiSections.find((s) => s.type === slot.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder (slot requis non couvert par l'IA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit une section placeholder minimale pour un slot requis non couvert.
 * `headline` est obligatoire dans FunnelSection : on en fournit toujours un.
 */
function buildPlaceholderSection(
  slot: TemplateSectionSlot,
  brief: FunnelBrief,
  layout: SectionLayoutVariant,
  animations: SectionAnimations | undefined
): FunnelSection {
  const brand = brief.brandName?.trim() || brief.offerName?.trim() || "";
  const headline = brand ? `${brand} — ${slot.type}` : slot.type;

  return {
    id: slot.id,
    type: slot.type,
    headline,
    layoutVariant: layout,
    animations,
    visible: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fusion IA × slot × brief
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Types de section pouvant accueillir une vidéo utilisateur.
 */
const VIDEO_HOST_TYPES: FunnelSectionType[] = ["hero", "video"];

/**
 * Détecte le provider d'une URL vidéo utilisateur.
 */
function detectVideoProvider(url: string): VideoSource["provider"] {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  return "url";
}

/**
 * Fusionne une section IA avec son slot de template :
 *  - applique le layoutVariant résolu (avec layoutRules)
 *  - applique les animations par défaut du slot si l'IA n'en a pas posé
 *  - injecte la vidéo / le texte "à propos" provenant du brief utilisateur
 *  - garantit la présence d'un headline non vide
 */
function mergeAiSectionWithSlot(
  aiSection: FunnelSection,
  slot: TemplateSectionSlot,
  layout: SectionLayoutVariant,
  brief: FunnelBrief
): FunnelSection {
  const merged: FunnelSection = {
    ...aiSection,
    id: aiSection.id || slot.id,
    type: aiSection.type || slot.type,
    layoutVariant: layout,
    animations: aiSection.animations ?? slot.animations,
  };

  // Vidéo utilisateur (hero / video) si l'utilisateur a fourni une URL
  if (
    !merged.video?.url &&
    brief.videoUrl &&
    VIDEO_HOST_TYPES.includes(slot.type)
  ) {
    merged.video = {
      provider: detectVideoProvider(brief.videoUrl),
      url: brief.videoUrl,
    };
  }

  // Texte "à propos" si slot dédié et body vide
  if (
    slot.type === "about" &&
    (!merged.body || merged.body.trim().length === 0) &&
    brief.aboutText &&
    brief.aboutText.trim().length > 0
  ) {
    merged.body = brief.aboutText;
  }

  // Headline obligatoire : fallback si l'IA l'a omis
  if (!merged.headline || merged.headline.trim().length === 0) {
    const brand = brief.brandName?.trim() || brief.offerName?.trim() || "";
    merged.headline = brand ? `${brand} — ${slot.type}` : slot.type;
  }
  const isMainCtaHost =
    slot.type === "offer" ||
    slot.type === "cta" ||
    slot.type === "form" ||
    (slot.type === "hero" && !merged.cta);

  if (isMainCtaHost && brief.ctaUrl && brief.ctaUrl.trim().length > 0) {
    const userUrl = brief.ctaUrl.trim();
    // On respecte le label que l'IA a généré (plus contextuel) ou on tombe en fallback
    const label =
      merged.cta?.label?.trim() ||
      brief.ctaLabel?.trim() ||
      "Je commence maintenant";

    merged.cta = {
      mode: "redirect",
      label,
      url: userUrl,
      target: brief.ctaTarget ?? "_blank",
    };
  }
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique : applyTemplateToFunnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applique un template premium au funnel généré par l'IA, en respectant le brief.
 *
 * Étapes :
 *  1) Itère sur les slots du template dans l'ordre
 *  2) Filtre par includeIf (ex : "has video" -> on inclut le slot vidéo
 *     seulement si l'utilisateur a fourni une URL)
 *  3) Pour chaque slot conservé :
 *     - cherche la section IA correspondante
 *     - applique le layoutVariant résolu (avec layoutRules)
 *     - applique les animations par défaut du slot
 *     - injecte les données utilisateur (video, about)
 *  4) Génère un placeholder si le slot est requis et que l'IA ne l'a pas couvert
 *  5) Ajoute en fin les sections IA non mappées (préserve la créativité IA)
 *  6) Renseigne meta.templateId
 */
export function applyTemplateToFunnel(
  template: TemplateDefinition,
  aiFunnel: Funnel,
  brief: FunnelBrief
): Funnel {
  const aiSections = aiFunnel.sections ?? [];
  const usedAiIds = new Set<string>();
  const finalSections: FunnelSection[] = [];

  for (const slot of template.sections) {
    if (!evaluateCondition(slot.includeIf, brief)) continue;

    const aiSection = findMatchingAiSection(slot, aiSections);
    const layout = resolveLayout(slot, template.layoutRules, aiSection);

    if (aiSection) {
      usedAiIds.add(aiSection.id);
      finalSections.push(mergeAiSectionWithSlot(aiSection, slot, layout, brief));
    } else if (slot.required) {
      finalSections.push(
        buildPlaceholderSection(slot, brief, layout, slot.animations)
      );
    }
    // sinon : slot optionnel non couvert -> on saute
  }

  // Sections IA additionnelles non mappées (au cas où l'IA en propose plus)
  for (const ai of aiSections) {
    if (usedAiIds.has(ai.id)) continue;
    finalSections.push(ai);
  }

  return {
    ...aiFunnel,
    sections: finalSections,
    meta: {
      ...(aiFunnel.meta ?? {}),
      templateId: template.id,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers utilitaires (prompt IA, préchargement keyframes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste des types de sections attendus par le template (pour le prompt IA).
 * On exclut les slots dont la condition includeIf n'est pas satisfaite.
 */
export function getTemplateSectionTypes(
  template: TemplateDefinition,
  brief: FunnelBrief
): FunnelSectionType[] {
  return template.sections
    .filter((s) => evaluateCondition(s.includeIf, brief))
    .map((s) => s.type);
}

/**
 * Liste des AnimationPreset utilisés par le template
 * (utile pour précharger uniquement les keyframes nécessaires).
 *
 * Note : `template.bulletAnimation` ("stagger" | "uniform" | "none") est
 * volontairement exclu — c'est un mode de séquencement, pas un AnimationPreset.
 */
export function getTemplateAnimations(
  template: TemplateDefinition
): AnimationPreset[] {
  const set = new Set<AnimationPreset>();
  const targets: AnimationTarget[] = [
    "eyebrow",
    "headline",
    "subheadline",
    "body",
    "bullets",
    "image",
    "video",
    "cta",
  ];

  for (const slot of template.sections) {
    const anims: SectionAnimations | undefined = slot.animations;
    if (!anims) continue;
    for (const t of targets) {
      const preset = anims[t];
      if (preset && preset !== "none") set.add(preset);
    }
  }

  return Array.from(set);
}
