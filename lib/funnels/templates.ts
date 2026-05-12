// lib/funnels/templates.ts
import type {
  FunnelTemplate,
  TemplateDefinition,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Anciens templates simples (rétrocompatibilité)
// ─────────────────────────────────────────────────────────────────────────────
export const funnelTemplates: FunnelTemplate[] = [
  {
    id: "ebook-lead-magnet",
    name: "Ebook gratuit lead magnet",
    objective: "Capturer des emails avec une ressource gratuite claire et utile",
    audience: "Créateurs, consultants, freelances",
    badge: "Lead magnet",
    sections: ["hero", "problem", "benefits", "form", "proof", "faq", "thank_you"],
  },
  {
    id: "premium-ebook",
    name: "Vente ebook premium",
    objective: "Vendre un ebook payant avec preuve, bonus et garantie",
    audience: "Infopreneurs, auteurs, experts",
    badge: "Produit digital",
    sections: ["hero", "problem", "solution", "benefits", "bonus", "proof", "pricing", "guarantee", "cta"],
  },
  {
    id: "ebook-creation-service",
    name: "Service de création d'ebook",
    objective: "Vendre un service de création d'ebook clé en main",
    audience: "Prestataires et agences",
    badge: "Service",
    sections: ["hero", "problem", "process", "offer", "proof", "pricing", "faq", "cta"],
  },
  {
    id: "digital-product-coaching",
    name: "Coaching création produit digital",
    objective: "Convertir vers un accompagnement ou un appel découverte",
    audience: "Coaches, consultants, formateurs",
    badge: "Coaching",
    sections: ["hero", "proof", "solution", "process", "benefits", "cta", "faq"],
  },
  {
    id: "digital-course",
    name: "Formation digitale",
    objective: "Vendre une formation avec programme, modules et bonus",
    audience: "Formateurs et écoles en ligne",
    badge: "Formation",
    sections: ["hero", "problem", "program", "benefits", "bonus", "guarantee", "pricing", "cta"],
  },
  {
    id: "webinar",
    name: "Webinaire",
    objective: "Obtenir des inscriptions à une session live ou automatisée",
    audience: "Experts et équipes marketing",
    badge: "Webinaire",
    sections: ["hero", "webinar", "benefits", "form", "proof", "faq"],
  },
  {
    id: "free-consultation",
    name: "Consultation gratuite",
    objective: "Déclencher une prise de rendez-vous qualifiée",
    audience: "Consultants, freelances, agences",
    badge: "Rendez-vous",
    sections: ["hero", "problem", "benefits", "cta", "proof", "faq"],
  },
  {
    id: "high-ticket-service",
    name: "High-ticket service",
    objective: "Qualifier avant appel pour une offre premium",
    audience: "Agences, closers, consultants premium",
    badge: "High ticket",
    sections: ["hero", "problem", "solution", "proof", "process", "qualification", "cta"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Templates premium (Phase B)
// ─────────────────────────────────────────────────────────────────────────────
export const PREMIUM_TEMPLATES: TemplateDefinition[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 0a. Clean Light — fond neutre clair, 100% personnalisable
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "clean-light",
    name: "Clean Light",
    personality: {
      fr: "Fond clair neutre et épuré, dont chaque couleur peut être modifiée librement après génération",
      en: "Neutral light background, fully customizable after generation",
      es: "Fondo claro neutro, totalmente personalizable después de la generación",
    },
    bestFor: ["service", "lead-magnet", "digital-product", "saas", "booking"],
    defaultMoodId: "institutional-trust",
    badge: "Fond personnalisable",
    previewColors: ["#FAFAF9", "#2563EB", "#18181B"],
    customizable: true,
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "fade-up" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: {
      headlineScale: "md",
      headlineWeight: 700,
      headlineTracking: "tight",
      headlineFamily: "sans",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 0b. Clean Dark — fond neutre sombre, 100% personnalisable
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "clean-dark",
    name: "Clean Dark",
    personality: {
      fr: "Fond sombre neutre et moderne, dont chaque couleur peut être modifiée librement après génération",
      en: "Neutral dark background, fully customizable after generation",
      es: "Fondo oscuro neutro, totalmente personalizable después de la generación",
    },
    bestFor: ["digital-product", "saas", "service", "vsl"],
    defaultMoodId: "energetic",
    badge: "Fond personnalisable",
    previewColors: ["#18181B", "#10B981", "#FAFAFA"],
    customizable: true,
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "fade-up" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: {
      headlineScale: "md",
      headlineWeight: 700,
      headlineTracking: "tight",
      headlineFamily: "sans",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Sharp Launch
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "sharp-launch",
    name: "Sharp Launch",
    personality: {
      fr: "Direct et orienté action, pour offres claires à prix fixe qui veulent convertir vite",
      en: "Direct and action-driven, for clear offers at fixed price that want to convert fast",
      es: "Directo y orientado a la acción, para ofertas claras a precio fijo que quieren convertir rápido",
    },
    bestFor: ["digital-product", "lead-magnet", "service"],
    defaultMoodId: "energetic",
    badge: "Punchy",
    previewColors: ["#05080A", "#22D3EE", "#F1F5F9"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "wide-banner",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "zoom-in" },
      },
      {
        type: "problem", id: "problem", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "zap",
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "pulse" },
      },
      {
        type: "guarantee", id: "guarantee", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "zoom-in" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
      { when: { sectionMissing: "bullets" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "stagger",
    density: "balanced",
    decor: { style: "halo", intensity: "medium" },
    typography: {
      headlineScale: "md",
      headlineWeight: 700,
      headlineTracking: "tight",
      headlineFamily: "sans",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Story Sell
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "story-sell",
    name: "Story Sell",
    personality: {
      fr: "Narratif et pédagogique, idéal pour VSL et formations qui demandent de la profondeur",
      en: "Narrative and educational, ideal for VSLs and courses that require depth",
      es: "Narrativo y pedagógico, ideal para VSLs y formaciones que requieren profundidad",
    },
    bestFor: ["vsl", "formation", "webinar"],
    defaultMoodId: "premium-calm",
    badge: "Story",
    previewColors: ["#0F0805", "#D4AF37", "#F5EFE6"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "video", id: "video", required: false,
        includeIf: { has: "video" },
        layoutVariant: "wide-banner",
        animations: { headline: "fade-up", video: "zoom-in" },
      },
      {
        type: "about", id: "about", required: false,
        includeIf: { has: "about" },
        layoutVariant: "split-image-text",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up" },
      },
      {
        type: "problem", id: "problem", required: true,
        layoutVariant: "split-text-image",
        animations: { headline: "fade-up", body: "fade-up", bullets: "fade-up" },
      },
      {
        type: "solution", id: "solution", required: true,
        layoutVariant: "split-image-text",
        animations: { headline: "fade-up", body: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "sparkles",
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "thumbs-up",
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "zoom-in" },
      },
      {
        type: "bonus", id: "bonus", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "gift",
      },
      {
        type: "guarantee", id: "guarantee", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "faq", id: "faq", required: false,
        layoutVariant: "dense-list",
        animations: { headline: "fade-up", bullets: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "zoom-in" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
      { when: { sectionMissing: "video" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "blobs", intensity: "medium" },
    typography: {
      headlineScale: "lg",
      headlineWeight: 600,
      headlineTracking: "normal",
      headlineFamily: "serif",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Premium Minimal
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "premium-minimal",
    name: "Premium Minimal",
    personality: {
      fr: "Espace blanc généreux et typographie éditoriale, pour offres haut de gamme et marques sobres",
      en: "Generous white space and editorial typography, for high-end offers and sober brands",
      es: "Espacio en blanco generoso y tipografía editorial, para ofertas premium y marcas sobrias",
    },
    bestFor: ["service", "digital-product", "saas"],
    defaultMoodId: "premium-calm",
    badge: "Premium",
    previewColors: ["#1F0A12", "#E8C08A", "#FBF0F4"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "about", id: "about", required: false,
        includeIf: { has: "about" },
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "star",
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" },
      },
      {
        type: "guarantee", id: "guarantee", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "fade-up" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "uniform",
    density: "airy",
    decor: { style: "halo", intensity: "subtle" },
    typography: {
      headlineScale: "md",
      headlineWeight: 500,
      headlineTracking: "wide",
      headlineFamily: "serif",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Trust Pro
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "trust-pro",
    name: "Trust Pro",
    personality: {
      fr: "Ton institutionnel et rassurant, preuves sociales fortes, idéal pour B2B et services premium",
      en: "Institutional and reassuring tone, strong social proof, ideal for B2B and premium services",
      es: "Tono institucional y tranquilizador, pruebas sociales fuertes, ideal para B2B y servicios premium",
    },
    bestFor: ["service", "saas", "booking"],
    defaultMoodId: "institutional-trust",
    badge: "B2B",
    previewColors: ["#0B1E3D", "#06B6D4", "#E2E8F0"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "split-text-image",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", image: "fade-in", cta: "fade-up" },
      },
      {
        type: "proof", id: "proof", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "shield",
      },
      {
        type: "problem", id: "problem", required: true,
        layoutVariant: "split-text-image",
        animations: { headline: "fade-up", body: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "target",
      },
      {
        type: "solution", id: "solution", required: true,
        layoutVariant: "split-image-text",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "process", id: "process", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "settings",
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "qualification", id: "qualification", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up", bullets: "fade-up" },
      },
      {
        type: "cta", id: "cta", required: true,
        layoutVariant: "wide-banner",
        animations: { headline: "fade-up", cta: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "fade-up" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "gradient", intensity: "medium" },
    typography: {
      headlineScale: "md",
      headlineWeight: 600,
      headlineTracking: "normal",
      headlineFamily: "sans",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Bold Energy
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "bold-energy",
    name: "Bold Energy",
    personality: {
      fr: "Couleurs saturées et animations marquées, pour audiences jeunes, lifestyle et créateurs",
      en: "Saturated colors and bold animations, for young audiences, lifestyle and creators",
      es: "Colores saturados y animaciones marcadas, para audiencias jóvenes, lifestyle y creadores",
    },
    bestFor: ["digital-product", "formation", "webinar"],
    defaultMoodId: "creative-warm",
    badge: "Bold",
    previewColors: ["#1A0808", "#FF6B35", "#FFF5EE"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "wide-banner",
        animations: { eyebrow: "zoom-in", headline: "fade-up", subheadline: "fade-up", cta: "pulse" },
      },
      {
        type: "video", id: "video", required: false,
        includeIf: { has: "video" },
        layoutVariant: "wide-banner",
        animations: { headline: "fade-up", video: "zoom-in" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "zoom-in" },
        defaultBulletIcon: "rocket",
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "stacked-card",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "zoom-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "pulse" },
      },
      {
        type: "bonus", id: "bonus", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "zoom-in" },
        defaultBulletIcon: "gift",
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", cta: "pulse" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "wide-banner" },
      { when: { sectionMissing: "video" }, fallbackLayout: "wide-banner" },
    ],
    bulletAnimation: "stagger",
    density: "balanced",
    decor: { style: "blobs", intensity: "strong" },
    typography: {
      headlineScale: "md",
      headlineWeight: 800,
      headlineTracking: "tight",
      headlineFamily: "sans",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Lead Snap
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "lead-snap",
    name: "Lead Snap",
    personality: {
      fr: "Ultra-court et focalisé, une page faite pour capter un email contre un lead-magnet",
      en: "Ultra-short and focused, one page built to capture an email for a lead magnet",
      es: "Ultra-corto y enfocado, una página hecha para capturar un email a cambio de un lead magnet",
    },
    bestFor: ["lead-magnet", "thank-you"],
    defaultMoodId: "energetic",
    badge: "Snap",
    previewColors: ["#1A0F2E", "#C084FC", "#F3E8FF"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "split-text-image",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", image: "fade-in", cta: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "dense-list",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "stacked-card",
        animations: { headline: "fade-up", cta: "zoom-in" },
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "uniform",
    density: "dense",
    decor: { style: "halo", intensity: "subtle" },
    typography: {
      headlineScale: "sm",
      headlineWeight: 600,
      headlineTracking: "normal",
      headlineFamily: "sans",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'accès
// ─────────────────────────────────────────────────────────────────────────────
export function getPremiumTemplate(id?: string): TemplateDefinition | undefined {
  if (!id) return undefined;
  return PREMIUM_TEMPLATES.find((t) => t.id === id);
}

export function getRecommendedTemplates(funnelKind?: string): TemplateDefinition[] {
  if (!funnelKind) return PREMIUM_TEMPLATES;
  const recommended = PREMIUM_TEMPLATES.filter((t) =>
    t.bestFor.includes(funnelKind as never)
  );
  return recommended.length > 0 ? recommended : PREMIUM_TEMPLATES;
}

export const TEMPLATE_BUTTON_ANIMATION: Record<
  string,
  "lift" | "glow" | "pulse" | "shine"
> = {
  "clean-light": "lift",
  "clean-dark": "lift",
  "story-sell": "shine",
  "bold-energy": "pulse",
  "premium-minimal": "lift",
  "sharp-launch": "glow",
  "trust-pro": "lift",
  "lead-snap": "pulse",
};

export function getTemplateButtonAnim(
  templateId?: string
): "lift" | "glow" | "pulse" | "shine" {
  if (!templateId) return "lift";
  return TEMPLATE_BUTTON_ANIMATION[templateId] ?? "lift";
}

export const DEFAULT_PREMIUM_TEMPLATE_ID = "story-sell";
