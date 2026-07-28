// lib/ai/cta-matrix.ts

import type { FunnelKind, PageRole, Language, CtaMode } from "@/lib/funnels/types";

/**
 * Archétype d'action principale d'un tunnel.
 * Les 11 FunnelKind se ramènent à 5 archétypes pour mutualiser la logique CTA.
 */
export type CTAArchetype =
  | "booking"          // Réserver un RDV / créneau / call
  | "purchase"         // Acheter / commander un produit ou service
  | "registration"     // S'inscrire à un événement (webinar, challenge)
  | "download"         // Télécharger un lead-magnet
  | "post-conversion"; // Page de remerciement standalone

/**
 * Intention d'un CTA sur une section donnée.
 * Détermine label + mode + cible.
 */
export type CTAIntent =
  | "convert-primary"  // Action principale du tunnel → page de conversion
  | "offer-primary"    // 🆕 Achat de l'offre DE CETTE PAGE (OTO/tripwire, upsell,
                       //    downsell, vente post-webinaire, pitch de fin de
                       //    challenge). Reste sur la page, ne renvoie JAMAIS
                       //    vers la page de capture du tunnel.
  | "form-scroll"      // Scroll vers le formulaire de la page courante
  | "form-submit"      // Soumettre le formulaire (sur la section "form")
  | "post-action"      // Action après conversion (calendrier, partage…)
  | "none";            // Pas de CTA sur cette section

/**
 * Règles d'intention par rôle de page.
 * - defaultIntent : appliqué à toutes les sections de la page
 * - bySection : overrides ciblés par type de section
 */
export type PageCTARule = {
  defaultIntent: CTAIntent;
  bySection?: Partial<Record<string, CTAIntent>>;
};

/**
 * Configuration complète d'un archétype.
 */
export type ArchetypeCTAConfig = {
  primaryVerb: { fr: string; en: string; es: string };
  /** Pool de labels variés pour la landing (rotation pour éviter la répétition) */
  primaryLabels: { fr: readonly string[]; en: readonly string[]; es: readonly string[] };
  /** Label du bouton de soumission du formulaire */
  formSubmitLabel: { fr: string; en: string; es: string };
  /** Label CTA post-conversion (null = pas de CTA sur la page de confirmation) */
  postActionLabel: { fr: string; en: string; es: string } | null;
  /** 🆕 Label des pages qui VENDENT une offre secondaire (OTO/tripwire, upsell,
   *  downsell, vente post-webinaire…). À défaut : OFFER_PRIMARY_LABEL. */
  offerPrimaryLabel?: { fr: string; en: string; es: string };
  /** Règles par PageRole */
  rules: Partial<Record<PageRole, PageCTARule>>;
};

/**
 * 🆕 Label par défaut d'un CTA d'achat sur une page d'offre secondaire.
 * Volontairement neutre : il doit rester cohérent aussi bien sur un tripwire
 * de lead magnet que sur une vente post-webinaire.
 */
export const OFFER_PRIMARY_LABEL = {
  fr: "Je profite de l'offre",
  en: "Get this offer",
  es: "Aprovechar la oferta",
} as const;

/**
 * 🆕 Rôles de page qui VENDENT une offre propre à la page. Ils reçoivent
 * l'intention "offer-primary" dans TOUS les archétypes (ajoutée à la fin du
 * fichier), ce qui corrige deux anomalies :
 *   - le bouton portait le label principal du tunnel (« Télécharger
 *     gratuitement » sur un tripwire à 17 €, « Je réserve ma place » sur la
 *     page de vente post-webinaire) ;
 *   - il redirigeait vers la page de CAPTURE du tunnel au lieu de l'offre de
 *     la page courante.
 */
const OFFER_ROLES: PageRole[] = ["oto", "upsell", "downsell", "sales"];

// ─────────────────────────────────────────────────────────────────────────────
// Mapping FunnelKind → Archétype
// ─────────────────────────────────────────────────────────────────────────────

export const FUNNEL_KIND_TO_ARCHETYPE: Record<FunnelKind, CTAArchetype> = {
  // Réservation de RDV
  "booking": "booking",
  "coaching-high-ticket": "booking",
  "service": "booking", // legacy : un service implique souvent une réservation

  // Achat
  "digital-product": "purchase",
  "vsl": "purchase",
  "formation": "purchase",
  "saas": "purchase",

  // Inscription événement
  "webinar": "registration",
  "challenge": "registration",

  // Téléchargement
  "lead-magnet": "download",

  // Page standalone
  "thank-you": "post-conversion",
};

// ─────────────────────────────────────────────────────────────────────────────
// Configurations des 5 archétypes
// ─────────────────────────────────────────────────────────────────────────────

