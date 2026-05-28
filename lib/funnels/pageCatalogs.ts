// lib/funnels/pageCatalogs.ts
import type {
  FunnelKind,
  PageRole,
  FunnelSectionType,
} from "@/lib/funnels/types";

/**
 * Frameworks de copywriting supportés.
 * Utilisés par les prompts IA (lib/ai/prompts.ts) pour adapter le ton et la structure.
 */
export type CopywritingFramework =
  | "AIDA"
  | "PAS"
  | "PAS-FOMO"
  | "4P"
  | "BAB"
  | "FAB"
  | "REASSURANCE"
  | "NEXT-STEPS"
  | "STAR"
  | "QUEST"
  | "SCARCITY-URGENCY";

/**
 * Politique de gestion des médias dans le hero d'une page.
 * Lue par enforceHeroSingleMedia() dans lib/ai/generate.ts.
 */
export type HeroMediaPolicy = "prefer-video" | "prefer-image" | "single-only";

export interface PageBlueprint {
  role: PageRole;
  /** Slug par défaut (normalisé) */
  slug: string;
  /** Nom interne (utilisé pour le titre par défaut si pas de PAGE_COPY) */
  name: string;
  /** Sections par défaut quand l'IA ne renvoie rien */
  defaultSectionTypes: FunnelSectionType[];
  /** Sections autorisées (whitelist) — toute section hors liste est filtrée */
  allowedSectionTypes?: FunnelSectionType[];
  /** Framework de copywriting principal à appliquer */
  copywritingFramework?: CopywritingFramework;
  /** Frameworks secondaires (combinables) */
  secondaryFrameworks?: CopywritingFramework[];
  /** Politique média du hero */
  heroMediaPolicy?: HeroMediaPolicy;
  /** Nombre minimum de sections (pour le fallback) */
  minSections?: number;
  /** La page est-elle indexable / publiquement liée ? */
  publiclyLinked?: boolean;
}

export interface FunnelBlueprint {
  kind: FunnelKind;
  pages: PageBlueprint[];
}

/* ------------------------------------------------------------------ */
/*  Catalogues par type de tunnel                                      */
/* ------------------------------------------------------------------ */

