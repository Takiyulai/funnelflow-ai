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
    name: "Coach Light",
    personality: {
      fr: "Light épuré et professionnel pour coach ou consultant : lisibilité maximale, accent vert profond, sans effets superflus. Couleurs ajustables.",
      en: "Clean professional light theme for coaches or consultants: maximum readability, deep green accent, no gimmicks. Colors adjustable.",
      es: "Tema light limpio y profesional para coaches o consultores: máxima legibilidad, acento verde profundo. Colores ajustables.",
    },
    bestFor: ["service", "coaching-high-ticket", "booking"],
    defaultMoodId: "institutional-trust",
    badge: "Coaching",
    previewColors: ["#F6F6F4", "#1D4A4A", "#0B1B1B"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "process", id: "process", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "about", id: "about", required: false, layoutVariant: "split-text-image", animations: { headline: "fade-up", body: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "cta", id: "cta", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
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
    name: "Webinaire Dark Glow",
    personality: {
      fr: "Ambiance dark premium avec glow rose/violet : idéale pour l'inscription à un webinaire ou un lancement live. Couleurs ajustables après génération.",
      en: "Dark premium vibe with pink/violet glow: perfect for webinar or live launch registration. Colors adjustable after generation.",
      es: "Ambiente dark premium con glow rosa/violeta: ideal para registro a webinar o lanzamiento en vivo. Colores ajustables.",
    },
    bestFor: ["webinar", "formation", "service"],
    defaultMoodId: "energetic",
    badge: "Webinaire",
    previewColors: ["#0A0A12", "#FF2D78", "#EDEDED"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "urgency", id: "urgency", required: false, layoutVariant: "centered", animations: { headline: "fade-up", body: "fade-up" } },
      { type: "qualification", id: "qualification", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "process", id: "process", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "benefits", id: "benefits", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "offer", id: "offer", required: false, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "cta", id: "cta", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Story Sell
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "story-sell",
    name: "Événement Dark",
    personality: {
      fr: "Dark mystérieux et glassmorphism pour l'inscription à un événement en ligne : effets de scène, accent magenta. Couleurs ajustables.",
      en: "Mysterious dark glassmorphism for online event registration: stage effects, magenta accent. Colors adjustable.",
      es: "Dark misterioso y glassmorphism para registro a evento online: efectos de escena, acento magenta. Colores ajustables.",
    },
    bestFor: ["webinar", "challenge", "service"],
    defaultMoodId: "premium-calm",
    badge: "Événement",
    previewColors: ["#0F0805", "#FF007F", "#F5EFE6"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "qualification", id: "qualification", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "pricing", id: "pricing", required: false, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
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
    name: "SaaS Light Blue",
    personality: {
      fr: "Landing SaaS moderne et minimale : fond clair, sections alternées, accent bleu, comparatif de plans. Couleurs ajustables après génération.",
      en: "Modern minimal SaaS landing: light background, alternating sections, blue accent, plan comparison. Colors adjustable after generation.",
      es: "Landing SaaS moderna y minimalista: fondo claro, secciones alternas, acento azul, comparativa de planes. Colores ajustables.",
    },
    bestFor: ["saas", "digital-product", "service"],
    defaultMoodId: "premium-calm",
    badge: "SaaS",
    previewColors: ["#FFFFFF", "#2563EB", "#0B1220"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "benefits", id: "benefits", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "pricing", id: "pricing", required: false, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "cta", id: "cta", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
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
    name: "Agence B2B",
    personality: {
      fr: "Sobre et rassurant pour agence ou service B2B : bleu nuit et teal, chiffres et méthodologie mis en avant. Couleurs ajustables après génération.",
      en: "Sober and reassuring for agency or B2B service: navy and teal, methodology and figures highlighted. Colors adjustable after generation.",
      es: "Sobrio y confiable para agencia o servicio B2B: azul noche y teal, cifras y metodología destacadas. Colores ajustables.",
    },
    bestFor: ["service", "saas", "coaching-high-ticket"],
    defaultMoodId: "institutional-trust",
    badge: "Agence B2B",
    previewColors: ["#0B1E3D", "#0D9488", "#E2E8F0"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "process", id: "process", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "benefits", id: "benefits", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "cta", id: "cta", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Bold Energy
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "bold-energy",
    name: "Fitness Dark Energy",
    personality: {
      fr: "Énergie brute pour fitness ou e-commerce : dark chaud, titres massifs, bandeau défilant, accent rouge. Couleurs ajustables après génération.",
      en: "Raw energy for fitness or e-commerce: warm dark, massive titles, scrolling strip, red accent. Colors adjustable after generation.",
      es: "Energía pura para fitness o e-commerce: dark cálido, títulos enormes, banda animada, acento rojo. Colores ajustables.",
    },
    bestFor: ["digital-product", "challenge", "formation"],
    defaultMoodId: "creative-warm",
    badge: "Sport / E-com",
    previewColors: ["#140606", "#EF4444", "#FFF5EE"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "proof", id: "proof", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "benefits", id: "benefits", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "pricing", id: "pricing", required: false, layoutVariant: "stacked-card", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "cta", id: "cta", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Lead Snap
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "lead-snap",
    name: "Lead Magnet E-book",
    personality: {
      fr: "Page de téléchargement d'e-book ou lead magnet : dynamique, accent orange, chapitres et capture email. Couleurs ajustables après génération.",
      en: "E-book download or lead magnet page: dynamic, orange accent, chapters and email capture. Colors adjustable after generation.",
      es: "Página de descarga de e-book o lead magnet: dinámica, acento naranja, capítulos y captura de email. Colores ajustables.",
    },
    bestFor: ["lead-magnet", "digital-product", "formation"],
    defaultMoodId: "energetic",
    badge: "Lead Magnet",
    previewColors: ["#1A0F2E", "#F58A1E", "#F3E8FF"],
    customizable: true,
    sections: [
      { type: "hero", id: "hero", required: true, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", subheadline: "fade-up", cta: "fade-up" } },
      { type: "program", id: "program", required: false, layoutVariant: "feature-grid", animations: { headline: "fade-up", bullets: "fade-up" }, defaultBulletIcon: "check" },
      { type: "cta", id: "cta-mid", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
      { type: "testimonials", id: "testimonials", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "problem", id: "problem", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "faq", id: "faq", required: false, layoutVariant: "centered", animations: { headline: "fade-up", bullets: "fade-up" } },
      { type: "cta", id: "cta", required: false, layoutVariant: "centered", animations: { eyebrow: "fade-in", headline: "fade-up", body: "fade-up", cta: "fade-up" } },
    ],
    layoutRules: [{ when: { sectionMissing: "image" }, fallbackLayout: "centered" }],
    bulletAnimation: "uniform",
    density: "balanced",
    decor: { style: "plain", intensity: "subtle" },
    typography: { headlineScale: "md", headlineWeight: 700, headlineTracking: "tight", headlineFamily: "sans" },
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
