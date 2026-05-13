// lib/funnels/types.ts

// ─────────────────────────────────────────────────────────────────────────────
// Langues supportées
// ─────────────────────────────────────────────────────────────────────────────
export type Language = "fr" | "en" | "es";

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

export type CreationMode = "guided" | "free";

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

export type VideoSource = {
  provider: "youtube" | "vimeo" | "url" | "upload";
  url: string;
  posterUrl?: string;
};

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
  | "qualification"
  | "testimonials";

export type CtaMode = "anchor" | "redirect" | "popup";

export type CtaConfig = {
  mode: CtaMode;
  label: string;
  url?: string;
  target?: "_self" | "_blank";
  anchorId?: string;
  popupId?: string;
  popupTitle?: string;
  popupBody?: string;
  popupEmbed?: string;
};

export type ImageMode = "none" | "upload" | "ai-suggested";

/** Lot G — tailles prédéfinies pour les images */
export type ImageSize = "sm" | "md" | "lg" | "full" | "custom";

/** Lot G — animations spécifiques aux images */
export type ImageAnimation =
  | "none"
  | "fade-in"
  | "fade-up"
  | "zoom-in"
  | "slide-left"
  | "slide-right"
  | "float"
  | "pulse";

export type SectionImage = {
  mode: ImageMode;
  url?: string;
  alt?: string;
  credit?: string;
  sourceUrl?: string;
  suggestionQuery?: string;

  // ─── Lot G : contrôles d'affichage ──────────────────────────
  transparentBg?: boolean;
  size?: ImageSize;
  customWidth?: number;
  animation?: ImageAnimation;

  // ─── Phase 2 — Référence à un MediaItem fourni par l'utilisateur ─
  /**
   * Id d'un MediaItem présent dans `brief.medias`. Si présent, le post-traitement
   * de applyTemplateToFunnel résout cet id en URL réelle (et écrit `url` et `alt`).
   * Permet à l'IA de choisir un média sans inventer d'URL.
   */
  mediaRef?: string;
};


/** Lot G — Image de fond appliquée à toute une section */
export type SectionBackground = {
  /** Data URL ou URL de l'image de fond */
  imageUrl?: string;
  /** Voile sombre par-dessus l'image pour la lisibilité du texte (0 → 1) */
  overlay?: number;
  /** Position de l'image de fond */
  position?: "center" | "top" | "bottom" | "left" | "right";
  /** Mode de cadrage de l'image de fond */
  size?: "cover" | "contain";
};

// ─────────────────────────────────────────────────────────────────────────────
// Lot L — Système d'icônes unifié
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste exhaustive des icônes disponibles (camelCase).
 * Pour ajouter une icône :
 *   1) ajouter le nom ici
 *   2) l'ajouter dans components/editor/IconPicker.tsx (constante ICONS)
 *   3) l'ajouter dans components/funnel/IconRenderer.tsx (ICON_MAP)
 */
export type IconName =
  // Validation / succès
  | "check"
  | "checkCircle"
  | "badgeCheck"
  | "thumbsUp"
  // Mise en avant
  | "star"
  | "sparkles"
  | "award"
  | "trophy"
  | "crown"
  | "flame"
  // Action / énergie
  | "zap"
  | "rocket"
  | "target"
  | "lightbulb"
  // Sécurité / confiance
  | "shield"
  | "lock"
  // Temps
  | "clock"
  | "calendar"
  // Émotion / valeur
  | "heart"
  | "gift"
  // Données / tendance
  | "trendingUp"
  | "trendingDown"
  | "barChart"
  // Communication / contenu
  | "mail"
  | "user"
  | "users"
  | "briefcase"
  | "settings"
  | "flag"
  | "globe"
  | "play"
  | "download"
  | "fileText";

/**
 * Alias rétro-compatibles : si d'anciens funnels en localStorage utilisent
 * des noms kebab-case (ex. "thumbs-up"), on les normalise au runtime.
 */
const ICON_NAME_ALIASES: Record<string, IconName> = {
  "check-circle": "checkCircle",
  "badge-check": "badgeCheck",
  "thumbs-up": "thumbsUp",
  "trending-up": "trendingUp",
  "trending-down": "trendingDown",
  "bar-chart": "barChart",
  "file-text": "fileText",
};