const BOOKING_CONFIG: ArchetypeCTAConfig = {
  primaryVerb: { fr: "réserver", en: "book", es: "reservar" },
  primaryLabels: {
    fr: [
      "Réserver mon créneau",
      "Je réserve maintenant",
      "Bloquer mon créneau",
      "Obtenir mon rendez-vous",
      "Réserver mon appel",
    ],
    en: [
      "Book my slot",
      "I book now",
      "Reserve my spot",
      "Get my appointment",
      "Book my call",
    ],
    es: [
      "Reservar mi cita",
      "Reservo ahora",
      "Bloquear mi cita",
      "Obtener mi reunión",
      "Reservar mi llamada",
    ],
  },
  formSubmitLabel: {
    fr: "Confirmer ma réservation",
    en: "Confirm my booking",
    es: "Confirmar mi reserva",
  },
  postActionLabel: {
    fr: "Ajouter à mon calendrier",
    en: "Add to my calendar",
    es: "Añadir a mi calendario",
  },
  rules: {
    landing: { defaultIntent: "convert-primary" },
    qualification: { defaultIntent: "convert-primary" },
    "case-studies": { defaultIntent: "convert-primary" },
    booking: {
      defaultIntent: "form-scroll",
      bySection: { form: "form-submit" },
    },
    application: {
      defaultIntent: "form-scroll",
      bySection: { form: "form-submit" },
    },
    confirmation: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    thankyou: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
  },
};

const PURCHASE_CONFIG: ArchetypeCTAConfig = {
  primaryVerb: { fr: "commander", en: "order", es: "ordenar" },
  primaryLabels: {
    fr: [
      "Commander maintenant",
      "Je veux ce produit",
      "Accéder à l'offre",
      "Rejoindre le programme",
      "Obtenir un accès immédiat",
    ],
    en: [
      "Order now",
      "I want this product",
      "Get the offer",
      "Join the program",
      "Get instant access",
    ],
    es: [
      "Ordenar ahora",
      "Quiero este producto",
      "Acceder a la oferta",
      "Unirme al programa",
      "Obtener acceso inmediato",
    ],
  },
  formSubmitLabel: {
    fr: "Finaliser ma commande",
    en: "Complete my order",
    es: "Completar mi pedido",
  },
  postActionLabel: {
    fr: "Accéder à mon espace",
    en: "Access my dashboard",
    es: "Acceder a mi área",
  },
  rules: {
    sales: { defaultIntent: "convert-primary" },
    landing: { defaultIntent: "convert-primary" },
    checkout: {
      defaultIntent: "form-scroll",
      bySection: { form: "form-submit" },
    },
    // 🆕 L'upsell et le downsell vendent LEUR PROPRE offre, à LEUR prix. En
    // "convert-primary" leurs boutons repartaient vers la page de commande du
    // produit PRINCIPAL — en contradiction avec applyUpsellDeclineLinks, qui
    // documente que « le CTA principal d'achat reste #ff-checkout ».
    upsell: { defaultIntent: "offer-primary" },
    downsell: { defaultIntent: "offer-primary" },
    access: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    thankyou: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    confirmation: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
  },
};

const REGISTRATION_CONFIG: ArchetypeCTAConfig = {
  primaryVerb: { fr: "s'inscrire", en: "register", es: "registrarse" },
  primaryLabels: {
    fr: [
      "S'inscrire gratuitement",
      "Je réserve ma place",
      "Rejoindre l'événement",
      "Sauvegarder ma place",
      "M'inscrire maintenant",
    ],
    en: [
      "Register for free",
      "I save my spot",
      "Join the event",
      "Save my seat",
      "Register now",
    ],
    es: [
      "Registrarse gratis",
      "Guardo mi lugar",
      "Unirse al evento",
      "Guardar mi asiento",
      "Registrarme ahora",
    ],
  },
  formSubmitLabel: {
    fr: "Confirmer mon inscription",
    en: "Confirm my registration",
    es: "Confirmar mi registro",
  },
  postActionLabel: {
    fr: "Ajouter à mon calendrier",
    en: "Add to my calendar",
    es: "Añadir a mi calendario",
  },
  rules: {
    landing: { defaultIntent: "convert-primary" },
    "challenge-landing": { defaultIntent: "convert-primary" },
    registration: {
      defaultIntent: "form-scroll",
      bySection: { form: "form-submit" },
    },
    confirmation: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    thankyou: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    replay: {
    defaultIntent: "none",
    bySection: { cta: "post-action" },
    },
    live: { defaultIntent: "none" },
    "challenge-day": { defaultIntent: "none" },
  },
};

