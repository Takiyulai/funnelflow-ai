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
    badge: "Personnalisable",
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
    name: "Clean Red",
    personality: {
      fr: "Noir profond traversé de boules de lumière rouges dans les coins, accent rouge vif : intense, premium et orienté conversion. Couleurs ajustables après génération.",
      en: "Deep black with red light orbs in the corners and a vivid red accent: intense, premium and conversion-driven. Colors adjustable after generation.",
      es: "Negro profundo con orbes de luz roja en las esquinas y acento rojo intenso: premium y orientado a la conversión. Colores ajustables.",
    },
    bestFor: ["digital-product", "saas", "service", "vsl"],
    defaultMoodId: "energetic",
    badge: "Rouge",
    previewColors: ["#120406", "#FF2E43", "#FAFAFA"],
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
        layoutVariant: "split-text-image",
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
    // 🆕 Direction A « Aurora Premium » : sombre profond + halos d'accent forts.
    decor: { style: "halo", intensity: "strong" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 800,
      headlineTracking: "tight",
      headlineFamily: "display",
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
        defaultBulletIcon: "thumbsUp",
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
  // 2b. Éditorial chaleureux (Direction B) — magazine premium, clair & tiède
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "editorial-warm",
    name: "Éditorial chaleureux",
    personality: {
      fr: "Magazine premium clair et tiède : titres serif Fraunces, palette crème/terracotta/vert profond, beaucoup d'air. Idéal coachs, freelances et formateurs.",
      en: "Warm, light editorial: Fraunces serif headings, cream/terracotta/deep-green palette, generous spacing. Great for coaches and creators.",
      es: "Editorial cálido y claro: títulos serif Fraunces, paleta crema/terracota/verde, mucho espacio. Ideal para coaches y creadores.",
    },
    bestFor: ["service", "digital-product", "coaching-high-ticket", "formation", "booking"],
    defaultMoodId: "creative-warm",
    badge: "Éditorial",
    previewColors: ["#FBF7F1", "#C2410C", "#2B1D16"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "about", id: "about", required: false,
        includeIf: { has: "about" },
        layoutVariant: "split-image-text",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", image: "fade-in" },
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
        defaultBulletIcon: "thumbsUp",
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" },
      },
      {
        type: "testimonials", id: "testimonials", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
      },
      {
        type: "faq", id: "faq", required: false,
        layoutVariant: "dense-list",
        animations: { headline: "fade-up", bullets: "fade-up" },
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
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "plain", intensity: "subtle" },
    typography: {
      headlineScale: "lg",
      headlineWeight: 500,
      headlineTracking: "normal",
      headlineFamily: "serif",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2c. Aurora Glow (nouveau) — SaaS lumineux, dégradés aurora, cartes vitrées
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "aurora-glow",
    name: "Aurora Glow",
    personality: {
      fr: "SaaS moderne et lumineux : dégradés aurora subtils (indigo/cyan/rose), cartes nettes, typo géométrique Space Grotesk. Rendu 2025 pour produits digitaux et SaaS.",
      en: "Bright modern SaaS: subtle aurora gradients, crisp cards, Space Grotesk geometric type. A 2025 look for digital products and SaaS.",
      es: "SaaS moderno y luminoso: degradados aurora sutiles, tarjetas nítidas, tipografía geométrica. Estética 2025 para productos digitales.",
    },
    bestFor: ["saas", "digital-product", "lead-magnet", "service"],
    defaultMoodId: "premium-calm",
    badge: "Aurora",
    previewColors: ["#F7F8FF", "#6D5DF6", "#0EA5E9"],
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
        defaultBulletIcon: "sparkles",
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" },
      },
      {
        type: "testimonials", id: "testimonials", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
      },
      {
        type: "faq", id: "faq", required: false,
        layoutVariant: "dense-list",
        animations: { headline: "fade-up", bullets: "fade-up" },
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
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "halo", intensity: "medium" },
    typography: {
      headlineScale: "lg",
      headlineWeight: 600,
      headlineTracking: "tight",
      headlineFamily: "sans",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2d. Émeraude (nouveau) — vert menthe lumineux, cartes blanches, rassurant
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "mint-fresh",
    name: "Émeraude",
    personality: {
      fr: "Frais et rassurant : vert menthe lumineux, cartes blanches nettes, typo douce arrondie. Idéal bien-être, coaching et services qui inspirent confiance.",
      en: "Fresh and reassuring: bright mint green, crisp white cards, soft rounded type. Great for wellness, coaching and trust-driven services.",
      es: "Fresco y tranquilizador: verde menta luminoso, tarjetas blancas, tipografía suave. Ideal para bienestar, coaching y servicios.",
    },
    bestFor: ["service", "coaching-high-ticket", "digital-product", "lead-magnet"],
    defaultMoodId: "creative-warm",
    badge: "Fraîcheur",
    previewColors: ["#0B3D2E", "#10B981", "#FFFFFF"],
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: true, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", body: "fade-up" } },
      { type: "offer", id: "offer", required: true, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "dense-list", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "form", id: "form", required: true, layoutVariant: "centered", animations: { headline: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "halo", intensity: "subtle" },
    typography: { headlineScale: "lg", headlineWeight: 600, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2e. Cosmos (nouveau) — indigo profond, glow violet, cartes verre sombre
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "cosmos-night",
    name: "Cosmos",
    personality: {
      fr: "Indigo profond traversé d'un glow violet/fuchsia, cartes verre sombre, typo géométrique. Premium et futuriste pour SaaS et produits tech.",
      en: "Deep indigo with violet/fuchsia glow, dark glass cards, geometric type. Premium and futuristic for SaaS and tech products.",
      es: "Índigo profundo con brillo violeta, tarjetas de vidrio oscuro, tipografía geométrica. Premium y futurista para SaaS.",
    },
    bestFor: ["saas", "digital-product", "service", "vsl"],
    defaultMoodId: "premium-calm",
    badge: "Cosmos",
    previewColors: ["#0A0E27", "#8B5CF6", "#E9D5FF"],
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: true, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "sparkles" },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", body: "fade-up" } },
      { type: "offer", id: "offer", required: true, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "dense-list", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "form", id: "form", required: true, layoutVariant: "centered", animations: { headline: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "stagger",
    density: "balanced",
    decor: { style: "halo", intensity: "medium" },
    typography: { headlineScale: "lg", headlineWeight: 600, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2f. Sunset (nouveau) — pêche chaleureux, dégradé corail→rose, engageant
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "sunset-coral",
    name: "Sunset",
    personality: {
      fr: "Pêche chaleureux et engageant, dégradé corail→rose sur les CTA, cartes blanches, typo ronde. Donne envie de cliquer — parfait pour offres grand public.",
      en: "Warm peach and engaging, coral→pink CTA gradient, white cards, rounded type. Makes people want to click — great for consumer offers.",
      es: "Melocotón cálido y atractivo, degradado coral→rosa en los CTA, tarjetas blancas. Invita a hacer clic — ideal para ofertas masivas.",
    },
    bestFor: ["digital-product", "lead-magnet", "service", "coaching-high-ticket"],
    defaultMoodId: "energetic",
    badge: "Sunset",
    previewColors: ["#7A2E1E", "#FB6F4C", "#FFFFFF"],
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: true, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", body: "fade-up" } },
      { type: "offer", id: "offer", required: true, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "dense-list", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "form", id: "form", required: true, layoutVariant: "centered", animations: { headline: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "halo", intensity: "subtle" },
    typography: { headlineScale: "lg", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2g. Brutalist (nouveau) — néo-brutaliste, bordures épaisses, ombres dures
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "neo-brutalist",
    name: "Brutalist",
    personality: {
      fr: "Néo-brutaliste assumé : crème, bordures noires épaisses, ombres dures décalées, blocs de couleur franche (jaune/menthe). Audacieux et mémorable.",
      en: "Bold neo-brutalist: cream, thick black borders, hard offset shadows, solid color blocks (yellow/mint). Daring and memorable.",
      es: "Neo-brutalista atrevido: crema, bordes negros gruesos, sombras duras, bloques de color sólido. Audaz y memorable.",
    },
    bestFor: ["digital-product", "lead-magnet", "saas", "service"],
    defaultMoodId: "energetic",
    badge: "Brut",
    previewColors: ["#14110A", "#FACC15", "#FFFFFF"],
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: true, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", body: "fade-up" } },
      { type: "offer", id: "offer", required: true, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "dense-list", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "form", id: "form", required: true, layoutVariant: "centered", animations: { headline: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "lg", headlineWeight: 800, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Premium Minimal — L'élégance à la Apple / Stripe
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "premium-minimal",
    name: "Elite Minimal",
    personality: {
      fr: "Inspiré par Apple et Stripe : blanc pur, typographie éditoriale Newsreader et espaces généreux.",
      en: "Apple & Stripe inspired: pure white, Newsreader editorial typography, and generous spacing.",
      es: "Inspirado en Apple y Stripe: blanco puro, tipografía editorial Newsreader y espacios generosos.",
    },
    bestFor: ["service", "digital-product", "saas", "booking"],
    defaultMoodId: "premium-calm",
    badge: "Elite",
    // 🆕 Direction B « Editorial Soft » : crème chaud, halos pastel doux.
    previewColors: ["#FBF8F2", "#0A0A0A", "#F1ECE2"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "split-text-image",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" },
      },
      {
        type: "testimonials", id: "testimonials", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
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
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "halo", intensity: "medium" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 400,
      headlineTracking: "tight",
      headlineFamily: "serif",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3b. Coaching Premium — L'exclusivité oklch
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "coaching-premium",
    name: "Luxe Ivoire",
    personality: {
      fr: "Luxe discret et clair : ivoire chaud, titres serif Cormorant, accents or fin, angles nets et beaucoup d'air. Positionnement haut de gamme et intemporel.",
      en: "Quiet light luxury: warm ivory, Cormorant serif, fine gold accents, sharp edges, lots of air. High-end and timeless.",
      es: "Lujo discreto y claro: marfil cálido, serif Cormorant, acentos dorados, ángulos nítidos y mucho espacio. Alta gama atemporal.",
    },
    bestFor: ["coaching-high-ticket", "service", "digital-product"],
    defaultMoodId: "premium-calm",
    badge: "Luxe",
    previewColors: ["#F6F1E7", "#9A7B3F", "#1C1A17"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "about", id: "about", required: false,
        includeIf: { has: "about" },
        layoutVariant: "split-text-image",
        animations: { headline: "fade-up", body: "fade-up", image: "zoom-in" },
      },
      {
        type: "process", id: "process", required: false,
        layoutVariant: "dense-list",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "crown",
      },
      {
        type: "proof", id: "proof", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
      },
      {
        type: "pricing", id: "pricing", required: true,
        layoutVariant: "centered",
        animations: { headline: "fade-up", bullets: "fade-up" },
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
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "gradient", intensity: "medium" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 500,
      headlineTracking: "tight",
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
    // 🆕 Direction C « Neo-Bold » : contraste brut, grille graphique, typo massive.
    decor: { style: "grid", intensity: "strong" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 900,
      headlineTracking: "tight",
      headlineFamily: "display",
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
    // 🆕 Polish « Dense » : on garde l'identité compacte/sombre, on renforce les
    // halos d'accent et l'impact typographique (premium sans casser l'usage).
    decor: { style: "halo", intensity: "strong" },
    typography: {
      headlineScale: "lg",
      headlineWeight: 700,
      headlineTracking: "tight",
      headlineFamily: "sans",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 NOUVEAUX TEMPLATES (validés) : VSL Focus, Webinar Live, Showcase
  // ═══════════════════════════════════════════════════════════════════════════

  // 7. VSL Focus — page centrée sur une vidéo de vente, minimale, conversion.
  {
    id: "vsl-focus",
    name: "VSL Focus",
    personality: {
      fr: "Page épurée centrée sur une vidéo de vente (VSL) : tout converge vers le visionnage puis le CTA. Sombre, sans distraction.",
      en: "Clean page centered on a sales video (VSL): everything drives to watch then convert. Dark, distraction-free.",
      es: "Página depurada centrada en un video de ventas (VSL): todo lleva a ver y luego convertir. Oscura, sin distracciones.",
    },
    bestFor: ["vsl", "digital-product", "formation"],
    defaultMoodId: "energetic",
    badge: "VSL",
    previewColors: ["#070A12", "#38BDF8", "#EEF2F8"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "centered",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" },
      },
      {
        type: "video", id: "video", required: true,
        layoutVariant: "wide-banner",
        animations: { headline: "fade-up", video: "zoom-in" },
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
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "pulse" },
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
    density: "balanced",
    decor: { style: "halo", intensity: "strong" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 800,
      headlineTracking: "tight",
      headlineFamily: "display",
    },
  },

  // 8. Webinar Live — compte à rebours, inscription, preuve sociale.
  {
    id: "webinar-live",
    name: "Webinar Live",
    personality: {
      fr: "Pensée pour un webinaire/événement : urgence (compte à rebours), inscription claire et preuve sociale rassurante.",
      en: "Built for a webinar/event: urgency (countdown), clear sign-up and reassuring social proof.",
      es: "Pensada para un webinar/evento: urgencia (cuenta atrás), inscripción clara y prueba social.",
    },
    bestFor: ["webinar", "formation", "service"],
    defaultMoodId: "institutional-trust",
    badge: "Webinar",
    previewColors: ["#0B1228", "#6366F1", "#EEF2FF"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "split-text-image",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", image: "fade-in", cta: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "about", id: "about", required: false,
        layoutVariant: "split-image-text",
        animations: { headline: "fade-up", body: "fade-up", image: "fade-in" },
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "testimonials", id: "testimonials", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
      },
      {
        type: "form", id: "form", required: true,
        layoutVariant: "stacked-card",
        animations: { headline: "fade-up", cta: "pulse" },
      },
    ],
    layoutRules: [
      { when: { sectionMissing: "image" }, fallbackLayout: "centered" },
    ],
    bulletAnimation: "stagger",
    density: "balanced",
    decor: { style: "halo", intensity: "strong" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 800,
      headlineTracking: "tight",
      headlineFamily: "display",
    },
  },

  // 9. Showcase — vitrine d'offre haut de gamme avec visuels alternés.
  {
    id: "showcase",
    name: "Showcase",
    personality: {
      fr: "Vitrine premium : grands visuels, sections alternées gauche/droite et conteneurs en relief pour présenter une offre haut de gamme.",
      en: "Premium showcase: large visuals, alternating left/right sections and elevated containers to present a high-end offer.",
      es: "Escaparate premium: grandes visuales, secciones alternas y contenedores en relieve para una oferta de alta gama.",
    },
    bestFor: ["digital-product", "service", "saas", "coaching-high-ticket"],
    defaultMoodId: "premium-calm",
    badge: "Showcase",
    previewColors: ["#0E1116", "#34D399", "#ECFDF5"],
    sections: [
      {
        type: "hero", id: "hero", required: true,
        layoutVariant: "split-text-image",
        animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", image: "fade-in", cta: "fade-up" },
      },
      {
        type: "benefits", id: "benefits", required: true,
        layoutVariant: "split-image-text",
        animations: { headline: "fade-up", bullets: "fade-up" },
        defaultBulletIcon: "check",
      },
      {
        type: "solution", id: "solution", required: false,
        layoutVariant: "split-text-image",
        animations: { headline: "fade-up", body: "fade-up", image: "fade-in" },
      },
      {
        type: "proof", id: "proof", required: false,
        layoutVariant: "centered",
        animations: { headline: "fade-up", body: "fade-up" },
      },
      {
        type: "offer", id: "offer", required: true,
        layoutVariant: "stacked-card",
        animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", bullets: "fade-up", cta: "fade-up" },
      },
      {
        type: "testimonials", id: "testimonials", required: false,
        layoutVariant: "feature-grid",
        animations: { headline: "fade-up", bullets: "fade-up" },
      },
      {
        type: "faq", id: "faq", required: false,
        layoutVariant: "dense-list",
        animations: { headline: "fade-up", bullets: "fade-up" },
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
    bulletAnimation: "stagger",
    density: "airy",
    decor: { style: "halo", intensity: "medium" },
    typography: {
      headlineScale: "xl",
      headlineWeight: 700,
      headlineTracking: "tight",
      headlineFamily: "display",
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
  "editorial-warm": "lift",
  "aurora-glow": "glow",
  "mint-fresh": "lift",
  "cosmos-night": "glow",
  "sunset-coral": "glow",
  "neo-brutalist": "lift",
  "story-sell": "shine",
  "bold-energy": "pulse",
  "premium-minimal": "lift",
  "coaching-premium": "shine",
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

// ─────────────────────────────────────────────────────────────────────────────
// Icône "signature" par template — utilisée comme puce par défaut quand une
// section n'a pas d'icône explicite. Tout nom inconnu retombe sur "check".
// ─────────────────────────────────────────────────────────────────────────────
export const TEMPLATE_DEFAULT_ICON: Record<string, string> = {
  "clean-light": "check",
  "clean-dark": "flame",
  "editorial-warm": "star",
  "aurora-glow": "sparkles",
  "mint-fresh": "heart",
  "cosmos-night": "zap",
  "sunset-coral": "star",
  "neo-brutalist": "rocket",
  "premium-minimal": "check",
  "coaching-premium": "crown",
  "story-sell": "lightbulb",
  "trust-pro": "shield",
  "bold-energy": "zap",
  "sharp-launch": "rocket",
  "lead-snap": "target",
  "vsl-focus": "zap",
  "webinar-live": "star",
  "showcase": "sparkles",
};

export function getTemplateDefaultIcon(templateId?: string | null): string {
  return (templateId && TEMPLATE_DEFAULT_ICON[templateId]) || "check";
}

export const DEFAULT_PREMIUM_TEMPLATE_ID = "story-sell";
