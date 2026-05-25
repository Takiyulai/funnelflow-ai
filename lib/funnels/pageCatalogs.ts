// lib/funnels/pageCatalogs.ts
import type {
  FunnelKind,
  FunnelSectionType,
  Language,
  PageRole,
} from "@/lib/funnels/types";
import { normalizeFunnelKind } from "@/lib/funnels/kinds";

// ─────────────────────────────────────────────────────────────────────────────
// PageBlueprint — squelette d'une page d'un tunnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blueprint = définition d'une page standard pour un FunnelKind donné.
 *
 * - `slug` : segment URL relatif AU TUNNEL.
 *   ⚠️ Convention :
 *     - Page d'accueil (isHome=true) → "/"
 *     - Autres pages → segment SANS slash initial (ex: "merci", "acces").
 *   Cela évite tout double slash dans /tunnel/<funnelSlug>/<pageSlug>.
 */
export type PageBlueprint = {
  role: PageRole;
  slug: string;
  name: { fr: string; en: string; es: string };
  isHome: boolean;
  description: { fr: string; en: string; es: string };
  defaultSectionTypes: FunnelSectionType[];
  nextLabel?: { fr: string; en: string; es: string };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de traduction interne
// ─────────────────────────────────────────────────────────────────────────────

export function blueprintName(bp: PageBlueprint, lang: Language): string {
  return bp.name[lang] ?? bp.name.fr;
}

export function blueprintDescription(bp: PageBlueprint, lang: Language): string {
  return bp.description[lang] ?? bp.description.fr;
}

export function blueprintNextLabel(bp: PageBlueprint, lang: Language): string {
  return bp.nextLabel?.[lang] ?? bp.nextLabel?.fr ?? "Suivant";
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogues par FunnelKind
// ─────────────────────────────────────────────────────────────────────────────

const NEXT_LABEL_DEFAULT = {
  fr: "Continuer",
  en: "Continue",
  es: "Continuar",
};

const NEXT_LABEL_ACCESS = {
  fr: "Accéder à ma ressource",
  en: "Access my resource",
  es: "Acceder a mi recurso",
};

const NEXT_LABEL_CHECKOUT = {
  fr: "Passer au paiement",
  en: "Go to checkout",
  es: "Ir al pago",
};

const NEXT_LABEL_BOOKING = {
  fr: "Réserver mon créneau",
  en: "Book my slot",
  es: "Reservar mi cita",
};

// ─────────────────────────────────────────────────────────────────────────────
// Lead Magnet : optin → thankyou → delivery
// ─────────────────────────────────────────────────────────────────────────────
const LEAD_MAGNET_PAGES: PageBlueprint[] = [
  {
    role: "optin",
    slug: "/",
    name: { fr: "Page d'inscription", en: "Opt-in page", es: "Página de inscripción" },
    isHome: true,
    description: {
      fr: "Page de capture du lead magnet : présenter la ressource gratuite, ses bénéfices et capter l'email.",
      en: "Lead magnet capture page: present the free resource, its benefits and capture the email.",
      es: "Página de captura del lead magnet: presentar el recurso gratuito, sus beneficios y capturar el email.",
    },
    defaultSectionTypes: ["hero", "benefits", "proof", "form", "faq"],
    nextLabel: { fr: "Recevoir ma ressource", en: "Get my resource", es: "Recibir mi recurso" },
  },
  {
    role: "thankyou",
    slug: "merci",
    name: { fr: "Page de remerciement", en: "Thank-you page", es: "Página de agradecimiento" },
    isHome: false,
    description: {
      fr: "Page de confirmation après inscription au lead magnet GRATUIT par email. La ressource est ENVOYÉE PAR EMAIL, jamais téléchargée ici. Rassurer, expliquer de vérifier la boîte mail (et les spams), et proposer de patienter / explorer la marque.",
      en: "Confirmation page after sign-up to the FREE email lead magnet. The resource is SENT BY EMAIL, never downloaded here. Reassure, explain to check the inbox (and spam folder), invite to explore the brand.",
      es: "Página de confirmación tras la inscripción al lead magnet GRATUITO por email. El recurso se ENVÍA POR EMAIL, nunca se descarga aquí. Tranquilizar, explicar revisar la bandeja (y spam), invitar a explorar la marca.",
    },
    defaultSectionTypes: ["hero", "benefits", "cta"],
    nextLabel: NEXT_LABEL_ACCESS,
  },
  {
    role: "delivery",
    slug: "acces",
    name: { fr: "Page d'accès", en: "Access page", es: "Página de acceso" },
    isHome: false,
    description: {
      fr: "Page de livraison DIRECTE de la ressource : c'est ICI que le téléchargement réel a lieu. Lien/bouton de téléchargement clair, instructions, puis invitation à découvrir l'offre payante.",
      en: "DIRECT resource delivery page: this is WHERE the actual download happens. Clear download link/button, instructions, then invitation to discover the paid offer.",
      es: "Página de entrega DIRECTA del recurso: AQUÍ ocurre la descarga real. Enlace/botón de descarga claro, instrucciones, luego invitación a descubrir la oferta de pago.",
    },
    defaultSectionTypes: ["hero", "benefits", "offer", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Digital Product : sales → checkout → thankyou
// ─────────────────────────────────────────────────────────────────────────────
const DIGITAL_PRODUCT_PAGES: PageBlueprint[] = [
  {
    role: "sales",
    slug: "/",
    name: { fr: "Page de vente", en: "Sales page", es: "Página de ventas" },
    isHome: true,
    description: {
      fr: "Page de vente principale : promesse forte, problème, solution, bénéfices, preuve sociale, offre, garantie et CTA d'achat.",
      en: "Main sales page: strong promise, problem, solution, benefits, social proof, offer, guarantee and purchase CTA.",
      es: "Página de venta principal: promesa fuerte, problema, solución, beneficios, prueba social, oferta, garantía y CTA de compra.",
    },
    defaultSectionTypes: [
      "hero",
      "problem",
      "solution",
      "benefits",
      "proof",
      "offer",
      "bonus",
      "guarantee",
      "faq",
      "cta",
    ],
    nextLabel: NEXT_LABEL_CHECKOUT,
  },
  {
    role: "checkout",
    slug: "commande",
    name: { fr: "Page de commande", en: "Checkout page", es: "Página de pago" },
    isHome: false,
    description: {
      fr: "Page de paiement : rappeler l'offre, rassurer (garantie, sécurité), afficher le formulaire de commande.",
      en: "Checkout page: recap the offer, reassure (guarantee, security), display the order form.",
      es: "Página de pago: recordar la oferta, tranquilizar (garantía, seguridad), mostrar el formulario de pedido.",
    },
    defaultSectionTypes: ["hero", "offer", "guarantee", "form"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
  {
    role: "thankyou",
    slug: "merci",
    name: { fr: "Page de confirmation", en: "Confirmation page", es: "Página de confirmación" },
    isHome: false,
    description: {
      fr: "Page de remerciement après ACHAT : confirmation de commande, prochaines étapes, accès au produit (lien direct ou instructions).",
      en: "Thank-you page after PURCHASE: order confirmation, next steps, product access (direct link or instructions).",
      es: "Página de agradecimiento tras la COMPRA: confirmación de pedido, próximos pasos, acceso al producto (enlace directo o instrucciones).",
    },
    defaultSectionTypes: ["hero", "benefits", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Webinar : registration → confirmation → replay
// ─────────────────────────────────────────────────────────────────────────────
const WEBINAR_PAGES: PageBlueprint[] = [
  {
    role: "registration",
    slug: "/",
    name: { fr: "Page d'inscription", en: "Registration page", es: "Página de inscripción" },
    isHome: true,
    description: {
      fr: "Page d'inscription au webinaire : sujet, date, intervenant, bénéfices clés et formulaire d'inscription.",
      en: "Webinar registration page: topic, date, speaker, key benefits and registration form.",
      es: "Página de inscripción al webinar: tema, fecha, ponente, beneficios clave y formulario de inscripción.",
    },
    defaultSectionTypes: ["hero", "webinar", "benefits", "proof", "form", "faq"],
    nextLabel: { fr: "Réserver ma place", en: "Reserve my seat", es: "Reservar mi plaza" },
  },
  {
    role: "confirmation",
    slug: "confirmation",
    name: { fr: "Page de confirmation", en: "Confirmation page", es: "Página de confirmación" },
    isHome: false,
    description: {
      fr: "Page de confirmation d'inscription : rappel date/heure, ajouter au calendrier, instructions pour rejoindre.",
      en: "Registration confirmation page: date/time reminder, add to calendar, instructions to join.",
      es: "Página de confirmación de inscripción: recordatorio fecha/hora, añadir al calendario, instrucciones para unirse.",
    },
    defaultSectionTypes: ["hero", "benefits", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
  {
    role: "replay",
    slug: "replay",
    name: { fr: "Page de replay", en: "Replay page", es: "Página de replay" },
    isHome: false,
    description: {
      fr: "Page de replay du webinaire : vidéo intégrée, résumé des points clés, CTA vers l'offre.",
      en: "Webinar replay page: embedded video, key points summary, CTA to the offer.",
      es: "Página de replay del webinar: video integrado, resumen de puntos clave, CTA hacia la oferta.",
    },
    defaultSectionTypes: ["hero", "video", "benefits", "offer", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Booking : landing → booking → confirmation
// ─────────────────────────────────────────────────────────────────────────────
const BOOKING_PAGES: PageBlueprint[] = [
  {
    role: "landing",
    slug: "/",
    name: { fr: "Page d'accueil", en: "Landing page", es: "Página de inicio" },
    isHome: true,
    description: {
      fr: "Page d'accueil pour prise de rendez-vous : promesse claire, bénéfices d'un appel découverte, preuve sociale, CTA vers la réservation.",
      en: "Booking landing page: clear promise, benefits of a discovery call, social proof, CTA to booking.",
      es: "Página de inicio para reserva: promesa clara, beneficios de una llamada de descubrimiento, prueba social, CTA hacia la reserva.",
    },
    defaultSectionTypes: ["hero", "benefits", "proof", "process", "faq", "cta"],
    nextLabel: NEXT_LABEL_BOOKING,
  },
  {
    role: "booking",
    slug: "reservation",
    name: { fr: "Page de réservation", en: "Booking page", es: "Página de reserva" },
    isHome: false,
    description: {
      fr: "Page de réservation : intégration calendrier (Calendly, Cal.com, etc.), rappel de ce qui sera abordé pendant l'appel.",
      en: "Booking page: calendar integration (Calendly, Cal.com, etc.), recap of what will be covered during the call.",
      es: "Página de reserva: integración de calendario (Calendly, Cal.com, etc.), recordatorio de lo que se tratará durante la llamada.",
    },
    defaultSectionTypes: ["hero", "benefits", "form"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
  {
    role: "confirmation",
    slug: "confirmation",
    name: { fr: "Page de confirmation", en: "Confirmation page", es: "Página de confirmación" },
    isHome: false,
    description: {
      fr: "Page de confirmation après réservation : rappel date/heure, préparation au call, contact.",
      en: "Confirmation page after booking: date/time reminder, call preparation, contact.",
      es: "Página de confirmación tras reserva: recordatorio fecha/hora, preparación a la llamada, contacto.",
    },
    defaultSectionTypes: ["hero", "benefits", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Coaching High Ticket
// ─────────────────────────────────────────────────────────────────────────────
const COACHING_HIGH_TICKET_PAGES: PageBlueprint[] = [
  {
    role: "landing",
    slug: "/",
    name: { fr: "Page d'accueil", en: "Landing page", es: "Página de inicio" },
    isHome: true,
    description: {
      fr: "Page d'accueil coaching premium : positionnement haut de gamme, qui c'est pour, qui c'est pas pour, autorité.",
      en: "Premium coaching landing page: high-end positioning, who it's for, who it's not for, authority.",
      es: "Página de inicio coaching premium: posicionamiento de alta gama, para quién es, para quién no, autoridad.",
    },
    defaultSectionTypes: ["hero", "about", "problem", "solution", "proof", "qualification", "faq", "cta"],
    nextLabel: { fr: "Voir des cas clients", en: "See case studies", es: "Ver casos de éxito" },
  },
  {
    role: "case-studies",
    slug: "cas-clients",
    name: { fr: "Études de cas", en: "Case studies", es: "Casos de éxito" },
    isHome: false,
    description: {
      fr: "Page d'études de cas détaillées : transformations clients chiffrées, témoignages premium, mécanique de l'accompagnement.",
      en: "Detailed case studies page: quantified client transformations, premium testimonials, coaching mechanics.",
      es: "Página de casos de éxito detallados: transformaciones cuantificadas, testimonios premium, mecánica del coaching.",
    },
    defaultSectionTypes: ["hero", "testimonials", "proof", "benefits", "cta"],
    nextLabel: { fr: "Candidater à l'accompagnement", en: "Apply for coaching", es: "Aplicar al coaching" },
  },
  {
    role: "application",
    slug: "candidature",
    name: { fr: "Page de candidature", en: "Application page", es: "Página de aplicación" },
    isHome: false,
    description: {
      fr: "Page de qualification / candidature : formulaire détaillé pour qualifier le prospect avant l'appel.",
      en: "Qualification / application page: detailed form to qualify the prospect before the call.",
      es: "Página de calificación / aplicación: formulario detallado para calificar al prospecto antes de la llamada.",
    },
    defaultSectionTypes: ["hero", "qualification", "form"],
    nextLabel: NEXT_LABEL_BOOKING,
  },
  {
    role: "booking",
    slug: "reservation",
    name: { fr: "Page de réservation", en: "Booking page", es: "Página de reserva" },
    isHome: false,
    description: {
      fr: "Page de réservation de l'appel stratégique : intégration calendrier, rappel des bénéfices de l'appel.",
      en: "Strategic call booking page: calendar integration, recap of call benefits.",
      es: "Página de reserva de la llamada estratégica: integración de calendario, recordatorio de los beneficios.",
    },
    defaultSectionTypes: ["hero", "benefits", "form"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
  {
    role: "confirmation",
    slug: "confirmation",
    name: { fr: "Page de confirmation", en: "Confirmation page", es: "Página de confirmación" },
    isHome: false,
    description: {
      fr: "Page de confirmation après réservation de l'appel : préparation, contact, rappel.",
      en: "Confirmation page after call booking: preparation, contact, reminder.",
      es: "Página de confirmación tras reserva de la llamada: preparación, contacto, recordatorio.",
    },
    defaultSectionTypes: ["hero", "benefits", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Challenge
// ─────────────────────────────────────────────────────────────────────────────
const CHALLENGE_PAGES: PageBlueprint[] = [
  {
    role: "challenge-landing",
    slug: "/",
    name: { fr: "Page d'inscription", en: "Challenge landing", es: "Página de inscripción" },
    isHome: true,
    description: {
      fr: "Page d'inscription au challenge : promesse de transformation sur X jours, programme, bénéfices, urgence, formulaire.",
      en: "Challenge sign-up page: X-day transformation promise, program, benefits, urgency, form.",
      es: "Página de inscripción al reto: promesa de transformación en X días, programa, beneficios, urgencia, formulario.",
    },
    defaultSectionTypes: ["hero", "benefits", "process", "proof", "form", "faq"],
    nextLabel: { fr: "Je participe au challenge", en: "I join the challenge", es: "Participo en el reto" },
  },
  {
    role: "confirmation",
    slug: "confirmation",
    name: { fr: "Page de confirmation", en: "Confirmation page", es: "Página de confirmación" },
    isHome: false,
    description: {
      fr: "Page de confirmation d'inscription au challenge : date de démarrage, ce qui va se passer, inviter à rejoindre la communauté.",
      en: "Challenge sign-up confirmation page: start date, what will happen, invite to join the community.",
      es: "Página de confirmación de inscripción al reto: fecha de inicio, qué pasará, invitar a unirse a la comunidad.",
    },
    defaultSectionTypes: ["hero", "benefits", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
  {
    role: "challenge-day",
    slug: "jour-1",
    name: { fr: "Jour 1 du challenge", en: "Challenge day 1", es: "Día 1 del reto" },
    isHome: false,
    description: {
      fr: "Page du jour 1 du challenge : vidéo / contenu du jour, exercices à faire, CTA vers jour suivant ou offre.",
      en: "Challenge day 1 page: video / content of the day, exercises to do, CTA to next day or offer.",
      es: "Página del día 1 del reto: video / contenido del día, ejercicios a realizar, CTA al día siguiente o a la oferta.",
    },
    defaultSectionTypes: ["hero", "video", "benefits", "cta"],
    nextLabel: NEXT_LABEL_DEFAULT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mapping FunnelKind → PageBlueprint[]
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG: Record<string, PageBlueprint[]> = {
  "lead-magnet": LEAD_MAGNET_PAGES,
  "digital-product": DIGITAL_PRODUCT_PAGES,
  "webinar": WEBINAR_PAGES,
  "booking": BOOKING_PAGES,
  "coaching-high-ticket": COACHING_HIGH_TICKET_PAGES,
  "challenge": CHALLENGE_PAGES,
};

export function getDefaultPagesForKind(
  kind?: FunnelKind | string
): PageBlueprint[] {
  if (!kind) return [];
  const normalized = normalizeFunnelKind(kind as FunnelKind);
  if (!normalized) return [];
  return CATALOG[normalized] ?? [];
}

export function getBlueprintForRole(
  kind: FunnelKind | string | undefined,
  role: PageRole
): PageBlueprint | undefined {
  const pages = getDefaultPagesForKind(kind);
  return pages.find((p) => p.role === role);
}

export function getHomeBlueprint(
  kind?: FunnelKind | string
): PageBlueprint | undefined {
  const pages = getDefaultPagesForKind(kind);
  return pages.find((p) => p.isHome) ?? pages[0];
}