const DOWNLOAD_CONFIG: ArchetypeCTAConfig = {
  primaryVerb: { fr: "télécharger", en: "download", es: "descargar" },
  primaryLabels: {
    fr: [
      "Télécharger gratuitement",
      "Recevoir mon guide",
      "Obtenir l'accès gratuit",
      "Je télécharge maintenant",
      "Recevoir le PDF",
    ],
    en: [
      "Download for free",
      "Get my guide",
      "Get free access",
      "I download now",
      "Send me the PDF",
    ],
    es: [
      "Descargar gratis",
      "Recibir mi guía",
      "Obtener acceso gratuito",
      "Descargo ahora",
      "Enviarme el PDF",
    ],
  },
  formSubmitLabel: {
    fr: "Recevoir mon guide",
    en: "Send me the guide",
    es: "Enviarme la guía",
  },
  postActionLabel: {
    fr: "Vérifier ma boîte mail",
    en: "Check my inbox",
    es: "Revisar mi correo",
  },
  rules: {
    landing: { defaultIntent: "convert-primary" },
    optin: {
      defaultIntent: "form-scroll",
      bySection: { form: "form-submit" },
    },
    thankyou: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    delivery: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
  },
};

const POST_CONVERSION_CONFIG: ArchetypeCTAConfig = {
  primaryVerb: { fr: "merci", en: "thanks", es: "gracias" },
  primaryLabels: {
    fr: ["Retour à l'accueil"],
    en: ["Back to home"],
    es: ["Volver al inicio"],
  },
  formSubmitLabel: {
    fr: "Envoyer",
    en: "Submit",
    es: "Enviar",
  },
  postActionLabel: {
    fr: "Continuer",
    en: "Continue",
    es: "Continuar",
  },
  rules: {
    thankyou: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
    landing: {
      defaultIntent: "none",
      bySection: { cta: "post-action" },
    },
  },
};

/**
 * 🆕 Complète chaque archétype avec une règle « offer-primary » pour les rôles
 * qui vendent une offre propre à leur page (OFFER_ROLES), UNIQUEMENT quand
 * l'archétype n'en définit pas déjà une. Purement additif : aucune règle
 * existante n'est écrasée (la page `sales` de digital-product, par exemple,
 * garde son `convert-primary` vers la page de commande).
 *
 * Sans cette complétion, `resolveCTAIntent` retombait sur "convert-primary"
 * pour les rôles non couverts → label du tunnel + redirection vers la page de
 * capture, sur des pages qui vendent.
 */
function withOfferRoleDefaults(config: ArchetypeCTAConfig): ArchetypeCTAConfig {
  const rules = { ...config.rules };
  for (const role of OFFER_ROLES) {
    if (!rules[role]) rules[role] = { defaultIntent: "offer-primary" };
  }
  return { ...config, rules };
}

export const ARCHETYPE_CONFIGS: Record<CTAArchetype, ArchetypeCTAConfig> = {
  "booking": withOfferRoleDefaults(BOOKING_CONFIG),
  "purchase": withOfferRoleDefaults(PURCHASE_CONFIG),
  "registration": withOfferRoleDefaults(REGISTRATION_CONFIG),
  "download": withOfferRoleDefaults(DOWNLOAD_CONFIG),
  "post-conversion": withOfferRoleDefaults(POST_CONVERSION_CONFIG),
};

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne l'archétype CTA pour un FunnelKind donné.
 * Fallback sur "purchase" si le kind est inconnu (cas safe : action de conversion).
 */
export function getArchetype(funnelKind: FunnelKind | string | undefined): CTAArchetype {
  if (!funnelKind) return "purchase";
  const mapped = (FUNNEL_KIND_TO_ARCHETYPE as Record<string, CTAArchetype>)[funnelKind];
  return mapped ?? "purchase";
}

/**
 * Retourne la configuration CTA complète pour un FunnelKind donné.
 */
export function getCTAConfig(funnelKind: FunnelKind | string | undefined): ArchetypeCTAConfig {
  return ARCHETYPE_CONFIGS[getArchetype(funnelKind)];
}

/**
 * Résout l'intention CTA pour une section donnée (rôle de page + type de section).
 */
export function resolveCTAIntent(
  config: ArchetypeCTAConfig,
  pageRole: PageRole,
  sectionType: string,
): CTAIntent {
  const pageRule = config.rules[pageRole];
  if (!pageRule) {
    // Page non couverte par l'archétype : on suppose une logique de conversion
    return "convert-primary";
  }
  return pageRule.bySection?.[sectionType] ?? pageRule.defaultIntent;
}
