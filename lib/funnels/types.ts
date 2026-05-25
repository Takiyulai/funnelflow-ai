// lib/funnels/types.ts

// ─────────────────────────────────────────────────────────────────────────────
// Langues supportées
// ─────────────────────────────────────────────────────────────────────────────
export type Language = "fr" | "en" | "es";

/**
 * FunnelKind : étendu avec coaching-high-ticket et challenge.
 * Les anciennes valeurs (vsl, formation, service, saas, thank-you) sont
 * conservées pour la rétrocompat des funnels existants en localStorage,
 * mais elles ne sont plus exposées dans FUNNEL_KINDS (kinds.ts).
 */
export type FunnelKind =
  | "lead-magnet"
  | "digital-product"
  | "webinar"
  | "booking"
  | "coaching-high-ticket"
  | "challenge"
  // ─── Legacy (rétrocompat, mappés automatiquement) ───────────────
  | "vsl"
  | "formation"
  | "service"
  | "saas"
  | "thank-you";

export type CreationMode = "guided" | "free";

export type MoodId =
  | "premium-calm"
  | "modern-minimal"
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

/**
 * Provider de popup pour un CTA en mode "popup".
 * - "internal" : popup FunnelForge intégrée, lead envoyé vers /api/leads (Supabase).
 * - "systeme"  : popup native Systeme.io, ouverte via la classe systeme-show-popup-<id>.
 */
export type PopupProvider = "internal" | "systeme";

// ─────────────────────────────────────────────────────────────────────────────
// CTA — icône et espacement (Lot B4)
// ─────────────────────────────────────────────────────────────────────────────

export type CtaIcon =
  | "none"
  | "arrow-right"
  | "arrow-down"
  | "external"
  | "check";

export type CtaSpacing = {
  /** Marge au-dessus du bouton (px). Défaut : 18 */
  marginTop?: number;
  /** Marge en dessous du bouton (px). Défaut : 0 */
  marginBottom?: number;
  /** Padding horizontal interne du bouton (px). Défaut : 22 */
  paddingX?: number;
  /** Padding vertical interne du bouton (px). Défaut : 14 */
  paddingY?: number;
};

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
  /** Lot B3+ : id d'une page interne du même funnel (navigation inter-pages) */
  pageId?: string;
  /** Lot B2 : provider de la popup (internal = FunnelForge, systeme = SIO) */
  popupProvider?: PopupProvider;
  /** Lot B2 : id du popup Systeme.io (ex: "24034535") si popupProvider="systeme" */
  systemePopupId?: string;
  /** 🆕 Lot B4 : icône à droite du label (flèche, etc.) */
  icon?: CtaIcon;
  /** 🆕 Lot B4 : margins/paddings personnalisés */
  spacing?: CtaSpacing;
};

export type ImageMode = "none" | "upload" | "ai-suggested";

export type ImageSize = "sm" | "md" | "lg" | "full" | "custom";

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
  transparentBg?: boolean;
  size?: ImageSize;
  customWidth?: number;
  animation?: ImageAnimation;
  mediaRef?: string;
};

export type SectionBackground = {
  imageUrl?: string;
  overlay?: number;
  position?: "center" | "top" | "bottom" | "left" | "right";
  size?: "cover" | "contain";
};

// ─────────────────────────────────────────────────────────────────────────────
// Lot L — Système d'icônes unifié
// ─────────────────────────────────────────────────────────────────────────────

export type IconName =
  | "check" | "checkCircle" | "badgeCheck" | "thumbsUp"
  | "star" | "sparkles" | "award" | "trophy" | "crown" | "flame"
  | "zap" | "rocket" | "target" | "lightbulb"
  | "shield" | "lock"
  | "clock" | "calendar"
  | "heart" | "gift"
  | "trendingUp" | "trendingDown" | "barChart"
  | "mail" | "user" | "users" | "briefcase" | "settings" | "flag" | "globe" | "play" | "download" | "fileText";

const ICON_NAME_ALIASES: Record<string, IconName> = {
  "check-circle": "checkCircle",
  "badge-check": "badgeCheck",
  "thumbs-up": "thumbsUp",
  "trending-up": "trendingUp",
  "trending-down": "trendingDown",
  "bar-chart": "barChart",
  "file-text": "fileText",
};

export function normalizeIconName(name?: string): IconName {
  if (!name) return "check";
  if (name in ICON_NAME_ALIASES) return ICON_NAME_ALIASES[name];
  return name as IconName;
}

export type IconSize = "sm" | "md" | "lg" | "xl" | "custom";

export const ICON_SIZE_PX: Record<Exclude<IconSize, "custom">, number> = {
  sm: 16, md: 20, lg: 28, xl: 36,
};

export type IconAnimation = "none" | "pulse" | "bounce" | "spin" | "wiggle" | "float";