/**
 * Normalise un nom d'icône (legacy kebab-case ou nouveau camelCase) vers
 * la forme canonique. Retourne "check" par défaut si l'icône est inconnue.
 */
export function normalizeIconName(name?: string): IconName {
  if (!name) return "check";
  if (name in ICON_NAME_ALIASES) return ICON_NAME_ALIASES[name];
  return name as IconName;
}

/** Tailles standardisées (utilisées partout : IconPicker, renderers, presets). */
export type IconSize = "sm" | "md" | "lg" | "xl" | "custom";

export const ICON_SIZE_PX: Record<Exclude<IconSize, "custom">, number> = {
  sm: 16,
  md: 20,
  lg: 28,
  xl: 36,
};

/** Animations applicables à une icône. */
export type IconAnimation =
  | "none"
  | "pulse"
  | "bounce"
  | "spin"
  | "wiggle"
  | "float";

/**
 * Configuration complète d'une icône réutilisable dans n'importe quel item.
 * `size: "custom"` active `customSizePx`.
 */
export type IconConfig = {
  name: IconName;
  size?: IconSize;
  customSizePx?: number;
  animation?: IconAnimation;
  /** Couleur custom (hex/rgb). Si absent : hérite de `--ff-accent` de la section. */
  color?: string;
};

