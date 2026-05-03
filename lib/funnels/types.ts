// lib/funnels/types.ts

// ─────────────────────────────────────────────────────────────────────────────
// Langues supportées
// ─────────────────────────────────────────────────────────────────────────────
export type Language = "fr" | "en" | "es";

// ─────────────────────────────────────────────────────────────────────────────
// Types de tunnel (formats)
// ─────────────────────────────────────────────────────────────────────────────
// Sélection en première étape du wizard, influence les étapes suivantes
// Exemple : un tunnel "vsl" ou "webinar" déclenche l'étape vidéo
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
// "guided" : choix d'un template recommandé
// "free"   : structure générée librement par l'IA
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
// Source vidéo (étape conditionnelle pour VSL / Webinar)
// ─────────────────────────────────────────────────────────────────────────────
export type VideoSource = {
  provider: "youtube" | "vimeo" | "url" | "upload";
  url: string;
  posterUrl?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Types de sections d'un tunnel
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
// Configuration des CTA
// ─────────────────────────────────────────────────────────────────────────────
export type CtaMode = "redirect" | "anchor" | "popup";

export type CtaConfig = {
  label: string;
  mode: CtaMode;
  url?: string;
  target?: "_self" | "_blank";
  anchorId?: string;
  popupId?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration d'image par section
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
// Icônes professionnelles (jamais d'emojis)
// ─────────────────────────────────────────────────────────────────────────────
export type IconName =
  | "check"
  | "star"
  | "shield"
  | "zap"
  | "target"
  | "rocket"
  | "trending-up"
  | "trending-down"
  | "clock"
  | "calendar"
  | "mail"
  | "user"
  | "users"
  | "briefcase"
  | "award"
  | "gift"
  | "lock"
  | "settings"
  | "sparkles"
  | "lightbulb"
  | "flag"
  | "bar-chart"
  | "play"
  | "download"
  | "file-text"
  | "thumbs-up"
  | "heart"
  | "globe";

// ─────────────────────────────────────────────────────────────────────────────
// Style et layout d'une section
// ─────────────────────────────────────────────────────────────────────────────
export type SectionAlign = "left" | "center" | "right";

export type SectionLayout =
  | "text-only"
  | "image-only"
  | "text-image"
  | "image-text";

export type SectionStyle = {
  textColor?: string;
  accentColor?: string;
  spacing?: "compact" | "default" | "large";
  // Note : on accepte "right" pour ne pas casser les types côté éditeur
  align?: SectionAlign;
  layout?: SectionLayout;
};

// ─────────────────────────────────────────────────────────────────────────────
// Section d'un tunnel
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

  visualDirection?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Séquence email
// ─────────────────────────────────────────────────────────────────────────────
export type EmailSequenceItem = {
  subject: string;
  html: string;
  text: string;
  cta: CtaConfig;
};

// ─────────────────────────────────────────────────────────────────────────────
// Tunnel complet
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

  // Métadonnées du brief associé (optionnelles, utilisées par l'éditeur)
  meta?: {
    funnelKind?: FunnelKind;
    moodId?: MoodId;
    creationMode?: CreationMode;
    templateId?: string;
    logoUrl?: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Brief utilisateur (entrée du wizard)
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelBrief = {
  // Champs historiques (inchangés)
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

  // Nouveaux champs optionnels (rétrocompatibles)
  funnelKind?: FunnelKind;
  creationMode?: CreationMode;
  templateId?: string;

  moodId?: MoodId;
  mainColor?: string;
  secondaryColor?: string;

  logoUrl?: string;
  videoUrl?: string;

  aboutText?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Template de référence
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
// Helpers de construction
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
