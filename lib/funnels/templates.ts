import type { FunnelTemplate } from "./types";

export const funnelTemplates: FunnelTemplate[] = [
  {
    id: "ebook-lead-magnet",
    name: "Ebook gratuit lead magnet",
    objective: "Capturer des emails avec une ressource gratuite claire et utile.",
    audience: "Créateurs, consultants, freelances",
    badge: "Lead magnet",
    sections: ["hero", "problem", "benefits", "form", "proof", "faq", "thank_you"]
  },
  {
    id: "premium-ebook",
    name: "Vente ebook premium",
    objective: "Vendre un ebook payant avec preuve, bonus et garantie.",
    audience: "Infopreneurs, auteurs, experts",
    badge: "Produit digital",
    sections: ["hero", "problem", "solution", "benefits", "bonus", "proof", "pricing", "guarantee", "cta"]
  },
  {
    id: "ebook-creation-service",
    name: "Service de création d’ebook",
    objective: "Vendre un service de création d’ebook clé en main.",
    audience: "Prestataires et agences",
    badge: "Service",
    sections: ["hero", "problem", "process", "offer", "proof", "pricing", "faq", "cta"]
  },
  {
    id: "digital-product-coaching",
    name: "Coaching création produit digital",
    objective: "Convertir vers un accompagnement ou appel découverte.",
    audience: "Coaches, consultants, formateurs",
    badge: "Coaching",
    sections: ["hero", "proof", "solution", "process", "benefits", "cta", "faq"]
  },
  {
    id: "digital-course",
    name: "Formation digitale",
    objective: "Vendre une formation avec programme, modules et bonus.",
    audience: "Formateurs et écoles en ligne",
    badge: "Formation",
    sections: ["hero", "problem", "program", "benefits", "bonus", "guarantee", "pricing", "cta"]
  },
  {
    id: "webinar",
    name: "Webinaire",
    objective: "Obtenir des inscriptions à une session live ou automatisée.",
    audience: "Experts et équipes marketing",
    badge: "Webinaire",
    sections: ["hero", "webinar", "benefits", "form", "proof", "faq"]
  },
  {
    id: "free-consultation",
    name: "Consultation gratuite",
    objective: "Déclencher une prise de rendez-vous qualifiée.",
    audience: "Consultants, freelances, agences",
    badge: "Rendez-vous",
    sections: ["hero", "problem", "benefits", "cta", "proof", "faq"]
  },
  {
    id: "high-ticket-service",
    name: "High-ticket service",
    objective: "Qualifier avant appel pour une offre premium.",
    audience: "Agences, closers, consultants premium",
    badge: "High ticket",
    sections: ["hero", "problem", "solution", "proof", "process", "qualification", "cta"]
  }
];
