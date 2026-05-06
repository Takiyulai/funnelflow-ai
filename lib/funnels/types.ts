// lib/funnels/types.ts

// ─────────────────────────────────────────────────────────────────────────────
// Langues supportées
// ─────────────────────────────────────────────────────────────────────────────
export type Language = "fr" | "en" | "es";

// ─────────────────────────────────────────────────────────────────────────────
// Types de tunnel (formats)
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelKind =
  | "vsl"
  | "lead-magnet"
  | "webinar"
  | "formation"
  | "service"
  | "digital-product"
  | "booking"
  | "saas"
  | "thank-you";

// ─────────────────────────────────────────────────────────────────────────────
// Mode de création
// ─────────────────────────────────────────────────────────────────────────────
export type CreationMode = "guided" | "free";

// ─────────────────────────────────────────────────────────────────────────────
// Ambiance / palette émotionnelle
// ─────────────────────────────────────────────────────────────────────────────
export type MoodId =
  | "premium-calm"
  | "energetic"
  | "institutional-trust"
  | "creative-warm";

export type MoodPreset = {
  id: MoodId;
  label: { fr: string; en: string; es: string };
  description: { fr: string; en: string; es: string };
  primary: string;
  secondary: string;
  accent: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Source vidéo
// ─────────────────────────────────────────────────────────────────────────────
export type VideoSource = {
  provider: "youtube" | "vimeo" | "url" | "upload";
  url: string;
  posterUrl?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Types de sections
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelSectionType =
  | "hero"
  | "about"
  | "problem"
  | "solution"
  | "benefits"
  | "proof"
  | "offer"
  | "bonus"
  | "guarantee"
  | "faq"
  | "cta"
  | "form"
  | "thank_you"
  | "program"
  | "pricing"
  | "process"
  | "webinar"
  | "video"
  | "qualification";

// ─────────────────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────────────────
export type CtaMode = "anchor" | "redirect" | "popup";

export type CtaConfig = {
  mode: CtaMode;
  label: string;
  // mode === "redirect"
  url?: string;
  target?: "_self" | "_blank";
  // mode === "anchor"
  anchorId?: string;
  // mode === "popup"
  popupId?: string;
  popupTitle?: string;
  popupBody?: string;
  popupEmbed?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Image par section
// ─────────────────────────────────────────────────────────────────────────────
export type ImageMode = "none" | "upload" | "ai-suggested";

export type SectionImage = {
  mode: ImageMode;
  url?: string;
  alt?: string;
  credit?: string;
  sourceUrl?: string;
  suggestionQuery?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Icônes
// ─────────────────────────────────────────────────────────────────────────────
export type IconName =
  | "check" | "star" | "shield" | "zap" | "target" | "rocket"
  | "trending-up" | "trending-down" | "clock" | "calendar"
  | "mail" | "user" | "users" | "briefcase" | "award" | "gift"
  | "lock" | "settings" | "sparkles" | "lightbulb" | "flag"
  | "bar-chart" | "play" | "download" | "file-text"
  | "thumbs-up" | "heart" | "globe";

// ─────────────────────────────────────────────────────────────────────────────
// Style et layout d'une section
// ─────────────────────────────────────────────────────────────────────────────
export type SectionAlign = "left" | "center" | "right";

export type SectionLayout =
  | "text-only"
  | "image-only"
  | "text-image"
  | "image-text";

export type SectionLayoutVariant =
  | "centered"
  | "left-aligned"
  | "split-text-image"
  | "split-image-text"
  | "stacked-card"
  | "wide-banner"
  | "feature-grid"
  | "dense-list";

export type SectionStyle = {
  textColor?: string;
  accentColor?: string;
  spacing?: "compact" | "default" | "large";
  align?: SectionAlign;
  layout?: SectionLayout;
  colors?: {
    bg?: string;
    ink?: string;
    accent?: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────────────────────────────────────
export type AnimationPreset =
  | "none"
  | "fade-in"
  | "fade-up"
  | "fade-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "pulse";

export type AnimationTarget =
  | "eyebrow"
  | "headline"
  | "subheadline"
  | "body"
  | "bullets"
  | "image"
  | "video"
  | "cta";

export type SectionAnimations = Partial<Record<AnimationTarget, AnimationPreset>>;

// ─────────────────────────────────────────────────────────────────────────────
// Items spécialisés par type de section (Livraison B)
// ─────────────────────────────────────────────────────────────────────────────

/** FAQ — paire question / réponse */
export type FaqItem = {
  question: string;
  answer: string;
};

/** Témoignage client */
export type TestimonialItem = {
  quote: string;
  authorName: string;
  authorRole?: string;     // "CEO de Acme", "Cliente", etc.
  avatarUrl?: string;
  rating?: number;         // 1 à 5 (étoiles)
  sourceUrl?: string;      // lien vers l'avis Google / Trustpilot / etc.
};

/** Plan de tarification */
export type PricingPlanItem = {
  name: string;
  price: string;           // "29€", "Gratuit", "Sur devis"
  period?: string;         // "/mois", "/an", "à vie"
  description?: string;    // accroche courte
  features: string[];      // bullets internes au plan
  cta?: CtaConfig;         // bouton du plan
  highlighted?: boolean;   // plan mis en avant
  badge?: string;          // ex: "Populaire", "-20%"
};

/** Bonus / cadeau inclus dans une offre */
export type BonusItem = {
  title: string;
  description?: string;
  value?: string;          // "Valeur 97€"
  iconName?: IconName;
};

/** Garantie / engagement */
export type GuaranteeItem = {
  title: string;
  description?: string;
  iconName?: IconName;     // shield, lock, check, award...
  duration?: string;       // "30 jours", "1 an"
};

/**
 * Union discriminée des items spécialisés.
 * Le champ "kind" permet au renderer et à l'éditeur de dispatcher proprement.
 */
export type SectionItem =
  | { kind: "faq"; data: FaqItem }
  | { kind: "testimonial"; data: TestimonialItem }
  | { kind: "pricing"; data: PricingPlanItem }
  | { kind: "bonus"; data: BonusItem }
  | { kind: "guarantee"; data: GuaranteeItem };

// ─────────────────────────────────────────────────────────────────────────────
// Section d'un tunnel (avec animations, layoutVariant et items optionnels)
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelSection = {
  id: string;
  type: FunnelSectionType;

  eyebrow?: string;
  headline: string;
  subheadline?: string;
  body?: string;
  bullets?: string[];

  cta?: CtaConfig;

  image?: SectionImage;
  video?: VideoSource;

  bulletIcons?: IconName[];
  iconName?: IconName;

  visible?: boolean;
  style?: SectionStyle;

  layoutVariant?: SectionLayoutVariant;
  animations?: SectionAnimations;

  visualDirection?: string;

  /**
   * Items spécialisés par type (FAQ, témoignages, pricing, bonus, garantie).
   * Le `kind` de chaque item doit correspondre au `type` de la section.
   * Voir lib/funnels/sectionItems.ts pour helpers et migration.
   */
  items?: SectionItem[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Email
// ─────────────────────────────────────────────────────────────────────────────
export type EmailSequenceItem = {
  subject: string;
  html: string;
  text: string;
  cta: CtaConfig;
};

// ─────────────────────────────────────────────────────────────────────────────
// Tunnel complet (= 1 page)
// ─────────────────────────────────────────────────────────────────────────────
export type Funnel = {
  funnelName: string;
  language: Language;
  sections: FunnelSection[];

  thankYouPage: {
    headline: string;
    body: string;
    cta?: CtaConfig;
  };

  emails: EmailSequenceItem[];

  seo: {
    title: string;
    description: string;
  };

  design: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    style: string;
  };

  defaultCta?: CtaConfig;

  meta?: {
    funnelKind?: FunnelKind;
    moodId?: MoodId;
    creationMode?: CreationMode;
    templateId?: string;
    logoUrl?: string;
    tunnelGroupId?: string;
    pageRole?: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Brief utilisateur
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelBrief = {
  brandName: string;
  offerName: string;
  price: string;
  targetAudience: string;
  mainPain: string;
  promise: string;
  tone: string;
  funnelType: string;
  designStyle: string;
  language: Language;

  primaryCta?: CtaConfig;
  defaultImageMode?: ImageMode;

  funnelKind?: FunnelKind;
  creationMode?: CreationMode;
  templateId?: string;

  moodId?: MoodId;
  mainColor?: string;
  secondaryColor?: string;

  logoUrl?: string;
  videoUrl?: string;

  aboutText?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  ctaTarget?: "_self" | "_blank";
};

// ─────────────────────────────────────────────────────────────────────────────
// Template (ancien type, conservé pour rétrocompat)
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelTemplate = {
  id: string;
  name: string;
  objective: string;
  audience: string;
  sections: FunnelSectionType[];
  badge: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Template premium
// ─────────────────────────────────────────────────────────────────────────────
export type TemplatePersonality = {
  fr: string;
  en: string;
  es: string;
};

export type TemplateSectionSlot = {
  type: FunnelSectionType;
  id: string;
  required: boolean;
  layoutVariant: SectionLayoutVariant;
  animations: SectionAnimations;
  defaultBulletIcon?: IconName;
  includeIf?: TemplateCondition;
};

export type TemplateCondition =
  | { has: "video" }
  | { has: "about" }
  | { has: "logo" }
  | { funnelKindIn: FunnelKind[] }
  | { moodIn: MoodId[] }
  | { always: true };

export type TemplateLayoutRule = {
  when:
    | { sectionMissing: "image" }
    | { sectionMissing: "video" }
    | { sectionMissing: "bullets" };
  fallbackLayout: SectionLayoutVariant;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  personality: TemplatePersonality;
  bestFor: FunnelKind[];
  defaultMoodId: MoodId;
  badge: string;
  previewColors: [string, string, string];
  sections: TemplateSectionSlot[];
  layoutRules: TemplateLayoutRule[];
  bulletAnimation: "stagger" | "uniform" | "none";
  density: "airy" | "balanced" | "dense";
};

// ─────────────────────────────────────────────────────────────────────────────
// TunnelGroup
// ─────────────────────────────────────────────────────────────────────────────
export type TunnelGroupKind =
  | "lead-magnet"
  | "vsl"
  | "formation"
  | "webinar"
  | "service-booking"
  | "digital-product"
  | "custom";

export type TunnelStepStatus = "pending" | "in-progress" | "generated";

export type TunnelStep = {
  id: string;
  role: FunnelKind | "checkout-redirect" | "delivery";
  name: string;
  status: TunnelStepStatus;
  funnelId?: string;
};

export type TunnelGroup = {
  id: string;
  name: string;
  language: Language;
  kind: TunnelGroupKind;
  plannedSteps: TunnelStep[];
  createdAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers CTA
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_CTA: CtaConfig = {
  label: "En savoir plus",
  mode: "anchor",
  anchorId: "lead-form",
  target: "_self",
};

export function makeRedirectCta(
  label: string,
  url: string,
  target: "_self" | "_blank" = "_blank"
): CtaConfig {
  return { label, mode: "redirect", url, target };
}

export function makeAnchorCta(label: string, anchorId: string): CtaConfig {
  return { label, mode: "anchor", anchorId, target: "_self" };
}
