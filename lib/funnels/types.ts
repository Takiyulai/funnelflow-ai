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

export type CreationMode = "guided" | "free" | "express";

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
  | "testimonials"
  // 🆕 Sous-étape C : sections direct-response distinctes
  | "agitation" // amplification de la douleur (suite du "problem")
  | "urgency" // urgence / rareté légitime, juste avant le CTA final
  |"raw-html";
  

export type CtaMode = "anchor" | "redirect" | "popup";

/**
 * Provider de popup pour un CTA en mode "popup".
 * - "internal" : popup FunnelForge intégrée, lead envoyé vers /api/leads (Supabase).
 * - "systeme"  : popup native Systeme.io, ouverte via la classe systeme-show-popup-<id>.
 */
export type PopupProvider = "internal" | "systeme" | "embed";


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
  /** @deprecated */
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
   /** Message de réassurance affiché sous le formulaire popup (RGPD, sécurité, etc.). */
  popupReassurance?: string;
  /** 🆕 Chariow Niveau 2 : true si l'URL de redirection est un LIEN PRODUIT
   *  Chariow (paiement + livraison gérés par Chariow). Conséquence : AutoFunnel
   *  n'envoie PAS d'email de livraison produit pour ce tunnel. */
  chariow?: boolean;
  /** 🆕 Champs personnalisés du popup interne. Si absent → fallback nom+email. */
  popupFields?: FormFieldItem[];
  /** 🆕 Code HTML d'un formulaire externe (si popupProvider="embed"). Rendu en iframe sandboxée. */
  popupEmbedHtml?: string;
  /** 🆕 Tags CRM appliqués automatiquement aux leads capturés via ce popup interne. */
  captureTags?: string[];
  /** 🆕 Action INDIVIDUELLE : si true, ce CTA garde SON action propre et n'est
   *  PAS remplacé par l'« action commune des boutons » (funnel.meta
   *  .applyDefaultCtaToAll), même sur la page d'accueil. Permet de personnaliser
   *  un bouton précis tout en gardant l'action commune sur les autres. */
  ignoreGlobalCta?: boolean;
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
  /** URL de l'image (data:, idb-media://, https://) */
  imageUrl?: string;
  /** Référence IndexedDB explicite */
  mediaRef?: string;

  /** Couleur du voile par-dessus l'image. Défaut "#000000" */
  overlayColor?: string;
  /** Opacité du voile, 0-100. Défaut 0. Source de vérité moderne. */
  overlayOpacity?: number;
  /** Legacy : alpha 0-1 (compatibilité ascendante avec l'existant) */
  overlay?: number;

  /** Position de l'image. Défaut "center" */
  position?: "center" | "top" | "bottom" | "left" | "right";
  /** Taille de l'image. Défaut "cover" */
  size?: "cover" | "contain" | "auto";
  /** Comportement au scroll. "fixed" = parallaxe. Défaut "scroll" */
  attachment?: "scroll" | "fixed";
  /** Flou appliqué à l'image, 0-20px. Défaut 0 */
  blur?: number;
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
  /** 🆕 Affiche les puces/cartes numérotées (1, 2, 3…) au lieu d'icônes. */
  numberedBullets?: boolean;
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

/**
 * 🆕 LOT 10 — Order bump : produit complémentaire proposé par case à cocher
 * au moment du paiement (page de commande / checkout d'un produit digital).
 * Stocké au niveau de la PAGE (et non d'une section) car il s'applique à
 * TOUTE la page de checkout, indépendamment de ses sections pricing/offer.
 */
export type OrderBumpConfig = {
  enabled: boolean;
  name: string;
  price: string;
  description?: string;
};

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
  /** 🆕 Tags CRM appliqués automatiquement aux leads qui soumettent ce formulaire. */
  captureTags?: string[];
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
// Édition des sections raw-html (clonage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Patches appliqués à la volée sur le HTML cloné d'une section raw-html.
 * Les patches sont indexés par ID stable (chemin DOM) calculé par
 * lib/clone/raw-html-editable.ts.
 *
 * Avantages :
 *  - Réversible (on garde le HTML original intact)
 *  - Léger (quelques Ko vs 90 Ko de HTML)
 *  - Compatible undo/redo (un patch = un Partial<FunnelSection>)
 */