/** Helper : convertit un IconConfig en taille en pixels (clamp 8 → 128). */
export function resolveIconSizePx(config?: IconConfig): number {
  if (!config) return ICON_SIZE_PX.md;
  if (config.size === "custom" && config.customSizePx) {
    return Math.max(8, Math.min(128, config.customSizePx));
  }
  if (config.size && config.size !== "custom") return ICON_SIZE_PX[config.size];
  return ICON_SIZE_PX.md;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot L — Icônes décoratives libres (Niveau 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Positions disponibles pour une icône décorative dans une section. */
export type DecorativeIconPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "before-headline"
  | "after-headline"
  | "before-cta"
  | "after-cta"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "floating-bg";

/** Une icône décorative posée librement dans une section. */
export type DecorativeIcon = {
  /** Identifiant unique (pour les listes React) */
  id: string;
  /** Configuration de l'icône (nom, taille, animation, couleur) */
  icon: IconConfig;
  /** Où placer l'icône dans la section */
  position: DecorativeIconPosition;
  /** Label optionnel affiché à côté de l'icône */
  label?: string;
  /** Opacité 0-1. Défaut 1. */
  opacity?: number;
  /** Décalage horizontal en px. Défaut 0. */
  offsetX?: number;
  /** Décalage vertical en px. Défaut 0. */
  offsetY?: number;
  /** Rotation en degrés (-180 à 180). Défaut 0. */
  rotation?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Layouts & styles de section
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

export type SectionColors = {
  bg?: string;
  ink?: string;
  accent?: string;
};

export type SectionStyle = {
  textColor?: string;
  accentColor?: string;
  spacing?: "compact" | "default" | "large";
  align?: SectionAlign;
  layout?: SectionLayout;
  colors?: SectionColors;
  userColorsOverride?: boolean;
  shadow?: {
    size?: "none" | "sm" | "md" | "lg" | "xl";
    color?: string;
  };
};

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
// Items réutilisables (FAQ, témoignages, tarifs, bonus, garantie, form)
// ─────────────────────────────────────────────────────────────────────────────

export type FaqItem = {
  question: string;
  answer: string;
  /** Lot L — icône optionnelle devant la question */
  icon?: IconConfig;
};

export type TestimonialItem = {
  quote: string;
  authorName: string;
  authorRole?: string;
  avatarUrl?: string;
  rating?: number;
  sourceUrl?: string;
  /** Lot L — icône optionnelle (ex. guillemets, étoile) */
  icon?: IconConfig;
};

export type PricingPlanItem = {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  cta?: CtaConfig;
  highlighted?: boolean;
  badge?: string;
  /** Lot L — icône utilisée devant chaque feature de ce plan */
  featureIcon?: IconConfig;
};

export type BonusItem = {
  title: string;
  description?: string;
  value?: string;
  /** @deprecated utiliser `icon` (IconConfig). Conservé pour rétrocompat. */
  iconName?: IconName;
  /** Lot L — icône complète (avec taille/animation) */
  icon?: IconConfig;
};

export type GuaranteeItem = {
  title: string;
  description?: string;
  /** @deprecated utiliser `icon` (IconConfig). Conservé pour rétrocompat. */
  iconName?: IconName;
  duration?: string;
  /** Lot L — icône complète */
  icon?: IconConfig;
};

export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "textarea"
  | "select"
  | "checkbox";

export type FormFieldItem = {
  /** Identifiant interne unique (utilisé comme name HTML) */
  name: string;
  /** Libellé affiché au-dessus de l'input */
  label?: string;
  /** Texte d'aide à l'intérieur de l'input */
  placeholder?: string;
  /** Type d'input HTML */
  type: FormFieldType;
  /** Champ obligatoire ? */
  required?: boolean;
  /** Pour type=select : options proposées */
  options?: string[];
  /** Largeur dans le formulaire : full ou half (deux champs côte-à-côte) */
  width?: "full" | "half";
};

export type SectionItem =
  | { kind: "faq"; data: FaqItem }
  | { kind: "testimonial"; data: TestimonialItem }
  | { kind: "pricing"; data: PricingPlanItem }
  | { kind: "bonus"; data: BonusItem }
  | { kind: "guarantee"; data: GuaranteeItem }
  | { kind: "formField"; data: FormFieldItem };

// ─────────────────────────────────────────────────────────────────────────────
// FunnelSection (définition unique)
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
  iconSize?: IconSize;
  iconAnimation?: IconAnimation;

  visible?: boolean;
  style?: SectionStyle;

  layoutVariant?: SectionLayoutVariant;
  animations?: SectionAnimations;

  visualDirection?: string;

  items?: SectionItem[];

  /** Lot G — image de fond de section (overlay réglable, cadrage) */
  background?: SectionBackground;

  /** Lot L — icônes décoratives libres positionnées dans la section */
  decorativeIcons?: DecorativeIcon[];
};

export type EmailSequenceItem = {
  subject: string;
  html: string;
  text: string;
  cta: CtaConfig;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lot M — Header éditable
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelHeader = {
  /** Affiche ou masque entièrement le header */
  enabled?: boolean;
  /** Mode d'affichage : logo seul, nom seul, ou les deux */
  displayMode?: "logo" | "name" | "both";
  /** Logo (URL d'image) — fallback sur funnel.meta.logoUrl si absent */
  logoUrl?: string;
  /** Nom de marque affiché — fallback sur extractBrandName(funnel.funnelName) */
  brandName?: string;
  /** CTA optionnel dans le header (bouton à droite) */
  cta?: CtaConfig;
  /** Header sticky en haut de la page */
  sticky?: boolean;
  /** Fond transparent avec backdrop-blur (utile quand sticky) */
  transparent?: boolean;
};

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

    // ─── Lot 3 : contrôles globaux ────────────────────────────────
    /** Multiplicateur de taille du texte (0.85 → 1.25, défaut 1) */
    textScale?: number;
    /** Multiplicateur de taille des boutons (0.85 → 1.25, défaut 1) */
    buttonScale?: number;
    /** Active la personnalisation du fond (templates clean uniquement) */
    customBgEnabled?: boolean;
    /** Couleur de fond personnalisée — appliquée si customBgEnabled === true */
    customBg?: string;

    // ─── Champs déjà utilisés dans FunnelPreview / GlobalStylePanel ─
    animationsEnabled?: boolean;
    buttonAnim?: "lift" | "glow" | "pulse" | "shine";
  };

  defaultCta?: CtaConfig;

  /** Lot M — configuration du header (logo, nom, CTA, sticky) */
  header?: FunnelHeader;

  meta?: {
    funnelKind?: FunnelKind;
    moodId?: MoodId;
    creationMode?: CreationMode;
    templateId?: string;
    logoUrl?: string;
    tunnelGroupId?: string;
    pageRole?: string;
    businessName?: string;
    legalNotice?: string;
    contactEmail?: string;
  };
};
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 du wizard simplifié — Médias utilisateur & préférences copywriting
// Tous ces champs sont OPTIONNELS sur FunnelBrief et n'affectent pas le code
// existant tant qu'ils ne sont pas renseignés.
// ─────────────────────────────────────────────────────────────────────────────

/** Type d'un média fourni par l'utilisateur pendant le wizard. */
export type MediaKind = "image" | "video";

/**
 * Un média uploadé ou lié par l'utilisateur, accompagné d'une description
 * libre et d'un hint optionnel sur la section où le placer.
 */
export type MediaItem = {
  /** Identifiant unique (pour les listes React). */
  id: string;
  /** image | video */
  kind: MediaKind;
  /** Data URL (upload local) OU URL distante (https://...). */
  url: string;
  /** Description libre fournie par l'utilisateur (utilisée par l'IA pour le placement et l'alt). */
  description?: string;
  /**
   * Hint optionnel : type de section où placer ce média en priorité.
   * Si absent, l'IA décide en fonction de la description.
   */
  sectionHint?: FunnelSectionType;
  /** Texte alternatif (accessibilité). Si absent, dérivé de description. */
  alt?: string;
  /** Nom de fichier d'origine (informationnel). */
  fileName?: string;
};

/** Tons d'écriture proposés au wizard (radios). */
export type CopywritingTone =
  | "direct"
  | "empathique"
  | "storytelling"
  | "expert"
  | "amical"
  | "premium";

/** Préférence de longueur des textes générés. */
export type CopywritingLength = "concise" | "balanced" | "detailed";

/**
 * Préférences de copywriting capturées au wizard.
 * Toutes optionnelles : si absentes, on retombe sur brief.tone (legacy).
 */
export type CopywritingPrefs = {
  tone?: CopywritingTone;
  length?: CopywritingLength;
  /** Phrase d'exemple fournie par l'utilisateur pour calibrer le style. */
  exampleSentence?: string;
  /** Mots/expressions à éviter dans la copie (liste libre). */
  avoidWords?: string[];
};

/** Helper : crée un MediaItem vide avec un id unique. */
export function makeEmptyMediaItem(kind: MediaKind = "image"): MediaItem {
  return {
    id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    url: "",
    description: "",
  };
}

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

  // ─── Phase 1 du wizard simplifié (optionnels, rétro-compatibles) ─────
  /** Médias fournis par l'utilisateur (étape "Médias" du nouveau wizard). */
  medias?: MediaItem[];
  /** Préférences de copywriting (étape "Ton & style d'écriture"). */
  copywritingPrefs?: CopywritingPrefs;
};

