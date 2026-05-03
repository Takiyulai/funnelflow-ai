// lib/funnels/kinds.ts
import type { FunnelKind } from "./types";

export type FunnelKindOption = {
  id: FunnelKind;
  label: { fr: string; en: string; es: string };
  hint: { fr: string; en: string; es: string };
  // Si true, l'étape Vidéo est proposée dans le wizard
  needsVideo: boolean;
  // Suggestion de template par défaut (id de funnelTemplates)
  suggestedTemplateId?: string;
};

export const FUNNEL_KINDS: FunnelKindOption[] = [
  {
    id: "lead-magnet",
    label: { fr: "Lead magnet", en: "Lead magnet", es: "Lead magnet" },
    hint: {
      fr: "Capturer des emails avec une ressource gratuite",
      en: "Capture emails with a free resource",
      es: "Capturar emails con un recurso gratuito",
    },
    needsVideo: false,
    suggestedTemplateId: "ebook-lead-magnet",
  },
  {
    id: "vsl",
    label: { fr: "Vidéo de vente (VSL)", en: "Video sales letter (VSL)", es: "Video de venta (VSL)" },
    hint: {
      fr: "Page centrée sur une vidéo de vente",
      en: "Page focused on a sales video",
      es: "Página centrada en un video de venta",
    },
    needsVideo: true,
    suggestedTemplateId: "premium-ebook",
  },
  {
    id: "webinar",
    label: { fr: "Webinaire", en: "Webinar", es: "Webinar" },
    hint: {
      fr: "Inscriptions à une session live ou automatisée",
      en: "Sign-ups for a live or automated session",
      es: "Inscripciones a una sesión en vivo o automatizada",
    },
    needsVideo: true,
    suggestedTemplateId: "webinar",
  },
  {
    id: "formation",
    label: { fr: "Formation", en: "Course", es: "Formación" },
    hint: {
      fr: "Vendre une formation avec programme et bonus",
      en: "Sell a course with curriculum and bonuses",
      es: "Vender una formación con programa y bonos",
    },
    needsVideo: false,
    suggestedTemplateId: "digital-course",
  },
  {
    id: "service",
    label: { fr: "Service", en: "Service", es: "Servicio" },
    hint: {
      fr: "Vendre une prestation avec preuve et process",
      en: "Sell a service with proof and process",
      es: "Vender un servicio con prueba y proceso",
    },
    needsVideo: false,
    suggestedTemplateId: "ebook-creation-service",
  },
  {
    id: "digital-product",
    label: { fr: "Produit digital", en: "Digital product", es: "Producto digital" },
    hint: {
      fr: "Vendre un ebook, un kit, un template",
      en: "Sell an ebook, kit or template",
      es: "Vender un ebook, kit o plantilla",
    },
    needsVideo: false,
    suggestedTemplateId: "premium-ebook",
  },
  {
    id: "booking",
    label: { fr: "Prise de rendez-vous", en: "Booking", es: "Cita" },
    hint: {
      fr: "Déclencher un appel ou une consultation",
      en: "Trigger a call or consultation",
      es: "Activar una llamada o consulta",
    },
    needsVideo: false,
    suggestedTemplateId: "free-consultation",
  },
  {
    id: "saas",
    label: { fr: "SaaS", en: "SaaS", es: "SaaS" },
    hint: {
      fr: "Présenter une application avec essai gratuit",
      en: "Showcase an app with a free trial",
      es: "Presentar una aplicación con prueba gratuita",
    },
    needsVideo: false,
    suggestedTemplateId: "high-ticket-service",
  },
  {
    id: "thank-you",
    label: { fr: "Page de remerciement", en: "Thank-you page", es: "Página de gracias" },
    hint: {
      fr: "Page d'arrivée après une conversion",
      en: "Landing page after a conversion",
      es: "Página de llegada después de una conversión",
    },
    needsVideo: false,
  },
];

export function getFunnelKind(id?: FunnelKind | string): FunnelKindOption | undefined {
  if (!id) return undefined;
  return FUNNEL_KINDS.find((k) => k.id === id);
}