/**
 * Patches appliqués à la volée sur le HTML cloné d'une section raw-html.
 * Les patches sont indexés par ID stable calculé par
 * lib/clone/raw-html-editable.ts (t-N pour texts, a-N pour links, img-N pour images).
 *
 * Avantages :
 *  - Réversible (on garde le HTML original intact)
 *  - Léger (quelques Ko vs 90 Ko de HTML)
 *  - Compatible undo/redo (un patch = un Partial<FunnelSection>)
 */
export type RawHtmlBackgroundMode = "color" | "image" | "none" | "original";

export interface RawHtmlBackgroundPatch {
  /**
   * - "original" (ou absent) : ne touche à rien, on garde le fond cloné
   * - "color"    : applique une couleur unie (background.color)
   * - "image"    : applique une image (background.imageUrl) + overlay optionnel
   * - "none"     : supprime tout fond (transparent)
   */
  mode: RawHtmlBackgroundMode;
  color?: string;                 // ex: "#0a0a0a" ou "rgb(10,10,10)"
  imageUrl?: string;              // URL absolue (Supabase, CDN…)
  overlayColor?: string;          // ex: "#000000"
  overlayOpacity?: number;        // 0 → 100
  position?: "center" | "top" | "bottom" | "left" | "right";
  size?: "cover" | "contain" | "auto";
  attachment?: "scroll" | "fixed";
}

export interface RawHtmlPatch {
  texts?: Record<string, string>;
  links?: Record<string, { href?: string; label?: string }>;
  /**
   * 🆕 Phase 1B : `mediaType` permet de CONVERTIR un média (ex : remplacer une
   * image — y compris un GIF animé — par une vraie vidéo `<video>` ou un embed
   * `<iframe>`). Si absent, le type d'origine de l'élément est conservé.
   */
  images?: Record<
    string,
    { src?: string; alt?: string; mediaType?: "image" | "video" | "embed" }
  >;
  colors?: Record<string, string>;
  background?: RawHtmlBackgroundPatch;
}



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
  /** 🆕 CTA secondaire rendu en lien discret sous le CTA principal. Sert
   *  notamment au « Non merci, continuer » des pages OTO (upsell/downsell). */
  secondaryCta?: CtaConfig;
  /** 🆕 Liens/CTA supplémentaires (ex : rejoindre WhatsApp, Telegram, Instagram…
   *  sur la page de remerciement). Rendus en rangée de boutons secondaires,
   *  sous le CTA principal. Chaque entrée réutilise CtaConfig (généralement
   *  mode "redirect" + url externe) mais est indépendante de `cta`. */
  ctas?: CtaConfig[];
  image?: SectionImage;
  video?: VideoSource;
  bulletIcons?: IconName[];
  iconName?: IconName;
  iconSize?: IconSize;
  iconAnimation?: IconAnimation;
  visible?: boolean;
  style?: SectionStyle;
  layoutVariant?: SectionLayoutVariant;
  /** 🆕 Pattern visuel de la section (ex. "problem-checklist", "process-timeline",
   *  "stats-cards"). Choisi par le générateur (sélection semi-aléatoire par
   *  famille). Lu par le renderer → attribut data-ff-pattern → CSS funnel-theme. */
  pattern?: string;
  animations?: SectionAnimations;
  visualDirection?: string;
  items?: SectionItem[];
  /** 🆕 Lot B2 : configuration du formulaire (uniquement si type="form") */
  formConfig?: FormSectionConfig;
  background?: SectionBackground;
  decorativeIcons?: DecorativeIcon[];
  reassurance?: string;
  /** Patches d'édition pour les sections de type "raw-html" uniquement. */
  rawHtmlPatches?: RawHtmlPatch;
};

