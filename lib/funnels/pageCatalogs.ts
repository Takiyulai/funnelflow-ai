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
  /** 🆕 LOT 3 — Page OPTIONNELLE : n'est générée que si l'utilisateur l'a
   *  cochée dans l'aperçu "pages générées" du wizard (FunnelBrief.selectedOptionalPages).
   *  Absent/false = page toujours générée (comportement historique). */
  optional?: boolean;
  /** 🆕 LOT 3 — Libellé affiché dans la checklist du wizard pour une page
   *  optionnelle (sinon on retombe sur `name`). */
  toggleLabel?: { fr: string; en: string; es: string };
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
    // ⚠️ La page « Accès » / « Livraison » (role: "delivery") a été RETIRÉE du
    // blueprint lead-magnet. AutoFunnel AI n'héberge aucun fichier : la
    // ressource est livrée par email (meta.deliveryEmail) ou via un lien
    // externe que l'utilisateur ajoute lui-même (CTA personnalisé de
    // l'éditeur). La page faisait doublon avec « Merci » et produisait un copy
    // incohérent (« ressource prête à télécharger » + bouton « vérifier ma
    // boîte mail »). Le rôle "delivery" reste défini partout ailleurs pour la
    // RÉTROCOMPATIBILITÉ des tunnels déjà générés en 3 pages.
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
      // 🆕 LOT 4 — Salle d'attente / page live : accessible entre la
      // confirmation et le début réel du webinaire. Countdown vers l'heure de
      // démarrage + zone d'accueil pour le lien Zoom/YouTube/Meet du jour J
      // (injecté par applyWebinarSchedule à partir de brief.webinarExternalLink).
      role: "live",
      slug: "en-direct",
      name: "Salle d'attente / Live",
      defaultSectionTypes: ["hero", "urgency", "process", "cta"],
      allowedSectionTypes: [
        "hero", "urgency", "process", "cta",
        "about", "video", "faq",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["SCARCITY-URGENCY"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      role: "replay",
      slug: "replay",
      name: "Page de replay",
      defaultSectionTypes: ["hero", "video", "benefits", "cta", "faq"],
      allowedSectionTypes: [
        "hero", "video", "benefits", "cta", "faq",
        "about", "testimonials", "guarantee", "proof", "offer", "urgency",
      ],
      copywritingFramework: "PAS-FOMO",
      secondaryFrameworks: ["SCARCITY-URGENCY", "4P"],
      // ⚠️ Sur le replay d'un webinaire, la VIDÉO prime sur tout
      heroMediaPolicy: "prefer-video",
      minSections: 4,
      publiclyLinked: false,
    },
    {
      // 🆕 LOT 4 — Page de vente post-webinaire : réutilise le squelette
      // direct-response complet du produit digital (voir DIGITAL_PRODUCT.sales).
      role: "sales",
      slug: "offre",
      name: "Page de vente (post-webinaire)",
      defaultSectionTypes: [
        "hero", "problem", "agitation", "solution", "benefits",
        "about", "testimonials", "pricing", "bonus", "guarantee",
        "faq", "urgency", "cta",
      ],
      allowedSectionTypes: [
        "hero", "benefits", "video", "testimonials", "pricing",
        "bonus", "guarantee", "faq", "cta", "about", "proof", "process",
        "offer", "problem", "agitation", "solution", "urgency",
      ],
      copywritingFramework: "PAS",
      secondaryFrameworks: ["4P", "FAB", "SCARCITY-URGENCY"],
      heroMediaPolicy: "prefer-video",
      minSections: 8,
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
      // 🆕 Sous-étape C : squelette de page de vente DIRECT-RESPONSE complet :
      // Hero → Problème → Amplification (agitation) → Solution → Bénéfices →
      // Présentation/Autorité (about, APRÈS les bénéfices) → Preuve sociale →
      // Offre+Bonus → Garantie → Objections (FAQ) → Urgence/Rareté → CTA final.
      // L'ordre final est ré-appliqué de façon déterministe (ÉTAPE 13).
      defaultSectionTypes: [
        "hero", "problem", "agitation", "solution", "benefits",
        "about", "testimonials", "pricing", "bonus", "guarantee",
        "faq", "urgency", "cta",
      ],
      allowedSectionTypes: [
        "hero", "benefits", "video", "testimonials", "pricing",
        "bonus", "guarantee", "faq", "cta", "about", "proof", "process",
        "offer", "problem", "agitation", "solution", "urgency",
      ],
      copywritingFramework: "PAS",
      secondaryFrameworks: ["4P", "FAB", "SCARCITY-URGENCY"],
      heroMediaPolicy: "prefer-video",
      minSections: 8,
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
      // 🆕 Sous-étape D : upsell — offre complémentaire après l'achat.
      role: "upsell",
      slug: "offre-complementaire",
      name: "Offre complémentaire (upsell)",
      // Accroche offre additionnelle → complémentarité → bénéfice spécifique →
      // CTA accepter (le lien « refuser » mène à la page suivante = downsell).
      defaultSectionTypes: ["hero", "benefits", "offer", "guarantee", "urgency", "cta"],
      allowedSectionTypes: [
        "hero", "benefits", "offer", "guarantee", "urgency", "cta",
        "about", "testimonials", "video", "pricing",
      ],
      copywritingFramework: "4P",
      secondaryFrameworks: ["SCARCITY-URGENCY", "FAB"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      // 🆕 Sous-étape D : downsell — repli si l'upsell est refusé.
      role: "downsell",
      slug: "offre-allegee",
      name: "Offre allégée (downsell)",
      // Version réduite / moins chère de l'upsell. CTA accepter, lien refuser
      // vers la page suivante (= merci).
      defaultSectionTypes: ["hero", "benefits", "offer", "cta"],
      allowedSectionTypes: [
        "hero", "benefits", "offer", "cta",
        "guarantee", "urgency", "testimonials", "pricing",
      ],
      copywritingFramework: "4P",
      secondaryFrameworks: ["REASSURANCE"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    {
      role: "thankyou",
      slug: "merci",
      name: "Page de remerciement",
      // 🆕 Sous-étape D/F : PAS de "about" ici (déjà sur la page de vente) pour
      // éviter la duplication inter-pages. next-steps → process, download → offer.
      defaultSectionTypes: ["hero", "process", "offer", "cta"],
      allowedSectionTypes: [
        "hero", "process", "offer", "cta",
        "video", "testimonials", "thank_you",
      ],
      copywritingFramework: "REASSURANCE",
      secondaryFrameworks: ["NEXT-STEPS"],
      heroMediaPolicy: "single-only",
      minSections: 3,
      publiclyLinked: false,
    },
    // ⚠️ La page « Accès au produit » (role: "access") a été RETIRÉE du
    // blueprint, pour la même raison que la page « Accès » du lead magnet :
    // AutoFunnel AI n'héberge aucun fichier ni espace membre. Le lien vers le
    // produit (Drive, Notion, espace membre externe…) se pose sur la page
    // « Merci » via le CTA personnalisé de l'éditeur. Le rôle "access" reste
    // défini partout ailleurs pour la RÉTROCOMPATIBILITÉ des tunnels déjà
    // générés en 4 pages.
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
      // 🆕 LOT 7 — Qualification OPTIONNELLE avant le calendrier : filtre les
      // prospects (budget, besoin, disponibilité) avant qu'ils ne réservent un
      // créneau. Cochable dans l'aperçu « pages générées » du wizard (LOT 3).
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
      optional: true,
      toggleLabel: {
        fr: "Page de qualification — filtre les prospects avant le calendrier",
        en: "Qualification page — screens prospects before the calendar",
        es: "Página de calificación — filtra prospectos antes del calendario",
      },
    },
    {
      role: "booking",
      slug: "reservation",
      name: "Page de prise de rendez-vous",
      // 🆕 LOT 7 — "form" reste le repli historique (champs de contact) ; si un
      // lien Calendly/Cal.com est fourni, le calendrier natif s'affiche EN PLUS
      // (voir applyBookingCalendarEmbed dans lib/ai/generate.ts).
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
      // 🆕 LOT 8 — VSL (Video Sales Letter) OPTIONNELLE : si cochée dans le
      // wizard, devient la page d'entrée (avant la candidature) — voir le
      // basculement de homeRole dans generateMultiPageFunnelWithAI.
      role: "vsl",
      slug: "presentation",
      name: "VSL (vidéo de présentation)",
      defaultSectionTypes: ["hero", "video", "benefits", "guarantee", "cta"],
      allowedSectionTypes: [
        "hero", "video", "benefits", "guarantee", "cta",
        "about", "testimonials", "proof", "faq",
      ],
      copywritingFramework: "BAB",
      secondaryFrameworks: ["PAS"],
      // ⚠️ La VSL EST la vidéo : elle doit primer sur tout dans le hero.
      heroMediaPolicy: "prefer-video",
      minSections: 4,
      publiclyLinked: true,
      optional: true,
      toggleLabel: {
        fr: "VSL (vidéo de présentation) — page d'entrée avant la candidature",
        en: "VSL (video sales letter) — entry page before the application",
        es: "VSL (vídeo de presentación) — página de entrada antes de la candidatura",
      },
    },
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
      // 🆕 LOT 9 — Page-TEMPLATE d'une journée de challenge : générée une fois
      // par l'IA, puis dupliquée en pages "jour 1..N" par applyChallengeMultiDay
      // (lib/ai/generate.ts) selon brief.challengeDays. Chaque page dupliquée
      // porte le même rôle "challenge-day" (dayIndex/dayTotal la distinguent).
      role: "challenge-day",
      slug: "jour-1",
      name: "Jour 1 du challenge",
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
    {
      // 🆕 LOT 9 — Pitch final : offre proposée à la clôture du challenge.
      // Réutilise le squelette direct-response complet du produit digital
      // (voir DIGITAL_PRODUCT.sales), comme la page de vente post-webinaire.
      role: "sales",
      slug: "offre",
      name: "Pitch final (offre de fin de challenge)",
      defaultSectionTypes: [
        "hero", "problem", "agitation", "solution", "benefits",
        "about", "testimonials", "pricing", "bonus", "guarantee",
        "faq", "urgency", "cta",
      ],
      allowedSectionTypes: [
        "hero", "benefits", "video", "testimonials", "pricing",
        "bonus", "guarantee", "faq", "cta", "about", "proof", "process",
        "offer", "problem", "agitation", "solution", "urgency",
      ],
      copywritingFramework: "PAS",
      secondaryFrameworks: ["4P", "FAB", "SCARCITY-URGENCY"],
      heroMediaPolicy: "prefer-video",
      minSections: 8,
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
/*  🆕 LOT 3 — Page OTO/tripwire générique (réutilisable par TOUS les kinds) */
/* ------------------------------------------------------------------ */

/**
 * Page OPTIONNELLE, ajoutée automatiquement au blueprint de chaque type de
 * tunnel. N'est générée que si l'utilisateur la coche dans l'aperçu "pages
 * générées" du wizard (voir FunnelBrief.selectedOptionalPages). Générique par
 * conception : petite offre complémentaire à prix réduit (tripwire) OU offre
 * unique à durée limitée (OTO), le copy s'adapte au contexte via l'IA/fallback.
 */
const GENERIC_OTO_BLUEPRINT: PageBlueprint = {
  role: "oto",
  slug: "offre-speciale",
  name: "Offre spéciale (OTO / tripwire)",
  defaultSectionTypes: ["hero", "benefits", "offer", "guarantee", "urgency", "cta"],
  allowedSectionTypes: [
    "hero", "benefits", "offer", "guarantee", "urgency", "cta",
    "about", "testimonials", "video", "pricing", "faq",
  ],
  copywritingFramework: "4P",
  secondaryFrameworks: ["SCARCITY-URGENCY", "FAB"],
  heroMediaPolicy: "single-only",
  minSections: 3,
  publiclyLinked: false,
  optional: true,
  toggleLabel: {
    fr: "Offre spéciale (OTO / tripwire) — petite offre complémentaire à prix réduit",
    en: "Special offer (OTO / tripwire) — small complementary offer at a reduced price",
    es: "Oferta especial (OTO / tripwire) — pequeña oferta complementaria a precio reducido",
  },
};

/* ------------------------------------------------------------------ */
/*  Registre principal                                                 */
/* ------------------------------------------------------------------ */

const RAW_BLUEPRINTS: Record<FunnelKind, FunnelBlueprint> = {
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

// 🆕 LOT 6 — Sur le lead magnet, le tripwire (= page "oto") se positionne
// juste APRÈS la capture et AVANT la page de remerciement (petite offre 7-27€
// proposée à chaud) — pas en toute fin de tunnel comme pour les autres kinds.
// (Avant la suppression de la page « Accès », il s'insérait entre « Merci » et
// « Livraison » ; sans page de livraison, la place logique est ici.)
const LEAD_MAGNET_TRIPWIRE_BLUEPRINT: PageBlueprint = {
  ...GENERIC_OTO_BLUEPRINT,
  name: "Tripwire (petite offre 7-27€)",
  toggleLabel: {
    fr: "Tripwire (petite offre à 7-27€) — proposée juste après l'inscription, avant la page de remerciement",
    en: "Tripwire (small $7-27 offer) — shown right after opt-in, before the thank-you page",
    es: "Tripwire (pequeña oferta de 7-27€) — mostrada justo después de la inscripción, antes de la página de gracias",
  },
};

// 🆕 LOT 3 — La page OTO générique est ajoutée à TOUS les blueprints ici, en un
// seul endroit, plutôt que dupliquée dans chaque catalogue ci-dessus.
export const FUNNEL_BLUEPRINTS: Record<FunnelKind, FunnelBlueprint> = Object.fromEntries(
  (Object.entries(RAW_BLUEPRINTS) as [FunnelKind, FunnelBlueprint][]).map(([kind, bp]) => {
    if (kind === "lead-magnet") {
      // Insertion AVANT la page de remerciement plutôt qu'en fin de liste.
      const thankyouIdx = bp.pages.findIndex((p) => p.role === "thankyou");
      const pages = [...bp.pages];
      pages.splice(
        thankyouIdx >= 0 ? thankyouIdx : pages.length,
        0,
        LEAD_MAGNET_TRIPWIRE_BLUEPRINT,
      );
      return [kind, { ...bp, pages }];
    }
    return [kind, { ...bp, pages: [...bp.pages, GENERIC_OTO_BLUEPRINT] }];
  }),
) as Record<FunnelKind, FunnelBlueprint>;

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

/** 🆕 LOT 3 — Pages TOUJOURS générées pour ce type de tunnel (non cochables). */
export function getRequiredPageBlueprints(kind: FunnelKind): PageBlueprint[] {
  return getFunnelBlueprint(kind).pages.filter((p) => !p.optional);
}

/** 🆕 LOT 3 — Pages OPTIONNELLES proposées en aperçu cochable dans le wizard. */
export function getOptionalPageBlueprints(kind: FunnelKind): PageBlueprint[] {
  return getFunnelBlueprint(kind).pages.filter((p) => p.optional === true);
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
  "agitation",
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