export type IconConfig = {
  name: IconName;
  size?: IconSize;
  customSizePx?: number;
  animation?: IconAnimation;
  color?: string;
};

export function resolveIconSizePx(config?: IconConfig): number {
  if (!config) return ICON_SIZE_PX.md;
  if (config.size === "custom" && config.customSizePx) {
    return Math.max(8, Math.min(128, config.customSizePx));
  }
  if (config.size && config.size !== "custom") return ICON_SIZE_PX[config.size];
  return ICON_SIZE_PX.md;
}

export type DecorativeIconPosition =
  | "top-left" | "top-center" | "top-right"
  | "before-headline" | "after-headline"
  | "before-cta" | "after-cta"
  | "bottom-left" | "bottom-center" | "bottom-right"
  | "floating-bg";

export type DecorativeIcon = {
  id: string;
  icon: IconConfig;
  position: DecorativeIconPosition;
  label?: string;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Layouts & styles de section (inchangé)
// ─────────────────────────────────────────────────────────────────────────────

export type SectionAlign = "left" | "center" | "right";

export type SectionLayout = "text-only" | "image-only" | "text-image" | "image-text";

export type SectionLayoutVariant =
  | "centered" | "left-aligned"
  | "split-text-image" | "split-image-text"
  | "stacked-card" | "wide-banner"
  | "feature-grid" | "dense-list";

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
  | "none" | "fade-in" | "fade-up" | "fade-down"
  | "slide-left" | "slide-right"
  | "zoom-in" | "zoom-out" | "pulse";

export type AnimationTarget =
  | "eyebrow" | "headline" | "subheadline" | "body"
  | "bullets" | "image" | "video" | "cta";

export type SectionAnimations = Partial<Record<AnimationTarget, AnimationPreset>>;

// ─────────────────────────────────────────────────────────────────────────────
// Items réutilisables (inchangé)
// ─────────────────────────────────────────────────────────────────────────────

export type FaqItem = {
  question: string;
  answer: string;
  icon?: IconConfig;
};

// ─────────────────────────────────────────────────────────────────────────────
// Médias additionnels d'un témoignage (Sprint B2)
// Affichés AU-DESSUS de la citation (preuve sociale visuelle : captures
// d'écran de résultats, vidéo témoignage, etc.). L'avatarUrl reste séparé
// et continue d'identifier l'auteur en bas de la carte.
// ─────────────────────────────────────────────────────────────────────────────

export type TestimonialMediaKind = "image" | "video";

export type TestimonialMedia = {
  id: string;
  kind: TestimonialMediaKind;
  /** URL : image (jpg/png/webp…), vidéo (YouTube/Vimeo/MP4/WebM) */
  url: string;
  /** Texte alternatif (images) ou titre (vidéos) */
  alt?: string;
  /** Poster optionnel pour les vidéos fichier (mp4/webm) */
  posterUrl?: string;
};

export function makeTestimonialMedia(
  kind: TestimonialMediaKind = "image",
): TestimonialMedia {
  return {
    id: `tm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    url: "",
  };
}

export type TestimonialItem = {
  quote: string;
  authorName: string;
  authorRole?: string;
  avatarUrl?: string;
  rating?: number;
  sourceUrl?: string;
  icon?: IconConfig;
  /** 🆕 Sprint B2 : médias additionnels (preuves visuelles) */
  medias?: TestimonialMedia[];
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
  featureIcon?: IconConfig;
};

export type BonusItem = {
  title: string;
  description?: string;
  value?: string;
  iconName?: IconName;
  icon?: IconConfig;
};

export type GuaranteeItem = {
  title: string;
  description?: string;
  iconName?: IconName;
  duration?: string;
  icon?: IconConfig;
};

export type FormFieldType =
  | "text" | "email" | "tel" | "number"
  | "textarea" | "select" | "checkbox";

export type FormFieldItem = {
  name: string;
  label?: string;
  placeholder?: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  width?: "full" | "half";
};

/**
 * 🆕 Lot B2 : configuration globale du formulaire d'une section "form".
 * Stockée sur FunnelSection.formConfig.
 */
export type FormSectionConfig = {
  /** Provider du formulaire : internal (FunnelForge → Supabase) ou systeme (SIO popup) */
  provider: PopupProvider;
  /** Id du popup SIO si provider="systeme" */
  systemePopupId?: string;
  /** Page à laquelle rediriger après soumission réussie */
  redirectToPageId?: string;
  /** URL externe de redirection (fallback si pas de redirectToPageId) */
  redirectToUrl?: string;
  /** Label du bouton submit */
  submitLabel?: string;
  /** Message de succès affiché après soumission */
  successMessage?: string;
};

export type SectionItem =
  | { kind: "faq"; data: FaqItem }
  | { kind: "testimonial"; data: TestimonialItem }
  | { kind: "pricing"; data: PricingPlanItem }
  | { kind: "bonus"; data: BonusItem }
  | { kind: "guarantee"; data: GuaranteeItem }
  | { kind: "formField"; data: FormFieldItem }
  | { kind: "timer"; data: TimerItem };  // 🆕

// ─────────────────────────────────────────────────────────────────────────────
// FunnelSection (inchangé)
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
  /** 🆕 Lot B2 : configuration du formulaire (uniquement si type="form") */
  formConfig?: FormSectionConfig;
  background?: SectionBackground;
  decorativeIcons?: DecorativeIcon[];
};

export type EmailSequenceItem = {
  subject: string;
  html: string;
  text: string;
  cta: CtaConfig;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lot M — Header éditable (inchangé)
// ─────────────────────────────────────────────────────────────────────────────
export type FunnelHeader = {
  enabled?: boolean;
  displayMode?: "logo" | "name" | "both";
  logoUrl?: string;
  brandName?: string;
  cta?: CtaConfig;
  sticky?: boolean;
  transparent?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 LOT B4 — Intégrations externes du funnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intégrations externes définies au niveau du funnel.
 * Permet à plusieurs CTA de partager un même script tiers (ex: Systeme.io).
 */
export interface FunnelIntegrations {
  systemeIoScriptId?: string;
  /** Map pageId → URL publiée sur Systeme.io (pour résolution auto des liens inter‑pages). */
  sioPageUrls?: Record<string, string>;
}


// ─────────────────────────────────────────────────────────────────────────────
// 🆕 LOT B1 — Architecture multi-pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rôle d'une page dans un tunnel.
 * Détermine le copywriting attendu et la structure générée par l'IA.
 */
export type PageRole =
  // Lead Magnet
  | "optin"
  | "thankyou"
  | "delivery"
  // Vente produit digital
  | "sales"
  | "checkout"
  | "upsell"
  | "downsell"
  | "access"
  // Webinar
  | "registration"
  | "confirmation"
  | "replay"
  | "live"
  // Booking / Coaching
  | "landing"
  | "qualification"
  | "booking"
  | "case-studies"
  | "application"
  // Challenge
  | "challenge-landing"
  | "challenge-day"
  // Générique
  | "custom";

/**
 * Une page d'un funnel. Un funnel contient un tableau ordonné de pages.
 * La première page (isHome=true) est la page d'entrée du tunnel.
 */
export type FunnelPage = {
  id: string;
  slug: string;
  name: string;
  role: PageRole;
  sections: FunnelSection[];
  visible: boolean;
  isHome: boolean;
  seo?: {
    title?: string;
    description?: string;
  };
  meta?: {
    iconName?: IconName;
    createdAt?: string;
  };
  /** 🆕 Lot B2 : id de la page suivante dans la chaîne du tunnel */
  nextPageId?: string;
};

/**
 * Funnel — version multi-pages.
 *
 * ⚠️ COMPATIBILITÉ ASCENDANTE :
 * - Le champ `sections` est conservé comme alias deprecated des sections de la
 *   page d'accueil. Tout le code legacy (éditeur, preview, export) qui lit
 *   `funnel.sections` continue de fonctionner.
 * - La fonction `migrateFunnelToMultiPage()` dans funnelStore.ts convertit
 *   automatiquement les anciens funnels (qui ont sections[] mais pas pages[])
 *   au chargement.
 */
export type Funnel = {
  funnelName: string;
  language: Language;

  /**
   * 🆕 Pages du tunnel. Si absent (ancien format), migration auto au load.
   * La première page avec isHome=true est la page d'entrée.
   */
  pages?: FunnelPage[];

  /**
   * @deprecated Utiliser pages[i].sections. Conservé pour rétrocompat :
   * - Lecture : pointe automatiquement vers les sections de la page d'accueil.
   * - Écriture : continue de fonctionner via le store qui synchronise.
   *
   * Sera retiré dans une future version (Lot B3+).
   */
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
    textScale?: number;
    buttonScale?: number;
    customBgEnabled?: boolean;
    customBg?: string;
    animationsEnabled?: boolean;
    buttonAnim?: "lift" | "glow" | "pulse" | "shine";
  };

  defaultCta?: CtaConfig;

  header?: FunnelHeader;

  /**
   * 🆕 Lot B2bis : bibliothèque centralisée des médias du funnel.
   * Les sections référencent ces items via `section.image.mediaRef`.
   * Peuplée à partir de `brief.medias` lors de la génération IA, puis
   * utilisée par le renderer (FunnelPreview) pour résoudre les URLs.
   */
  media?: MediaItem[];

  /**
   * 🆕 Lot B4 : intégrations externes (Systeme.io, etc.).
   * Permet de stocker des configurations partagées entre plusieurs CTA.
   */
  integrations?: FunnelIntegrations;

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
    /** 🆕 Version du schéma de données (pour migrations futures) */
    schemaVersion?: number;
  };
};

/** Version actuelle du schéma Funnel (incrémentée à chaque migration majeure) */
export const FUNNEL_SCHEMA_VERSION = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers multi-pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un id de page unique et stable.
 */
export function makePageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `page_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Retourne la page d'accueil d'un funnel.
 * - Si pages[] existe : retourne celle avec isHome=true, ou la première.
 * - Si pages[] absent (ancien format) : retourne undefined.
 */
export function getHomePage(funnel: Funnel): FunnelPage | undefined {
  if (!funnel.pages || funnel.pages.length === 0) return undefined;
  return funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
}

/**
 * Retourne les sections de la page d'accueil (ou sections legacy si pas de pages).
 * Utilisé par le code qui n'est pas encore migré au multi-pages.
 */
export function getHomeSections(funnel: Funnel): FunnelSection[] {
  const home = getHomePage(funnel);
  if (home) return home.sections;
  return funnel.sections ?? [];
}

/**
 * Retourne une page par son id, ou undefined.
 */
export function getPageById(funnel: Funnel, pageId: string): FunnelPage | undefined {
  return funnel.pages?.find((p) => p.id === pageId);
}

/**
 * Retourne une page par son slug, ou undefined.
 */
export function getPageBySlug(funnel: Funnel, slug: string): FunnelPage | undefined {
  return funnel.pages?.find((p) => p.slug === slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 du wizard simplifié — Médias & copywriting (inchangé)
// ─────────────────────────────────────────────────────────────────────────────

export type MediaKind = "image" | "video";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  description?: string;
  sectionHint?: FunnelSectionType;
  alt?: string;
  fileName?: string;
};

export type CopywritingTone =
  | "direct" | "empathique" | "storytelling"
  | "expert" | "amical" | "premium";

export type CopywritingLength = "concise" | "balanced" | "detailed";

export type CopywritingPrefs = {
  tone?: CopywritingTone;
  length?: CopywritingLength;
  exampleSentence?: string;
  avoidWords?: string[];
};

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
  medias?: MediaItem[];
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
  headlineWeight: 400 | 500 | 600 | 700 | 800 | 900;
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
  customizable?: boolean;
};

export type TunnelGroupKind =
  | "lead-magnet" | "vsl" | "formation" | "webinar"
  | "service-booking" | "digital-product" | "custom";

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
// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Timer — Compte à rebours / Places restantes (insérable dans toute section)
// ─────────────────────────────────────────────────────────────────────────────

export type TimerMode =
  | "countdown-duration"   // Durée fixe par visiteur (ex: 24h dès l'arrivée)
  | "countdown-date"       // Compte à rebours vers une date précise
  | "seats-counter";       // Compteur de places restantes (statique)

export type TimerStyle = "digital" | "cards" | "inline";

export type TimerSize = "sm" | "md" | "lg" | "xl";

export type TimerExpireBehavior = "hide" | "show-message" | "keep-zero";

export type TimerItem = {
  id: string;
  mode: TimerMode;

  /** countdown-duration : durée en heures (ex: 24, 48, 72) */
  durationHours?: number;

  /** countdown-date : date cible ISO (ex: "2026-06-15T18:00:00Z") */
  targetDate?: string;

  /** seats-counter : nombre total et restant de places */
  seatsTotal?: number;
  seatsRemaining?: number;

  /** Étiquette au-dessus du timer */
  label?: string;
  /** Message à afficher après expiration */
  expiredMessage?: string;

  /** Présentation visuelle */
  style?: TimerStyle;          // digital | cards | inline (défaut: cards)
  size?: TimerSize;            // sm | md | lg | xl (défaut: md)
  color?: string;              // hex (défaut: var(--ff-accent))
  backgroundColor?: string;    // hex optionnel pour fond du timer

  /** Comportement à expiration (défaut: keep-zero) */
  onExpire?: TimerExpireBehavior;

  /** Afficher les jours en plus de h/m/s (défaut: false) */
  showDays?: boolean;

  /** Labels personnalisés (défaut: J/H/M/S) */
  labels?: {
    days?: string;
    hours?: string;
    minutes?: string;
    seconds?: string;
  };
};

export const DEFAULT_TIMER_LABELS = {
  fr: { days: "Jours", hours: "Heures", minutes: "Minutes", seconds: "Secondes" },
  en: { days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds" },
  es: { days: "Días", hours: "Horas", minutes: "Minutos", seconds: "Segundos" },
} as const;

export function makeDefaultTimer(): TimerItem {
  return {
    id: `timer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    mode: "countdown-duration",
    durationHours: 24,
    label: "Offre expire dans",
    expiredMessage: "Offre terminée",
    style: "cards",
    size: "md",
    onExpire: "keep-zero",
    showDays: false,
  };
}