/** Message de réassurance par défaut affiché sous les formulaires (popup et section form). */
export const DEFAULT_REASSURANCE = "🔒 Vos coordonnées sont en sécurité, jamais partagées";

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
  /** 🆕 Si true, le header est aussi affiché sur les pages secondaires.
   *  Par défaut false : header visible uniquement sur la page d'accueil. */
  showOnSecondaryPages?: boolean;
  /** 🆕 Date/heure ISO du webinaire (mode Live uniquement — jamais en
   *  Evergreen, pas de date commune). Posée par applyWebinarSchedule.
   *  Affichée en clair et animée au centre du header sticky. */
  eventDateTime?: string;
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
  // 🆕 LOT 8 — VSL (Video Sales Letter) optionnelle, avant la candidature
  // (coaching high ticket). Réutilisable ailleurs si besoin.
  | "vsl"
  // Challenge
  | "challenge-landing"
  | "challenge-day"
  // 🆕 LOT 3 — Page OTO/tripwire GÉNÉRIQUE, réutilisable par TOUS les types de
  // tunnels (optionnelle, cochable dans le wizard). Distincte de upsell/downsell
  // (spécifiques au parcours "digital-product" post-achat) : "oto" peut
  // s'insérer n'importe où (ex. juste après l'optin d'un lead magnet).
  | "oto"
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
  /** 🆕 LOT 10 — Order bump affiché sur cette page (checkout uniquement en
   *  pratique, mais réutilisable ailleurs si besoin). */
  orderBump?: OrderBumpConfig;
  /** 🆕 LOT 7 — Embed calendrier natif (Calendly/Cal.com) sur la page de
   *  prise de RDV (rôle "booking"). */
  calendarEmbedUrl?: string;
  /** 🆕 LOT 9 — Position de cette page dans la séquence multi-jours d'un
   *  challenge (1-based) + nombre total de jours. Uniquement sur les pages de
   *  rôle "challenge-day". Sert à l'onglet Emails pour générer la séquence
   *  quotidienne (email "Jour N" par page). */
  dayIndex?: number;
  dayTotal?: number;
  /** 🆕 LOT 5 — URL de la vidéo pré-enregistrée du webinaire Evergreen (posée
   *  sur la page de rôle "live", qui devient alors un lecteur evergreen avec
   *  choix de créneau au lieu de la salle d'attente classique). */
  evergreenVideoUrl?: string;
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
    /** 🆕 4ᵉ couleur de marque optionnelle (prix, éléments spéciaux). */
    accentColor2?: string;
    style: string;
    textScale?: number;
    buttonScale?: number;
    customBgEnabled?: boolean;
    customBg?: string;
    animationsEnabled?: boolean;
    buttonAnim?: "lift" | "glow" | "pulse" | "shine";
    /** 🆕 true UNIQUEMENT si l'utilisateur a explicitement activé « Utiliser
     *  les couleurs de ma marque » (brief.brandColorsEnabled) — distinct du
     *  fait que primaryColor/secondaryColor/accentColor aient une valeur (ils
     *  en ont TOUJOURS une, invention IA ou défaut du wizard). Sert de garde :
     *  FunnelPreview/TemplateThemeProvider ne recolorent le fond/les cartes/le
     *  header-footer QUE si ce flag est true — sinon le template garde son
     *  identité visuelle par défaut intacte (fonds dégradés, accents propres). */
    brandColorsEnabled?: boolean;
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

  /**
   * 🆕 Paiement (Stripe Connect) au niveau tunnel.
   * - currency : devise forcée (sinon déduite du symbole du prix). 'eur'|'usd'|'gbp'.
   * - postPurchaseUrl : redirection personnalisée après paiement. Vide = défaut
   *   (page suivante du tunnel via le chaînage, qui aboutit au « merci » auto).
   */
  payment?: {
    currency?: string;
    postPurchaseUrl?: string;
  };

  /**
   * 🆕 VAGUE 1 / LOT 4 — Pixels publicitaires du tunnel. L'utilisateur colle
   * simplement ses identifiants ; les scripts sont injectés UNIQUEMENT sur les
   * pages publiées (`PublishedFunnelView`), jamais dans le dashboard/éditeur.
   * Les identifiants sont validés par format strict avant toute injection
   * (cf. components/funnel/TrackingPixels.tsx) — aucun script arbitraire.
   */
  tracking?: {
    /** Meta (Facebook) Pixel ID — numérique, ex. "1234567890123456". */
    metaPixelId?: string;
    /** Google Analytics 4 — format "G-XXXXXXXXXX". */
    ga4Id?: string;
    /** Google Tag Manager — format "GTM-XXXXXXX". */
    gtmId?: string;
    /** TikTok Pixel ID — alphanumérique, ex. "C9XXXXXXXXXXXXXXXX". */
    tiktokPixelId?: string;
  };

  /**
   * 🆕 VAGUE CUSTOM-CODE — Code personnalisé injecté sur les pages PUBLIÉES du
   * tunnel (jamais dashboard/éditeur/preview). ⚠️ SENSIBLE : exécuté tel quel
   * chez les visiteurs, sous la responsabilité de l'utilisateur. Réservé au
   * plan Agency — contrôle fait CÔTÉ SERVEUR au rendu (lib/funnels/customCode.ts),
   * pas seulement en UI : un compte non-Agency qui écrirait ce champ à la main
   * ne verra jamais son code injecté. Audit en base via trigger
   * (db/custom-code-audit.sql). Kill switch global : env CUSTOM_CODE_DISABLED.
   */
  customCode?: {
    /** Injecté tout en HAUT de la page (exécuté avant le contenu). */
    head?: string;
    /** Injecté tout en BAS de la page (fin de body). */
    body?: string;
  };
  // NB : la taille max d'une zone est MAX_CUSTOM_CODE_LEN (exportée plus bas,
  // ici dans types.ts pour rester importable côté CLIENT sans tirer le module
  // serveur lib/funnels/customCode.ts).

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
    /**
     * 🆕 Email de livraison/bienvenue conditionnel envoyé au lead à la capture.
     * UNIQUEMENT si `enabled` ET au moins un objet/corps : jamais de générique
     * par défaut. Envoyé via la file `scheduled_emails` (source_type='delivery').
     */
    deliveryEmail?: {
      enabled: boolean;
      subject: string;
      body: string;
      /** Lien optionnel (PDF, accès…) ajouté en bas de l'email. */
      attachmentUrl?: string;
    };
    /** 🆕 Version du schéma de données (pour migrations futures) */
    schemaVersion?: number;
    /**
     * 🆕 Variante de pied de page : "footer-minimal-centered" (défaut),
     * "footer-grid-sitemap" ou "footer-cta-newsletter". Choisie de façon seedée
     * par le générateur, rendue par components/funnel/FunnelFooter.tsx.
     */
    footerVariant?: string;
    /**
     * 🆕 Canaux communautaires affichés sur les pages de SUCCÈS
     * (merci/confirmation/livraison) : boutons « Rejoindre WhatsApp /
     * Telegram » + CTA optionnel vers une autre destination.
     */
    socialChannels?: {
      whatsapp?: string;
      telegram?: string;
      ctaLabel?: string;
      ctaUrl?: string;
    };
    /**
     * 🆕 Bouton « étape suivante » auto-généré sur les pages de succès
     * (confirmation/merci/livraison) qui pointe vers la page suivante du tunnel.
     * `hideNextStepCta` le masque (l'utilisateur ne pouvait ni l'éditer ni le
     * supprimer depuis l'éditeur) ; `nextStepLabel` remplace son libellé.
     */
    hideNextStepCta?: boolean;
    nextStepLabel?: string;
    /**
     * 🆕 Action CTA COMMUNE : si true, TOUS les boutons principaux de la page
     * (hero, urgence, CTA final, offre…) utilisent l'action de `funnel.defaultCta`
     * (popup interne / ancre / redirection) au lieu de leur action individuelle.
     * Le libellé de chaque bouton reste le sien. Les boutons secondaires
     * (canaux WhatsApp, etc.) ne sont pas affectés. Voir resolveCtaWithGlobal().
     */
    applyDefaultCtaToAll?: boolean;
  };
};

