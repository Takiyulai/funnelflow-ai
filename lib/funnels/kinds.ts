// lib/funnels/kinds.ts
import type { FunnelKind } from "./types";

export type FunnelKindOption = {
  id: FunnelKind;
  label: { fr: string; en: string; es: string };
  hint: { fr: string; en: string; es: string };
  /** Émotion dominante affichée dans le wizard (Lot B1+) */
  emotion?: { fr: string; en: string; es: string };
  // Si true, l'étape Vidéo est proposée dans le wizard
  needsVideo: boolean;
  // Suggestion de template par défaut (id de funnelTemplates)
  suggestedTemplateId?: string;
};

/**
 * 6 types de tunnels exposés dans le wizard (Lot B1).
 * Les anciennes valeurs (vsl, formation, service, saas, thank-you) restent
 * supportées en lecture (rétrocompat) mais ne sont plus proposées à l'utilisateur.
 */
export const FUNNEL_KINDS: FunnelKindOption[] = [
  {
    id: "lead-magnet",
    label: { fr: "Lead magnet", en: "Lead magnet", es: "Lead magnet" },
    hint: {
      fr: "Capturer des emails avec une ressource gratuite (ebook, checklist, template)",
      en: "Capture emails with a free resource (ebook, checklist, template)",
      es: "Capturar emails con un recurso gratuito (ebook, checklist, plantilla)",
    },
    emotion: { fr: "Confiance, clarté", en: "Trust, clarity", es: "Confianza, claridad" },
    needsVideo: false,
    suggestedTemplateId: "ebook-lead-magnet",
  },
  {
    id: "digital-product",
    label: { fr: "Vente produit digital", en: "Digital product sale", es: "Venta producto digital" },
    hint: {
      fr: "Vendre ebook, formation, template, ressource premium",
      en: "Sell ebook, course, template, premium resource",
      es: "Vender ebook, formación, plantilla, recurso premium",
    },
    emotion: { fr: "Valeur, transformation", en: "Value, transformation", es: "Valor, transformación" },
    needsVideo: true,
    suggestedTemplateId: "premium-ebook",
  },
  {
    id: "webinar",
    label: { fr: "Webinaire / Masterclass", en: "Webinar / Masterclass", es: "Webinar / Masterclass" },
    hint: {
      fr: "Inscriptions à une session live ou automatisée",
      en: "Sign-ups for a live or automated session",
      es: "Inscripciones a una sesión en vivo o automatizada",
    },
    emotion: { fr: "Crédibilité, anticipation", en: "Credibility, anticipation", es: "Credibilidad, anticipación" },
    needsVideo: true,
    suggestedTemplateId: "webinar",
  },
  {
    id: "booking",
    label: { fr: "Prise de rendez-vous", en: "Booking", es: "Reserva de cita" },
    hint: {
      fr: "Réserver un appel découverte ou une consultation (agences, freelances, consultants)",
      en: "Book a discovery call or consultation (agencies, freelancers, consultants)",
      es: "Reservar una llamada o consulta (agencias, freelancers, consultores)",
    },
    emotion: { fr: "Autorité, simplicité", en: "Authority, simplicity", es: "Autoridad, simplicidad" },
    needsVideo: false,
    suggestedTemplateId: "free-consultation",
  },
  {
    id: "coaching-high-ticket",
    label: { fr: "Coaching high ticket", en: "High-ticket coaching", es: "Coaching high ticket" },
    hint: {
      fr: "Vendre un accompagnement premium avec qualification (statut, exclusivité)",
      en: "Sell premium coaching with qualification (status, exclusivity)",
      es: "Vender acompañamiento premium con calificación (estatus, exclusividad)",
    },
    emotion: { fr: "Statut, exclusivité", en: "Status, exclusivity", es: "Estatus, exclusividad" },
    needsVideo: false,
    suggestedTemplateId: "coaching-premium",
  },
  {
    id: "challenge",
    label: { fr: "Challenge / Bootcamp", en: "Challenge / Bootcamp", es: "Reto / Bootcamp" },
    hint: {
      fr: "Lancer un défi sur plusieurs jours (fitness, business, productivité)",
      en: "Launch a multi-day challenge (fitness, business, productivity)",
      es: "Lanzar un reto de varios días (fitness, negocio, productividad)",
    },
    emotion: { fr: "Énergie, urgence, momentum", en: "Energy, urgency, momentum", es: "Energía, urgencia, momento" },
    needsVideo: true,
    suggestedTemplateId: "ebook-lead-magnet",
  },
];

/**
 * Mapping legacy : convertit les anciens FunnelKind vers les 6 nouveaux.
 * Utilisé au chargement pour normaliser les funnels stockés en localStorage.
 */
const LEGACY_KIND_MAP: Partial<Record<FunnelKind, FunnelKind>> = {
  vsl: "digital-product",
  formation: "digital-product",
  service: "booking",
  saas: "digital-product",
  "thank-you": "lead-magnet",
};

/**
 * Normalise un FunnelKind legacy vers un kind moderne.
 * Retourne le kind tel quel si déjà moderne ou inconnu.
 */
export function normalizeFunnelKind(kind?: FunnelKind | string): FunnelKind | undefined {
  if (!kind) return undefined;
  const k = kind as FunnelKind;
  if (LEGACY_KIND_MAP[k]) return LEGACY_KIND_MAP[k]!;
  return k;
}

/**
 * Retourne l'option FunnelKindOption correspondant à un id.
 * Applique automatiquement la normalisation legacy.
 */
export function getFunnelKind(id?: FunnelKind | string): FunnelKindOption | undefined {
  if (!id) return undefined;
  const normalized = normalizeFunnelKind(id);
  return FUNNEL_KINDS.find((k) => k.id === normalized);
}