const LEAD_MAGNET: FunnelBlueprint = {
  kind: "lead-magnet",
  pages: [
    {
      role: "optin",
      slug: "accueil",
      name: "Page d'inscription",
      defaultSectionTypes: ["hero", "benefits", "testimonials", "faq", "cta"],
      allowedSectionTypes: [
        "hero", "benefits", "testimonials", "faq", "cta",
        "about", "proof", "process", "video", "guarantee",
      ],
      copywritingFramework: "AIDA",
      secondaryFrameworks: ["FAB"],
      heroMediaPolicy: "prefer-image",
      minSections: 4,
      publiclyLinked: true,
    },
    {
      role: "thankyou",
      slug: "merci",
      name: "Page de remerciement",
      // next-steps → process, reminder → about
      defaultSectionTypes: ["hero", "process", "about", "cta"],
      allowedSectionTypes: [
        "hero", "process", "about", "cta",
        "testimonials", "video", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      role: "delivery",
      slug: "ressource",
      name: "Page de livraison",
      // download → offer, next-steps → process
      defaultSectionTypes: ["hero", "offer", "process", "cta"],
      allowedSectionTypes: [
        "hero", "offer", "process", "cta",
        "about", "video", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
  ],
};

const WEBINAR: FunnelBlueprint = {
  kind: "webinar",
  pages: [
    {
      role: "registration",
      slug: "inscription",
      name: "Page d'inscription au webinaire",
      // agenda → program, speaker → about
      defaultSectionTypes: ["hero", "benefits", "program", "about", "testimonials", "faq", "cta"],
      allowedSectionTypes: [
        "hero", "benefits", "program", "about", "testimonials",
        "faq", "cta", "proof", "video", "guarantee", "webinar",
      ],
      copywritingFramework: "AIDA",
      secondaryFrameworks: ["BAB", "SCARCITY-URGENCY"],
      heroMediaPolicy: "prefer-image",
      minSections: 5,
      publiclyLinked: true,
    },
    {
      role: "confirmation",
      slug: "confirmation",
      name: "Page de confirmation",
      defaultSectionTypes: ["hero", "process", "about", "program", "cta"],
      allowedSectionTypes: [
        "hero", "process", "about", "program", "cta",
        "video", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 4,
      publiclyLinked: false,
    },
    {
      role: "replay",
      slug: "replay",
      name: "Page de replay",
      defaultSectionTypes: ["hero", "video", "benefits", "cta", "faq"],
      allowedSectionTypes: [
        "hero", "video", "benefits", "cta", "faq",
        "about", "testimonials", "guarantee", "proof", "offer",
      ],
      copywritingFramework: "PAS-FOMO",
      secondaryFrameworks: ["SCARCITY-URGENCY", "4P"],
      // ⚠️ Sur le replay d'un webinaire, la VIDÉO prime sur tout
      heroMediaPolicy: "prefer-video",
      minSections: 4,
      publiclyLinked: false,
    },
  ],
};

const DIGITAL_PRODUCT: FunnelBlueprint = {
  kind: "digital-product",
  pages: [
    {
      role: "sales",
      slug: "offre",
      name: "Page de vente",
      defaultSectionTypes: [
        "hero", "benefits", "video", "testimonials",
        "pricing", "bonus", "guarantee", "faq", "cta",
      ],
      allowedSectionTypes: [
        "hero", "benefits", "video", "testimonials", "pricing",
        "bonus", "guarantee", "faq", "cta", "about", "proof", "process",
        "offer", "problem", "solution",
      ],
      copywritingFramework: "PAS",
      secondaryFrameworks: ["4P", "FAB", "SCARCITY-URGENCY"],
      heroMediaPolicy: "prefer-video",
      minSections: 6,
      publiclyLinked: true,
    },
    {
      role: "checkout",
      slug: "commande",
      name: "Page de commande",
      defaultSectionTypes: ["hero", "pricing", "guarantee", "testimonials", "cta"],
      allowedSectionTypes: [
        "hero", "pricing", "guarantee", "testimonials", "cta",
        "about", "faq", "bonus", "form",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["SCARCITY-URGENCY"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      role: "thankyou",
      slug: "merci",
      name: "Page de remerciement",
      // next-steps → process, download → offer, reminder → about
      defaultSectionTypes: ["hero", "process", "offer", "about", "cta"],
      allowedSectionTypes: [
        "hero", "process", "offer", "about", "cta",
        "video", "testimonials", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      role: "access",
      slug: "acces",
      name: "Page d'accès au produit",
      defaultSectionTypes: ["hero", "offer", "process", "cta"],
      allowedSectionTypes: [
        "hero", "offer", "process", "cta",
        "about", "video", "faq",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
  ],
};

const BOOKING: FunnelBlueprint = {
  kind: "booking",
  pages: [
    {
      role: "landing",
      slug: "rendez-vous",
      name: "Page de réservation",
      // speaker → about
      defaultSectionTypes: ["hero", "benefits", "process", "testimonials", "faq", "cta"],
      allowedSectionTypes: [
        "hero", "benefits", "process", "testimonials", "faq",
        "cta", "about", "guarantee", "proof", "qualification",
      ],
      copywritingFramework: "AIDA",
      secondaryFrameworks: ["BAB"],
      heroMediaPolicy: "prefer-image",
      minSections: 5,
      publiclyLinked: true,
    },
    {
      role: "booking",
      slug: "reservation",
      name: "Page de prise de rendez-vous",
      defaultSectionTypes: ["hero", "form", "guarantee", "cta"],
      allowedSectionTypes: [
        "hero", "form", "guarantee", "cta",
        "about", "testimonials", "faq",
      ],
      copywritingFramework: "REASSURANCE",
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      role: "confirmation",
      slug: "confirmation",
      name: "Confirmation du rendez-vous",
      defaultSectionTypes: ["hero", "process", "about", "cta"],
      allowedSectionTypes: [
        "hero", "process", "about", "cta",
        "video", "testimonials", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 4,
      publiclyLinked: false,
    },
  ],
};

const COACHING_HIGH_TICKET: FunnelBlueprint = {
  kind: "coaching-high-ticket",
  pages: [
    {
      role: "application",
      slug: "candidature",
      name: "Page de candidature",
      // speaker → about
      defaultSectionTypes: [
        "hero", "benefits", "process", "testimonials",
        "about", "guarantee", "faq", "cta",
      ],
      allowedSectionTypes: [
        "hero", "benefits", "process", "testimonials", "about",
        "guarantee", "faq", "cta", "proof", "video", "qualification",
        "problem", "solution",
      ],
      copywritingFramework: "BAB",
      secondaryFrameworks: ["PAS", "STAR"],
      heroMediaPolicy: "prefer-image",
      minSections: 6,
      publiclyLinked: true,
    },
    {
      role: "qualification",
      slug: "qualification",
      name: "Formulaire de qualification",
      defaultSectionTypes: ["hero", "form", "cta"],
      allowedSectionTypes: [
        "hero", "form", "cta",
        "about", "testimonials", "guarantee",
      ],
      copywritingFramework: "REASSURANCE",
      heroMediaPolicy: "single-only",
      minSections: 2,
      publiclyLinked: false,
    },
    {
      role: "confirmation",
      slug: "merci",
      name: "Candidature reçue",
      defaultSectionTypes: ["hero", "process", "about", "cta"],
      allowedSectionTypes: [
        "hero", "process", "about", "cta",
        "video", "testimonials", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 4,
      publiclyLinked: false,
    },
    {
      role: "case-studies",
      slug: "etudes-de-cas",
      name: "Études de cas",
      defaultSectionTypes: ["hero", "testimonials", "proof", "cta"],
      allowedSectionTypes: [
        "hero", "testimonials", "proof", "cta",
        "about", "benefits", "video",
      ],
      copywritingFramework: "STAR",
      heroMediaPolicy: "prefer-image",
      minSections: 3,
      publiclyLinked: true,
    },
  ],
};

const CHALLENGE: FunnelBlueprint = {
  kind: "challenge",
  pages: [
    {
      role: "challenge-landing",
      slug: "challenge",
      name: "Page du challenge",
      // agenda → program, speaker → about
      defaultSectionTypes: [
        "hero", "benefits", "program", "testimonials",
        "faq", "cta", "guarantee",
      ],
      allowedSectionTypes: [
        "hero", "benefits", "program", "testimonials", "faq",
        "cta", "guarantee", "about", "video", "proof", "process",
      ],
      copywritingFramework: "AIDA",
      secondaryFrameworks: ["BAB", "SCARCITY-URGENCY"],
      heroMediaPolicy: "prefer-image",
      minSections: 5,
      publiclyLinked: true,
    },
    {
      role: "confirmation",
      slug: "confirmation",
      name: "Confirmation d'inscription",
      defaultSectionTypes: ["hero", "process", "about", "program", "cta"],
      allowedSectionTypes: [
        "hero", "process", "about", "program", "cta",
        "video", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 4,
      publiclyLinked: false,
    },
    {
      role: "challenge-day",
      slug: "jour",
      name: "Page d'une journée de challenge",
      defaultSectionTypes: ["hero", "video", "benefits", "cta", "faq"],
      allowedSectionTypes: [
        "hero", "video", "benefits", "cta", "faq",
        "process", "about", "testimonials",
      ],
      copywritingFramework: "4P",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "prefer-video",
      minSections: 4,
      publiclyLinked: false,
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Blueprints legacy (rétrocompat — mappés vers les blueprints modernes) */
/* ------------------------------------------------------------------ */

// Les anciens FunnelKind legacy pointent vers la blueprint moderne équivalente,
// mais doivent quand même exister dans le Record<FunnelKind, …>.

const VSL_LEGACY: FunnelBlueprint = {
  ...DIGITAL_PRODUCT,
  kind: "vsl",
};

const FORMATION_LEGACY: FunnelBlueprint = {
  ...DIGITAL_PRODUCT,
  kind: "formation",
};

const SERVICE_LEGACY: FunnelBlueprint = {
  ...BOOKING,
  kind: "service",
};

const SAAS_LEGACY: FunnelBlueprint = {
  ...DIGITAL_PRODUCT,
  kind: "saas",
};

const THANK_YOU_LEGACY: FunnelBlueprint = {
  kind: "thank-you",
  pages: [
    {
      role: "thankyou",
      slug: "merci",
      name: "Page de remerciement",
      defaultSectionTypes: ["hero", "process", "about", "cta"],
      allowedSectionTypes: [
        "hero", "process", "about", "cta",
        "testimonials", "video", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Registre principal                                                 */
/* ------------------------------------------------------------------ */

export const FUNNEL_BLUEPRINTS: Record<FunnelKind, FunnelBlueprint> = {
  "lead-magnet": LEAD_MAGNET,
  "webinar": WEBINAR,
  "digital-product": DIGITAL_PRODUCT,
  "booking": BOOKING,
  "coaching-high-ticket": COACHING_HIGH_TICKET,
  "challenge": CHALLENGE,
  // Legacy (rétrocompat)
  "vsl": VSL_LEGACY,
  "formation": FORMATION_LEGACY,
  "service": SERVICE_LEGACY,
  "saas": SAAS_LEGACY,
  "thank-you": THANK_YOU_LEGACY,
};

/* ------------------------------------------------------------------ */
/*  Helpers publics                                                    */
/* ------------------------------------------------------------------ */

export function getFunnelBlueprint(kind: FunnelKind): FunnelBlueprint {
  return FUNNEL_BLUEPRINTS[kind] ?? LEAD_MAGNET;
}

export function getPageBlueprint(
  kind: FunnelKind,
  role: PageRole
): PageBlueprint | undefined {
  return getFunnelBlueprint(kind).pages.find((p) => p.role === role);
}

export function getAllowedSectionTypes(
  kind: FunnelKind,
  role: PageRole
): FunnelSectionType[] | undefined {
  return getPageBlueprint(kind, role)?.allowedSectionTypes;
}

export function getHeroMediaPolicy(
  kind: FunnelKind,
  role: PageRole
): HeroMediaPolicy {
  return getPageBlueprint(kind, role)?.heroMediaPolicy ?? "single-only";
}

export function getCopywritingFrameworks(
  kind: FunnelKind,
  role: PageRole
): CopywritingFramework[] {
  const bp = getPageBlueprint(kind, role);
  if (!bp) return ["AIDA"];
  const list: CopywritingFramework[] = [];
  if (bp.copywritingFramework) list.push(bp.copywritingFramework);
  if (bp.secondaryFrameworks) list.push(...bp.secondaryFrameworks);
  return list.length > 0 ? list : ["AIDA"];
}
/* ------------------------------------------------------------------ */
/*  🆕 Capacités déclaratives des sections (universel, auto-extensible) */
/* ------------------------------------------------------------------ */

/**
 * Types de section qui peuvent porter une image principale (section.image).
 * Pour ajouter un nouveau type qui accepte une image : ajouter ici, point.
 */
export const SECTION_TYPES_ACCEPTING_IMAGE: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "hero",
  "about",
  "proof",
  "problem",
  "solution",
  "offer",
  "video",
]);

/**
 * Types de section dont les items[] portent un avatarUrl
 * (visage de personne attendu sur chaque item).
 */
export const SECTION_TYPES_ACCEPTING_AVATARS: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "testimonials",
]);

/**
 * Types de section qui peuvent porter une vidéo principale (section.video).
 */
export const SECTION_TYPES_ACCEPTING_VIDEO: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "hero",
  "video",
  "webinar",
]);

export function sectionTypeAcceptsImage(t: FunnelSectionType): boolean {
  return SECTION_TYPES_ACCEPTING_IMAGE.has(t);
}

export function sectionTypeAcceptsAvatars(t: FunnelSectionType): boolean {
  return SECTION_TYPES_ACCEPTING_AVATARS.has(t);
}

export function sectionTypeAcceptsVideo(t: FunnelSectionType): boolean {
  return SECTION_TYPES_ACCEPTING_VIDEO.has(t);
}