/** Version actuelle du schéma Funnel (incrémentée à chaque migration majeure) */
export const FUNNEL_SCHEMA_VERSION = 2;

/** 🆕 VAGUE CUSTOM-CODE — Taille max (caractères) d'une zone de code
 *  personnalisé (head OU body). Au-delà : zone ignorée au rendu public et
 *  signalée en rouge dans l'éditeur. Exportée depuis types.ts (client-safe). */
export const MAX_CUSTOM_CODE_LEN = 20000;

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
  /** 🆕 Offres OTO (optionnelles). Si VIDES, les pages upsell/downsell ne sont
   *  PAS générées. La description dit À L'IA ce qu'est l'offre (sinon générique),
   *  le prix fixe le montant (sinon l'IA l'invente). */
  upsellPrice?: string;
  downsellPrice?: string;
  upsellOffer?: string;
  downsellOffer?: string;
  /** 🆕 LOT 10 — Order bump (optionnel) : produit complémentaire proposé par
   *  case à cocher sur la page de commande (checkout). Vide → pas d'order bump. */
  orderBumpName?: string;
  orderBumpPrice?: string;
  orderBumpDescription?: string;
  /** 🆕 LOT 7 — URL d'embed calendrier natif (Calendly/Cal.com) affiché
   *  directement sur la page de prise de RDV. Vide → repli sur le formulaire
   *  de contact classique (comportement historique, rétro-compatible). */
  calendarEmbedUrl?: string;
  /** 🆕 LOT 9 — Nombre de jours du challenge (génère autant de pages
   *  "jour-1"..."jour-N"). Défaut : 5 si non renseigné. */
  challengeDays?: number;
  /** 🆕 Offre de la page OTO/tripwire GÉNÉRIQUE ("oto", cochable dans l'aperçu
   *  du wizard sur TOUS les types de tunnel). Si vide, l'IA invente le nom, le
   *  prix ET la promesse de cette offre — comportement à éviter : renseigner
   *  ces 3 champs quand la page "oto" est cochée dans `selectedOptionalPages`. */
  otoOfferName?: string;
  otoPrice?: string;
  otoPromise?: string;
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
  /** Express IA : description complète de l'activité saisie par l'utilisateur. */
  businessPrompt?: string;
  /**
   * @deprecated Le nombre de pages est désormais EXPLICITE dans le type de
   * tunnel choisi (blueprint complet). Conservé en lecture pour rétrocompat.
   */
  pageCount?: number;
  /** 🆕 Webinaire : date + heure de la session (ISO, ex "2026-07-16T19:00").
   *  Alimente le compte à rebours de la section urgency + le copywriting. */
  webinarDate?: string;
  /** 🆕 Webinaire : message d'urgence/rareté saisi par l'utilisateur
   *  (ex "Places limitées à 200 participants"). */
  webinarUrgency?: string;
  /** 🆕 LOT 4 — Lien externe du webinaire (Zoom/YouTube/Meet), affiché sur la
   *  salle d'attente/live le jour J et exposé au contexte des emails
   *  (rappels + rappel de connexion). */
  webinarExternalLink?: string;
  /** 🆕 LOT 4 — Durée (en heures) pendant laquelle le replay reste accessible
   *  après le webinaire, avant expiration automatique. Défaut : 72h. */
  replayExpiryHours?: number;
  /** 🆕 LOT 5 — Mode du webinaire : "live" (date unique, défaut) ou
   *  "evergreen" (créneaux automatisés, vidéo pré-enregistrée). */
  webinarMode?: "live" | "evergreen";
  /** 🆕 LOT 5 — Evergreen UNIQUEMENT : URL de la vidéo pré-enregistrée
   *  (YouTube/Vimeo/mp4) diffusée sur la page "live" après le créneau choisi
   *  par le prospect. */
  evergreenVideoUrl?: string;
  /** 🆕 LOT 5 — Evergreen UNIQUEMENT : durée (en heures) de l'offre spéciale
   *  APRÈS l'inscription de CHAQUE prospect (pas une date fixe). Défaut 24h. */
  evergreenOfferHours?: number;
  /** 🆕 Webinaire — DOUBLE OFFRE : pour `funnelKind === "webinar"`,
   *  `offerName`/`price`/`promise` (champs génériques ci-dessus) désignent
   *  désormais LE WEBINAIRE LUI-MÊME (titre/prix — généralement "Gratuit" —
   *  /promesse affichés sur la page d'inscription). L'offre vendue APRÈS le
   *  webinaire (page de vente/checkout) utilise ces champs dédiés. Si vides,
   *  l'IA se rabat sur `offerName`/`price`/`promise` (rétrocompat / anciens
   *  tunnels générés avant ce correctif). Pour TOUS les autres types de
   *  tunnel, ces champs post-webinaire sont ignorés (comportement inchangé). */
  postWebinarOfferName?: string;
  postWebinarPrice?: string;
  postWebinarPromise?: string;
  templateId?: string;
  moodId?: MoodId;
  mainColor?: string;
  secondaryColor?: string;
  /** 🆕 Branding : si true, le tunnel généré prend les couleurs de
   *  `brandColors` (au choix du template) au lieu de la palette par défaut
   *  du template. */
  brandColorsEnabled?: boolean;
  /** 🆕 Couleurs de marque saisies par l'utilisateur (1 à 4 hex), appliquées
   *  dans l'ordre à design.primaryColor / secondaryColor / accentColor /
   *  accentColor2. Distinct de mainColor/secondaryColor (qui alimentent
   *  l'étape "Ambiance"/Mood, non liée au branding). */
  brandColors?: string[];
  logoUrl?: string;
  videoUrl?: string;
  aboutText?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  ctaTarget?: "_self" | "_blank";
  /** 🆕 Palier 1 paiement : lien de paiement externe de l'offre (Stripe Payment
   *  Link, page de paiement systeme.io, etc.). Si renseigné sur une offre
   *  payante, le CTA de la section pricing redirige vers ce lien. */
  paymentUrl?: string;
  medias?: MediaItem[];
  copywritingPrefs?: CopywritingPrefs;
  /** 🆕 LOT 3 — Rôles des pages OPTIONNELLES cochées par l'utilisateur dans
   *  l'aperçu "pages générées" du wizard (ex. "oto"). Une page optionnelle du
   *  blueprint n'est générée QUE si son rôle figure dans cette liste. Absent/
   *  vide = aucune page optionnelle générée (comportement rétrocompatible). */
  selectedOptionalPages?: PageRole[];
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
  | "countdown-duration"   // Durée fixe par visiteur (ex: 24h dès l'arrivée sur CETTE page)
  | "countdown-date"       // Compte à rebours vers une date précise
  | "seats-counter"        // Compteur de places restantes (statique)
  // 🆕 LOT 5 — Webinaire Evergreen : durée fixe (durationHours) mais calculée
  // depuis l'INSCRIPTION du prospect (localStorage posé par FormRenderer à la
  // soumission), PARTAGÉE entre toutes les pages du tunnel (contrairement à
  // "countdown-duration" qui est scopé par page). Ne dépend d'AUCUNE date fixe.
  | "countdown-since-registration";

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
