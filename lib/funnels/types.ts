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
  popupTitle?: string;        // ← NOUVEAU
  popupBody?: string;         // ← NOUVEAU (texte court d'intro dans le popup)
  popupEmbed?: string;        // ← NOUVEAU (code d'embed formulaire systeme.io collé par l'utilisateur)
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

// Variante de mise en page utilisée par les templates premium
// (plus riche que SectionLayout, applique des règles conditionnelles au rendu)
export type SectionLayoutVariant =
  | "centered"           // tout centré, espace généreux (premium par défaut)
  | "left-aligned"       // texte aligné à gauche
  | "split-text-image"   // texte gauche / image droite (desktop)
  | "split-image-text"   // image gauche / texte droite (desktop)
  | "stacked-card"       // carte centrée avec ombre
  | "wide-banner"        // bannière pleine largeur
  | "feature-grid"       // grille 3 colonnes (pour benefits)
  | "dense-list";        // liste compacte (pour FAQ ou pricing)

export type SectionStyle = {
  textColor?: string;
  accentColor?: string;
  spacing?: "compact" | "default" | "large";
  align?: SectionAlign;
  layout?: SectionLayout;
};

// ─────────────────────────────────────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────────────────────────────────────
// Animations CSS appliquées au scroll via IntersectionObserver
// Chaque preset correspond à une keyframe définie dans globals.css
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

// Cibles d'animation au sein d'une section
export type AnimationTarget =
  | "eyebrow"
  | "headline"
  | "subheadline"
  | "body"
  | "bullets"
  | "image"
  | "video"
  | "cta";

// Mapping target → preset, défini par le template ou surchargé par l'utilisateur
export type SectionAnimations = Partial<Record<AnimationTarget, AnimationPreset>>;

// ─────────────────────────────────────────────────────────────────────────────
// Section d'un tunnel (avec animations et layoutVariant optionnels)
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

  // Nouveautés Phase B : layout riche et animations
  layoutVariant?: SectionLayoutVariant;
  animations?: SectionAnimations;

  visualDirection?: string;
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Template (ancien type, conservé pour rétrocompat avec funnelTemplates simples)
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
// NOUVEAU : Template premium avec personnalité, layouts et animations
// ─────────────────────────────────────────────────────────────────────────────

// Personnalité visuelle d'un template (description courte différenciante)
export type TemplatePersonality = {
  fr: string;
  en: string;
  es: string;
};

// Slot de section dans un template premium
// Définit la structure attendue + le layout + les animations par défaut
export type TemplateSectionSlot = {
  type: FunnelSectionType;
  // Identifiant stable de la section (slug-case)
  id: string;
  // Si true, la section est obligatoire (le template ne marche pas sans)
  required: boolean;
  // Layout principal (peut être ajusté par les règles conditionnelles)
  layoutVariant: SectionLayoutVariant;
  // Animations par défaut pour chaque cible de cette section
  animations: SectionAnimations;
  // Suggestion d'icône lucide pour les bullets, si applicable
  defaultBulletIcon?: IconName;
  // Conditions à vérifier pour que la section soit incluse
  // Ex : "video.required" inclut la section seulement si l'utilisateur a fourni videoUrl
  includeIf?: TemplateCondition;
};

// Condition simple évaluée contre le brief utilisateur
export type TemplateCondition =
  | { has: "video" }       // brief.videoUrl est rempli
  | { has: "about" }       // brief.aboutText est rempli
  | { has: "logo" }        // brief.logoUrl est rempli
  | { funnelKindIn: FunnelKind[] }
  | { moodIn: MoodId[] }
  | { always: true };

// Règle conditionnelle de fallback de layout
// Ex : "si la section n'a pas d'image, bascule split-text-image en centered"
export type TemplateLayoutRule = {
  // Condition qui déclenche la règle
  when:
    | { sectionMissing: "image" }
    | { sectionMissing: "video" }
    | { sectionMissing: "bullets" };
  // Layout de remplacement
  fallbackLayout: SectionLayoutVariant;
};

// Définition complète d'un template premium
export type TemplateDefinition = {
  id: string;
  // Nom commercial court (affiché dans la galerie)
  name: string;
  // Personnalité différenciante (1 phrase)
  personality: TemplatePersonality;
  // Catégorie/usage type, pour filtrage
  bestFor: FunnelKind[];
  // Mood par défaut suggéré (l'utilisateur peut le surcharger)
  defaultMoodId: MoodId;
  // Badge court affiché sur la card (ex : "Premium", "Punchy", "Story")
  badge: string;
  // Trois couleurs d'aperçu pour la card de galerie
  previewColors: [string, string, string];
  // Sections du template, dans l'ordre
  sections: TemplateSectionSlot[];
  // Règles de layout conditionnelles globales appliquées à toutes les sections
  layoutRules: TemplateLayoutRule[];
  // Animation des bullets (au scroll en cascade ou non)
  bulletAnimation: "stagger" | "uniform" | "none";
  // Densité visuelle générale (impacte spacing par défaut)
  density: "airy" | "balanced" | "dense";
};

// ─────────────────────────────────────────────────────────────────────────────
// TunnelGroup (préparation Phase B Message 4 : multi-pages)
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
// Helpers
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