export type FunnelTemplate = {
  id: string;
  name: string;
  objective: string;
  audience: string;
  sections: FunnelSectionType[];
  badge: string;
};

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

export type TemplateDecor = {
  style: "plain" | "blobs" | "halo" | "grid" | "gradient" | "noise";
  intensity?: "subtle" | "medium" | "strong";
};

export type TemplateTypography = {
  headlineScale: "sm" | "md" | "lg" | "xl";
  headlineWeight: 500 | 600 | 700 | 800 | 900;
  headlineTracking: "tight" | "normal" | "wide";
  headlineFamily: "sans" | "serif" | "display";
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
  decor?: TemplateDecor;
  typography?: TemplateTypography;
  /**
   * Si true, le template a un fond neutre que l'utilisateur peut
   * entièrement personnaliser dans l'éditeur après génération.
   * Affiche un badge "Fond personnalisable" dans la galerie.
   */
  customizable?: boolean;
};

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

export const DEFAULT_CTA: CtaConfig = {
  label: "En savoir plus",
  mode: "anchor",
  anchorId: "lead-form",
  target: "_self",
};

export function makeRedirectCta(
  label: string,
  url: string,
  target: "_self" | "_blank" = "_blank",
): CtaConfig {
  return { label, mode: "redirect", url, target };
}

export function makeAnchorCta(label: string, anchorId: string): CtaConfig {
  return { label, mode: "anchor", anchorId, target: "_self" };
}
