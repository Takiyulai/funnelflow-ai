// lib/ai/generate.ts
import { z } from "zod";
import type {
  Funnel,
  FunnelBrief,
  FunnelSection,
  FunnelSectionType,
  FunnelPage,
  FunnelHeader,
  PageRole,
  BonusItem,
  GuaranteeItem,
  CtaConfig,
  SectionItem,
  Language,
  IconName,
  FunnelKind,
  MediaItem,
  SectionImage,
  VideoSource,
} from "@/lib/funnels/types";
import { makeAnchorCta, normalizeIconName } from "@/lib/funnels/types";
import {
  completeFunnelPrompt,
  mainPagePrompt,
  secondaryPagesPrompt,
  type MediaInput,
} from "./prompts";
import { getMood } from "@/lib/funnels/moods";
import {
  PREMIUM_TEMPLATES,
  DEFAULT_PREMIUM_TEMPLATE_ID,
  getPremiumTemplate,
} from "@/lib/funnels/templates";
import {
  applyTemplateToFunnel,
  getTemplateSectionTypes,
} from "@/lib/funnels/applyTemplate";
import {
  buildPagesFromBlueprints,
  chainPagesNavigation,
  filterSectionsByBlueprint,
} from "@/lib/funnels/pageGenerator";
import { normalizeFunnelKind } from "@/lib/funnels/kinds";
import {
  getFunnelBlueprint,
  getPageBlueprint,
  getHeroMediaPolicy,
  getAllowedSectionTypes,
  sectionTypeAcceptsImage,
  sectionTypeAcceptsAvatars,
  sectionTypeAcceptsVideo,
} from "@/lib/funnels/pageCatalogs";
import { removeOrFillEmptySections } from "@/lib/funnels/sectionFillers";

/* ================================================================== */
/*  Helper : rôle d'accueil par type de tunnel                        */
/* ================================================================== */

function getHomeRoleForKind(kind: FunnelKind): PageRole {
  switch (kind) {
    case "lead-magnet":
      return "optin";
    case "webinar":
      return "registration";
    case "digital-product":
    case "vsl":
    case "formation":
    case "saas":
      return "sales";
    case "booking":
    case "service":
      return "landing";
    case "coaching-high-ticket":
      return "application";
    case "challenge":
      return "challenge-landing";
    case "thank-you":
      return "thankyou";
    default:
      return "optin";
  }
}

/* ================================================================== */
/*  Helper : détection du provider vidéo                              */
/* ================================================================== */

function detectVideoProvider(url: string): VideoSource["provider"] {
  const u = (url || "").toLowerCase();
  if (/youtube\.com|youtu\.be/i.test(u)) return "youtube";
  if (/vimeo\.com/i.test(u)) return "vimeo";
  if (/\.(mp4|webm|mov)$/i.test(u)) return "upload";
  return "url";
}

/* ================================================================== */
/*  PLACEMENT DÉTERMINISTE DES MÉDIAS                                  */
/* ================================================================== */

const MEDIA_KEYWORD_MAP: Array<{ section: FunnelSectionType; keywords: RegExp }> = [
  {
    section: "testimonials",
    keywords:
      /\b(t[ée]moignage|avis client|review|testimonial|screenshot|capture\s*d['e]?\s*[ée]cran|client|customer|rese[ñn]a|testimonio|opini[oó]n)\b/i,
  },
  {
    section: "about",
    keywords:
      /\b(coach|fondateur|founder|about\s*me|[àa]\s*propos|portrait|photo\s*de\s*moi|profile|profil|equipo|sobre\s*m[ií]|biographie|bio)\b/i,
  },
  {
    section: "pricing",
    keywords:
      /\b(produit|product|mockup|couverture|cover|packaging|box|formation|produkt|producto)\b/i,
  },
  {
    section: "video",
    keywords:
      /\b(d[ée]mo|demo|walkthrough|tutoriel|tutorial|pr[ée]sentation|presentation|vsl|sales\s*video|preview|extrait)\b/i,
  },
  {
    section: "proof",
    keywords:
      /\b(r[ée]sultat|result|chiffre|graphique|graph|dashboard|tableau\s*de\s*bord|stats|m[ée]trique|metric|resultado|estad[ií]stica)\b/i,
  },
];

function detectSectionFromKeywords(media: MediaItem): FunnelSectionType | null {
  const haystack = [
    media.description || "",
    media.alt || "",
    media.fileName || "",
  ]
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return null;

  for (const rule of MEDIA_KEYWORD_MAP) {
    if (rule.keywords.test(haystack)) return rule.section;
  }
  return null;
}

function fallbackSectionByKind(kind: "image" | "video"): FunnelSectionType {
  return kind === "video" ? "video" : "about";
}

export function placeMediasIntoSections(
  sections: FunnelSection[],
  medias: MediaItem[] | undefined,
  opts: { funnelKind: FunnelKind; role: PageRole },
): FunnelSection[] {
  if (!medias || medias.length === 0) return sections;

  const allowed = getAllowedSectionTypes(opts.funnelKind, opts.role);
  const result: FunnelSection[] = sections.map((s) => ({ ...s }));

  const alreadyPlaced = new Set<string>();
  for (const s of result) {
    const ref = extractMediaRef(s);
    if (ref) alreadyPlaced.add(ref);
  }

  // Index par id pour résoudre les placeholders [uploaded-xxx] générés par l'IA
  const mediasById = new Map<string, MediaItem>();
  for (const m of medias) {
    if (m.id) mediasById.set(m.id, m);
  }

  // ─── PASS 1 : remplacer les placeholders [uploaded-id] par les vrais médias
  for (const section of result) {
    const placeholderImg =
      extractPlaceholderId(section.image?.url) ??
      extractPlaceholderId(section.image?.mediaRef);
    if (placeholderImg) {
      const real = mediasById.get(placeholderImg);
      if (real) {
        attachMediaToSection(section, real);
        alreadyPlaced.add(real.id || real.url || placeholderImg);
        continue;
      }
    }
    const placeholderVideo = extractPlaceholderId(section.video?.url);
    if (placeholderVideo) {
      const real = mediasById.get(placeholderVideo);
      if (real) {
        attachMediaToSection(section, real);
        alreadyPlaced.add(real.id || real.url || placeholderVideo);
      }
    }

    // PASS 1bis : résoudre les avatarUrl des testimonial items
    if (section.type === "testimonials" && Array.isArray(section.items)) {
      for (const item of section.items) {
        if (item.kind !== "testimonial") continue;
        const placeholderAvatar = extractPlaceholderId(item.data.avatarUrl);
        if (placeholderAvatar) {
          const real = mediasById.get(placeholderAvatar);
          if (real && real.url) {
            item.data.avatarUrl = real.url;
            alreadyPlaced.add(real.id || real.url);
          }
        }
      }
    }
  }

  // ─── PASS 2 : médias non placés → sectionHint ou keyword detection
  for (const media of medias) {
    const ref = media.id || media.url;
    if (!ref || alreadyPlaced.has(ref)) continue;

    let targetType: FunnelSectionType =
      (media.sectionHint as FunnelSectionType | undefined) ||
      detectSectionFromKeywords(media) ||
      fallbackSectionByKind(media.kind || "image");

    if (allowed && !allowed.includes(targetType)) {
      // Si la cible était "testimonials" mais qu'elle n'est pas autorisée,
      // on PERD le média plutôt que de le déplacer ailleurs.
      if (targetType === "testimonials") {
        console.warn(
          `[placeMediasIntoSections] Média testimonial ignoré : aucune section testimonials autorisée pour role=${opts.role}`,
        );
        continue;
      }
      targetType = pickFallbackAllowedSection(media, allowed);
    }

    const existing = result.find(
      (s) => s.type === targetType && !hasMediaAttached(s),
    );

    if (existing) {
      attachMediaToSection(existing, media);
      alreadyPlaced.add(ref);
    } else {
      if (targetType === "testimonials") {
        console.warn(
          `[placeMediasIntoSections] Média testimonial ignoré : section testimonials déjà saturée`,
        );
        continue;
      }
      const newSection = createSectionWithMedia(targetType, media);
      const heroIdx = result.findIndex((s) => s.type === "hero");
      if (heroIdx >= 0) {
        result.splice(heroIdx + 1, 0, newSection);
      } else {
        result.push(newSection);
      }
      alreadyPlaced.add(ref);
    }
  }

  // ─── PASS 3 : distribuer les images restantes sur les avatars testimonials
  const unplacedImages = medias.filter(
    (m) =>
      (m.kind || "image") === "image" &&
      m.url &&
      !alreadyPlaced.has(m.id || m.url),
  );
  if (unplacedImages.length > 0) {
    for (const section of result) {
      if (!sectionTypeAcceptsAvatars(section.type)) continue;
      if (!Array.isArray(section.items) || section.items.length === 0) continue;
      let imgIdx = 0;
      for (const item of section.items) {
        if (item.kind !== "testimonial") continue;
        if (item.data.avatarUrl && !extractPlaceholderId(item.data.avatarUrl)) continue;
        if (imgIdx >= unplacedImages.length) break;
        const img = unplacedImages[imgIdx];
        item.data.avatarUrl = img.url;
        alreadyPlaced.add(img.id || img.url);
        imgIdx++;
      }
      if (imgIdx >= unplacedImages.length) break;
    }
  }

  // ─── PASS 4 : images restantes → section "about" ou autre section acceptant une image
  for (const media of medias) {
    if ((media.kind || "image") !== "image") continue;
    const ref = media.id || media.url;
    if (!ref || alreadyPlaced.has(ref)) continue;

    // Priorité 1 : section "about" sans image
    const aboutSection = result.find(
      (s) => s.type === "about" && !s.image?.url,
    );
    if (aboutSection) {
      attachMediaToSection(aboutSection, media);
      alreadyPlaced.add(ref);
      continue;
    }

    // Priorité 2 : n'importe quelle section qui accepte une image (sauf hero)
    const target = result.find(
      (s) =>
        sectionTypeAcceptsImage(s.type) &&
        s.type !== "hero" &&
        !s.image?.url,
    );
    if (target) {
      attachMediaToSection(target, media);
      alreadyPlaced.add(ref);
    } else {
      console.warn(
        `[placeMediasIntoSections] Image non placée (id=${media.id}) : ` +
          `aucune section "about" ou compatible disponible.`,
      );
    }
  }

  return result;
}

/** Extrait l'id d'un placeholder de type "[uploaded-xxx]". */
function extractPlaceholderId(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^\[uploaded-(.+)\]$/);
  return m ? m[1] : null;
}

function extractMediaRef(section: FunnelSection): string | null {
  const img = section.image?.mediaRef || section.image?.url;
  const vid = section.video?.url;
  if (img && !extractPlaceholderId(img)) return img;
  if (vid && !extractPlaceholderId(vid)) return vid;
  return null;
}

function hasMediaAttached(section: FunnelSection): boolean {
  const imgUrl = section.image?.url;
  const imgRef = section.image?.mediaRef;
  const vidUrl = section.video?.url;
  const hasImg = Boolean(
    (imgUrl && !extractPlaceholderId(imgUrl)) ||
      (imgRef && !extractPlaceholderId(imgRef)),
  );
  const hasVid = Boolean(vidUrl && !extractPlaceholderId(vidUrl));

  if (section.type === "testimonials" && Array.isArray(section.items)) {
    const testimonialItems = section.items.filter((it) => it.kind === "testimonial");
    if (testimonialItems.length > 0) {
      const allAvatarsFilled = testimonialItems.every(
        (it) =>
          it.kind === "testimonial" &&
          it.data.avatarUrl &&
          !extractPlaceholderId(it.data.avatarUrl),
      );
      return hasImg || hasVid || allAvatarsFilled;
    }
  }

  return hasImg || hasVid;
}

/**
 * Attache un média à une section. Cas spécial : pour les sections
 * "testimonials" avec des items, le média image va dans l'avatarUrl du
 * premier testimonial sans avatar, plutôt que dans section.image.
 */
function attachMediaToSection(section: FunnelSection, media: MediaItem): void {
  const ref = media.url || "";

  if (
    section.type === "testimonials" &&
    media.kind !== "video" &&
    Array.isArray(section.items) &&
    section.items.length > 0
  ) {
    const firstWithoutAvatar = section.items.find(
      (it) =>
        it.kind === "testimonial" &&
        (!it.data.avatarUrl || extractPlaceholderId(it.data.avatarUrl)),
    );
    if (firstWithoutAvatar && firstWithoutAvatar.kind === "testimonial") {
      firstWithoutAvatar.data.avatarUrl = ref;
      return;
    }
  }

  if (media.kind === "video") {
    const video: VideoSource = {
      provider: detectVideoProvider(ref),
      url: ref,
    };
    section.video = video;
  } else {
    const image: SectionImage = {
      mode: "upload",
      url: ref,
      mediaRef: media.id || ref,
      alt: media.alt || "",
    };
    section.image = image;
  }
}

function createSectionWithMedia(
  type: FunnelSectionType,
  media: MediaItem,
): FunnelSection {
  const section: FunnelSection = {
    id: `sec_${Math.random().toString(36).slice(2, 10)}`,
    type,
    headline: defaultHeadlineForType(type),
    visible: true,
  };
  attachMediaToSection(section, media);
  return section;
}

function defaultHeadlineForType(type: FunnelSectionType): string {
  const titles: Partial<Record<FunnelSectionType, string>> = {
    about: "À propos",
    testimonials: "Ils en parlent",
    video: "Découvrez en vidéo",
    proof: "Résultats concrets",
    pricing: "Votre offre",
  };
  return titles[type] ?? "Section";
}

function pickFallbackAllowedSection(
  media: MediaItem,
  allowed: readonly FunnelSectionType[],
): FunnelSectionType {
  const kind = media.kind || "image";
  const preferences: FunnelSectionType[] =
    kind === "video"
      ? ["video", "hero", "about", "testimonials"]
      : ["about", "testimonials", "proof", "hero", "pricing"];
  for (const pref of preferences) {
    if (allowed.includes(pref)) return pref;
  }
  return allowed[0] ?? "about";
}

/* ================================================================== */
/*  HERO ≤ 1 média (image OU vidéo, selon la policy)                   */
/* ================================================================== */

export function enforceHeroSingleMedia(
  sections: FunnelSection[],
  opts: { funnelKind: FunnelKind; role: PageRole },
): FunnelSection[] {
  const policy = getHeroMediaPolicy(opts.funnelKind, opts.role);
  const result = sections.map((s) => ({ ...s }));

  const heroIdx = result.findIndex((s) => s.type === "hero");
  if (heroIdx < 0) return result;

  const hero = { ...result[heroIdx] };
  const hasImage = Boolean(hero.image?.url || hero.image?.mediaRef);
  const hasVideo = Boolean(hero.video?.url);

  if (!(hasImage && hasVideo)) return result;

  let keep: "image" | "video";
  let moveTo: FunnelSectionType;

  switch (policy) {
    case "prefer-video":
      keep = "video";
      moveTo = "about";
      break;
    case "prefer-image":
      keep = "image";
      moveTo = "video";
      break;
    case "single-only":
    default:
      // Single-only : vidéo gagne par défaut (média le plus engageant)
      keep = "video";
      moveTo = "about";
      break;
  }

  const movedMedia: MediaItem =
    keep === "video"
      ? {
          id: `moved_${Date.now()}`,
          kind: "image",
          url: hero.image?.url || hero.image?.mediaRef || "",
          alt: hero.image?.alt || "",
        }
      : {
          id: `moved_${Date.now()}`,
          kind: "video",
          url: hero.video?.url || "",
          alt: "",
        };

  if (keep === "video") {
    hero.image = { mode: "none" };
  } else {
    hero.video = undefined;
  }
  result[heroIdx] = hero;

  const allowed = getAllowedSectionTypes(opts.funnelKind, opts.role);
  let finalMoveTo: FunnelSectionType = moveTo;
  if (allowed && !allowed.includes(moveTo)) {
    finalMoveTo = pickFallbackAllowedSection(movedMedia, allowed);
  }

  const existing = result.find(
    (s, i) => i !== heroIdx && s.type === finalMoveTo && !hasMediaAttached(s),
  );

  if (existing) {
    attachMediaToSection(existing, movedMedia);
  } else if (!allowed || allowed.includes(finalMoveTo)) {
    const newSection = createSectionWithMedia(finalMoveTo, movedMedia);
    result.splice(heroIdx + 1, 0, newSection);
  }

  return result;
}

/* ================================================================== */
/*  INJECTION DÉTERMINISTE DE LA VIDÉO DU BRIEF                       */
/* ================================================================== */

/**
 * Applique la politique vidéo de la page (heroMediaPolicy) :
 * - "prefer-video"  : vidéo dans hero.video, toute section "video" séparée supprimée
 * - "prefer-image"  : vidéo UNIQUEMENT dans une section "video" dédiée,
 *                     retirée du hero si l'IA l'y a mise
 * - "single-only"   : la vidéo va dans le hero, section vidéo dédiée supprimée
 *
 * Si la vidéo ne peut être placée nulle part, elle est ignorée avec un warning.
 */
function ensureBriefVideoInSections(
  sections: FunnelSection[],
  videoUrl: string | undefined,
  opts: { funnelKind: FunnelKind; role: PageRole },
): FunnelSection[] {
  if (!videoUrl || !videoUrl.trim()) return sections;

  const policy = getHeroMediaPolicy(opts.funnelKind, opts.role);
  const allowed = getAllowedSectionTypes(opts.funnelKind, opts.role);
  const allowedSet = allowed ? new Set<FunnelSectionType>(allowed) : null;

  const videoSource: VideoSource = {
    provider: detectVideoProvider(videoUrl),
    url: videoUrl,
  };

  let result = sections.map((s) => ({ ...s }));
  const heroIdx = result.findIndex((s) => s.type === "hero");
  const heroSection = heroIdx >= 0 ? result[heroIdx] : null;
  const dedicatedVideoSections = result.filter((s) => s.type === "video");

  if (policy === "prefer-video") {
    // La vidéo EST le contenu : elle va dans le hero, on supprime les doublons.
    if (heroSection) {
      heroSection.video = videoSource;
      if (heroSection.image?.url) {
        heroSection.image = { mode: "none" };
      }
    }
    if (dedicatedVideoSections.length > 0) {
      result = result.filter((s) => s.type !== "video");
    }
    return result;
  }

  if (policy === "prefer-image") {
    // Vidéo UNIQUEMENT dans une section "video" dédiée.
    if (heroSection?.video?.url) {
      heroSection.video = undefined;
    }

    if (dedicatedVideoSections.length > 0) {
      // Remplir la 1ère section vidéo, supprimer les doublons éventuels
      dedicatedVideoSections[0].video = videoSource;
      if (dedicatedVideoSections.length > 1) {
        let seen = false;
        result = result.filter((s) => {
          if (s.type !== "video") return true;
          if (!seen) {
            seen = true;
            return true;
          }
          return false;
        });
      }
      return result;
    }

    // Aucune section vidéo : on en crée une si la page l'autorise
    if (!allowedSet || allowedSet.has("video")) {
      const newVideoSection: FunnelSection = {
        id: `sec_video_${Date.now().toString(36)}`,
        type: "video",
        headline: "Découvrez en vidéo",
        video: videoSource,
        visible: true,
      };
      if (heroIdx >= 0) {
        result.splice(heroIdx + 1, 0, newVideoSection);
      } else {
        result.unshift(newVideoSection);
      }
      return result;
    }

    console.warn(
      `[ensureBriefVideoInSections] La page "${opts.role}" du tunnel "${opts.funnelKind}" ` +
        `n'autorise pas de section vidéo. videoUrl ignorée pour cette page.`,
    );
    return result;
  }

  // policy === "single-only" : un seul média total, vidéo prime.
  if (heroSection && (!allowedSet || allowedSet.has("hero"))) {
    heroSection.video = videoSource;
    if (heroSection.image?.url) {
      heroSection.image = { mode: "none" };
    }
    result = result.filter((s) => s.type !== "video");
    return result;
  }

  // Fallback : section vidéo dédiée si autorisée
  if (dedicatedVideoSections.length > 0) {
    dedicatedVideoSections[0].video = videoSource;
  } else if (!allowedSet || allowedSet.has("video")) {
    const newVideoSection: FunnelSection = {
      id: `sec_video_${Date.now().toString(36)}`,
      type: "video",
      headline: "Découvrez en vidéo",
      video: videoSource,
      visible: true,
    };
    if (heroIdx >= 0) {
      result.splice(heroIdx + 1, 0, newVideoSection);
    } else {
      result.unshift(newVideoSection);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Erreur typée
// ─────────────────────────────────────────────────────────────────────────────
export type AiErrorReason =
  | "missing-key"
  | "invalid-key"
  | "rate-limit"
  | "insufficient-quota"
  | "network-error"
  | "empty-response"
  | "invalid-json"
  | "schema-mismatch"
  | "unknown";

export class AiGenerationError extends Error {
  reason: AiErrorReason;
  details?: string;

  constructor(reason: AiErrorReason, message: string, details?: string) {
    super(message);
    this.name = "AiGenerationError";
    this.reason = reason;
    this.details = details;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas zod
// ─────────────────────────────────────────────────────────────────────────────

const ctaSchema = z
  .union([
    z.string(),
    z
      .object({
        label: z.string().optional(),
        text: z.string().optional(),
        title: z.string().optional(),
        url: z.string().optional(),
        href: z.string().optional(),
        link: z.string().optional(),
        action: z.string().optional(),
        mode: z.enum(["redirect", "anchor", "popup"]).optional(),
        target: z.enum(["_self", "_blank"]).optional(),
        anchorId: z.string().optional(),
        popupId: z.string().optional(),
      })
      .passthrough(),
    z.null(),
  ])
  .optional();

const imageSchema = z
  .object({
    mode: z.enum(["none", "upload", "ai-suggested"]).optional().default("none"),
    url: z.string().optional(),
    alt: z.string().optional(),
    credit: z.string().optional(),
    sourceUrl: z.string().optional(),
    suggestionQuery: z.string().optional(),
    mediaRef: z.string().optional(),
  })
  .optional()
  .default({ mode: "none" });

const styleSchema = z
  .object({
    textColor: z.string().optional(),
    accentColor: z.string().optional(),
    spacing: z.enum(["compact", "default", "large"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    layout: z.enum(["text-only", "image-only", "text-image", "image-text"]).optional(),
  })
  .optional()
  .default({});

const videoSchema = z
  .object({
    provider: z.enum(["youtube", "vimeo", "url", "upload"]).optional(),
    url: z.string().optional(),
    posterUrl: z.string().optional(),
  })
  .optional();

const sectionItemSchema = z.union([
  z.object({
    kind: z.literal("faq"),
    data: z
      .object({
        question: z.string().optional().default(""),
        answer: z.string().optional().default(""),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("testimonial"),
    data: z
      .object({
        quote: z.string().optional().default(""),
        authorName: z.string().optional().default(""),
        authorRole: z.string().optional(),
        avatarUrl: z.string().optional(),
        rating: z.number().optional(),
        sourceUrl: z.string().optional(),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("pricing"),
    data: z
      .object({
        name: z.string().optional().default("Plan"),
        price: z.string().optional().default("0€"),
        period: z.string().optional(),
        description: z.string().optional(),
        features: z.array(z.string()).optional().default([]),
        highlighted: z.boolean().optional(),
        badge: z.string().optional(),
        cta: ctaSchema,
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("bonus"),
    data: z
      .object({
        title: z.string().optional().default(""),
        description: z.string().optional(),
        value: z.string().optional(),
        iconName: z.string().optional(),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("guarantee"),
    data: z
      .object({
        title: z.string().optional().default(""),
        description: z.string().optional(),
        duration: z.string().optional(),
        iconName: z.string().optional(),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("formField"),
    data: z
      .object({
        name: z.string().optional().default("field"),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        type: z
          .enum(["text", "email", "tel", "number", "textarea", "select", "checkbox"])
          .optional()
          .default("text"),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
        width: z.enum(["full", "half"]).optional(),
      })
      .passthrough(),
  }),
]);

const sectionSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  eyebrow: z.string().optional(),
  headline: z.string().optional().default(""),
  subheadline: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  cta: ctaSchema,
  image: imageSchema,
  video: videoSchema,
  visible: z.boolean().optional().default(true),
  style: styleSchema,
  visualDirection: z.string().optional(),
  items: z.array(sectionItemSchema).optional(),
});

const funnelSchema = z.object({
  funnelName: z.string().optional().default("Mon Tunnel"),
  language: z.enum(["fr", "en", "es"]).optional().default("fr"),
  sections: z.array(sectionSchema).optional().default([]),
  thankYouPage: z
    .object({
      headline: z.string().optional().default("Merci !"),
      body: z.string().optional().default("Votre demande a été prise en compte."),
      cta: ctaSchema,
    })
    .optional()
    .default({}),
  emails: z
    .array(
      z.object({
        subject: z.string().optional().default(""),
        html: z.string().optional().default(""),
        text: z.string().optional().default(""),
        cta: ctaSchema,
      }),
    )
    .optional()
    .default([]),
  seo: z
    .object({
      title: z.string().optional().default(""),
      description: z.string().optional().default(""),
    })
    .optional()
    .default({}),
  design: z
    .object({
      primaryColor: z.string().optional().default("#000000"),
      secondaryColor: z.string().optional().default("#ffffff"),
      accentColor: z.string().optional().default("#3b82f6"),
      style: z.string().optional().default("modern"),
    })
    .optional()
    .default({}),
});

const secondaryPagesSchema = z.object({
  pages: z.array(
    z.object({
      role: z.string(),
      sections: z.array(sectionSchema),
    }),
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISATION PERMISSIVE DU JSON IA
// ─────────────────────────────────────────────────────────────────────────────

function normalizeRawAiJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.sections)) return obj;

  const sections = (obj.sections as unknown[]).map((s) => normalizeRawSection(s));
  return { ...obj, sections };
}

function normalizeSecondaryPagesRawJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.pages)) return obj;
  const pages = (obj.pages as unknown[]).map((p) => {
    if (!p || typeof p !== "object") return p;
    const page = { ...(p as Record<string, unknown>) };
    if (Array.isArray(page.sections)) {
      page.sections = (page.sections as unknown[]).map((s) => normalizeRawSection(s));
    }
    return page;
  });
  return { ...obj, pages };
}

function normalizeRawSection(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  let s = { ...(raw as Record<string, unknown>) };

  if (s.content && typeof s.content === "object" && !Array.isArray(s.content)) {
    const content = s.content as Record<string, unknown>;
    const { content: _omit, ...rest } = s;
    s = { ...rest, ...content };
  } else if (typeof s.content === "string" && !s.body) {
    s.body = s.content;
    delete s.content;
  }

  if (s.title && !s.headline) s.headline = s.title;
  if (s.subtitle && !s.subheadline) s.subheadline = s.subtitle;
  if (s.description && !s.body) s.body = s.description;
  if (s.text && !s.body) s.body = s.text;
  if (s.paragraph && !s.body) s.body = s.paragraph;
  delete s.title;
  delete s.subtitle;
  delete s.description;
  delete s.text;
  delete s.paragraph;

  if (s.body !== undefined && typeof s.body !== "string") {
    if (s.body && typeof s.body === "object") {
      const bodyObj = s.body as Record<string, unknown>;
      const extracted =
        bodyObj.text ?? bodyObj.content ?? bodyObj.description ?? "";
      s.body = typeof extracted === "string" ? extracted : "";
    } else {
      s.body = String(s.body);
    }
  }

  if (!s.type || typeof s.type !== "string") {
    s.type = inferSectionType(s);
  }

  if (s.image) {
    if (typeof s.image === "string") {
      s.image = { mode: "upload", url: s.image };
    } else if (typeof s.image === "object") {
      const img = { ...(s.image as Record<string, unknown>) };
      if (img.src && !img.url) img.url = img.src;
      delete img.src;
      if (!img.mode) img.mode = "upload";
      s.image = img;
    }
  }

  if (typeof s.video === "string") {
    s.video = { url: s.video };
  }

  const altKeys = [
    "testimonials",
    "pricingPlans",
    "plans",
    "bonuses",
    "guarantees",
    "faqs",
    "fields",
  ];
  for (const key of altKeys) {
    if (Array.isArray(s[key]) && !s.items) {
      s.items = s[key];
    }
    delete s[key];
  }

  if (Array.isArray(s.items)) {
    const sectionType = String(s.type ?? "");
    const normalizedItems: unknown[] = [];
    const stringBullets: string[] = [];

    for (const item of s.items as unknown[]) {
      if (typeof item === "string") {
        stringBullets.push(item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;

      if (it.kind && it.data) {
        const validKinds = ["faq", "testimonial", "pricing", "bonus", "guarantee", "formField"];
        if (validKinds.includes(String(it.kind))) {
          normalizedItems.push(it);
          continue;
        }
        const data = it.data as Record<string, unknown>;
        const title = data.title ?? data.name ?? "";
        const desc = data.description ?? data.text ?? "";
        const bullet = desc ? `${title} : ${desc}` : String(title);
        if (bullet.trim()) stringBullets.push(bullet.trim());
        continue;
      }

      const kind = guessItemKind(sectionType, it);
      if (!kind) {
        const title = it.title ?? it.name ?? "";
        const desc = it.description ?? it.text ?? "";
        const bullet = desc ? `${title} : ${desc}` : String(title);
        if (bullet.toString().trim()) stringBullets.push(bullet.toString().trim());
        continue;
      }

      const data = remapItemData(kind, it);
      normalizedItems.push({ kind, data });
    }

    if (normalizedItems.length > 0) {
      s.items = normalizedItems;
    } else {
      delete s.items;
    }

    if (stringBullets.length > 0) {
      s.bullets = Array.isArray(s.bullets)
        ? [...(s.bullets as string[]), ...stringBullets]
        : stringBullets;
    }
  }

  return s;
}

function inferSectionType(s: Record<string, unknown>): string {
  const headline = String(s.headline ?? "").toLowerCase();
  const items = Array.isArray(s.items) ? (s.items as unknown[]) : [];

  if (items.length > 0 && typeof items[0] === "object" && items[0] !== null) {
    const firstKind = String((items[0] as Record<string, unknown>).kind ?? "");
    if (firstKind === "faq") return "faq";
    if (firstKind === "testimonial") return "testimonials";
    if (firstKind === "pricing") return "pricing";
    if (firstKind === "bonus") return "bonus";
    if (firstKind === "guarantee") return "guarantee";
    if (firstKind === "benefit") return "benefits";
    if (firstKind === "program") return "program";
    if (firstKind === "formField") return "form";
  }

  if (/faq|question|fréquemment|frequently/i.test(headline)) return "faq";
  if (/témoignage|testimonial|avis|review|client/i.test(headline)) return "testimonials";
  if (/tarif|prix|pricing|plan|offre/i.test(headline)) return "pricing";
  if (/bonus|cadeau|gift|inclus/i.test(headline)) return "bonus";
  if (/garantie|guarantee|remboursement/i.test(headline)) return "guarantee";
  if (/bénéfice|benefit|avantage|pourquoi/i.test(headline)) return "benefits";
  if (/programme|program|apprendre|module|contenu/i.test(headline)) return "program";
  if (/à propos|about|qui suis|coach|fondateur/i.test(headline)) return "about";
  if (/résultat|proof|preuve|chiffre/i.test(headline)) return "proof";

  return "about";
}

function guessItemKind(sectionType: string, it: Record<string, unknown>): string | null {
  if (it.question || it.answer) return "faq";
  if (it.quote || it.author || it.authorName || it.text) return "testimonial";
  if (it.price || it.features) return "pricing";

  switch (sectionType) {
    case "faq":
      return "faq";
    case "testimonials":
    case "proof":
      return "testimonial";
    case "pricing":
    case "offer":
      return "pricing";
    case "bonus":
      return "bonus";
    case "guarantee":
      return "guarantee";
    default:
      return null;
  }
}

function remapItemData(
  kind: string,
  it: Record<string, unknown>,
): Record<string, unknown> {
  switch (kind) {
    case "faq":
      return {
        question: String(it.question ?? it.q ?? ""),
        answer: String(it.answer ?? it.a ?? ""),
      };
    case "testimonial": {
      let avatarUrl: string | undefined;
      if (it.avatarUrl) {
        avatarUrl = String(it.avatarUrl);
      } else if (typeof it.image === "string") {
        avatarUrl = it.image;
      } else if (it.image && typeof it.image === "object") {
        const img = it.image as Record<string, unknown>;
        const url = img.url ?? img.src;
        if (url) avatarUrl = String(url);
      }
      return {
        quote: String(it.quote ?? it.text ?? it.content ?? ""),
        authorName: String(it.authorName ?? it.author ?? it.name ?? ""),
        authorRole: it.authorRole
          ? String(it.authorRole)
          : it.role
            ? String(it.role)
            : undefined,
        avatarUrl,
        rating: typeof it.rating === "number" ? it.rating : 5,
      };
    }
    case "pricing":
      return {
        name: String(it.name ?? it.title ?? "Plan"),
        price: String(it.price ?? "0€"),
        period: it.period ? String(it.period) : undefined,
        description: it.description ? String(it.description) : undefined,
        features: Array.isArray(it.features) ? it.features.map(String) : [],
        highlighted: Boolean(it.highlighted ?? it.popular),
        badge: it.badge ? String(it.badge) : undefined,
      };
    case "bonus":
      return {
        title: String(it.title ?? it.name ?? ""),
        description: it.description ? String(it.description) : undefined,
        value: it.value ? String(it.value) : undefined,
      };
    case "guarantee":
      return {
        title: String(it.title ?? it.name ?? ""),
        description: it.description ? String(it.description) : undefined,
        duration: it.duration ? String(it.duration) : undefined,
      };
    default:
      return it;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation CTA
// ─────────────────────────────────────────────────────────────────────────────
function pickString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function normalizeCta(raw: unknown, fallback: CtaConfig): CtaConfig {
  if (raw == null) return { ...fallback };

  if (typeof raw === "string") {
    const label = raw.trim();
    return label ? { ...fallback, label } : { ...fallback };
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    const label =
      pickString(obj.label, obj.text, obj.title) ?? fallback.label;

    const url = pickString(obj.url, obj.href, obj.link, obj.action);

    const mode =
      (obj.mode === "redirect" || obj.mode === "anchor" || obj.mode === "popup"
        ? (obj.mode as CtaConfig["mode"])
        : undefined) ??
      fallback.mode ??
      "anchor";

    const target =
      obj.target === "_blank" || obj.target === "_self"
        ? (obj.target as CtaConfig["target"])
        : "_self";

    const anchorId =
      pickString(obj.anchorId) ??
      (mode === "anchor" ? fallback.anchorId ?? "lead-form" : undefined);

    const popupId = pickString(obj.popupId);

    return {
      label,
      mode,
      url,
      target,
      anchorId,
      popupId,
    };
  }

  return { ...fallback };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction JSON tolérante
// ─────────────────────────────────────────────────────────────────────────────
function extractJsonPayload(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

  if (!s.startsWith("{") && !s.startsWith("[")) {
    const start = s.indexOf("{");
    if (start === -1) return s;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return s.slice(start);
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation des SectionItem issus du parsing Zod
// ─────────────────────────────────────────────────────────────────────────────
function normalizeSectionItems(
  rawItems: z.infer<typeof sectionItemSchema>[],
  fallbackCta: CtaConfig,
): SectionItem[] {
  return rawItems.map((item): SectionItem => {
    switch (item.kind) {
      case "bonus":
        return {
          kind: "bonus",
          data: {
            title: item.data.title ?? "",
            description: item.data.description,
            value: item.data.value,
            iconName: item.data.iconName
              ? normalizeIconName(item.data.iconName)
              : "gift",
          },
        };
      case "guarantee":
        return {
          kind: "guarantee",
          data: {
            title: item.data.title ?? "",
            description: item.data.description,
            duration: item.data.duration,
            iconName: item.data.iconName
              ? normalizeIconName(item.data.iconName)
              : "shield",
          },
        };
      case "faq":
        return {
          kind: "faq",
          data: {
            question: item.data.question ?? "",
            answer: item.data.answer ?? "",
          },
        };
      case "testimonial":
        return {
          kind: "testimonial",
          data: {
            quote: item.data.quote ?? "",
            authorName: item.data.authorName ?? "",
            authorRole: item.data.authorRole,
            avatarUrl: item.data.avatarUrl,
            rating: item.data.rating,
            sourceUrl: item.data.sourceUrl,
          },
        };
      case "pricing": {
        const pricingFallbackCta: CtaConfig = {
          ...fallbackCta,
          label: fallbackCta.label || "Choisir",
        };
        return {
          kind: "pricing",
          data: {
            name: item.data.name ?? "Plan",
            price: item.data.price ?? "0€",
            period: item.data.period,
            description: item.data.description,
            features: item.data.features ?? [],
            highlighted: item.data.highlighted,
            badge: item.data.badge,
            cta: item.data.cta
              ? normalizeCta(item.data.cta, pricingFallbackCta)
              : undefined,
          },
        };
      }
      case "formField":
        return {
          kind: "formField",
          data: {
            name: item.data.name ?? "field",
            label: item.data.label,
            placeholder: item.data.placeholder,
            type: item.data.type ?? "text",
            required: item.data.required,
            options: item.data.options,
            width: item.data.width,
          },
        };
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Label CTA contextualisé selon le type de section
// ─────────────────────────────────────────────────────────────────────────────
function getCtaLabelForSection(sectionType: string, lang: Language): string {
  const labels: Record<string, Record<Language, string>> = {
    hero: { fr: "Je veux y accéder", en: "I want access", es: "Quiero acceder" },
    cta: { fr: "Je veux y accéder", en: "I want access", es: "Quiero acceder" },
    offer: { fr: "Je veux l'offre", en: "I want this offer", es: "Quiero la oferta" },
    pricing: { fr: "Je commande", en: "Order now", es: "Lo quiero" },
    bonus: { fr: "Je veux mes bonus", en: "Get my bonuses", es: "Quiero mis bonos" },
    faq: { fr: "Continuer", en: "Continue", es: "Continuar" },
    proof: { fr: "Rejoindre", en: "Join now", es: "Unirme" },
    testimonials: { fr: "Rejoindre", en: "Join now", es: "Unirme" },
    guarantee: { fr: "C'est parti", en: "Let's go", es: "Vamos" },
  };
  const map = labels[sectionType];
  if (!map) {
    return lang === "fr" ? "Continuer" : lang === "es" ? "Continuar" : "Continue";
  }
  return map[lang] ?? map.fr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser : sections IA → FunnelSection[]
// ─────────────────────────────────────────────────────────────────────────────
function parseSectionsArray(
  rawSections: z.infer<typeof sectionSchema>[],
  fallbackCta: CtaConfig,
  brief: FunnelBrief,
): FunnelSection[] {
  return rawSections.map((section, index) => {
    const sectionFallbackCta: CtaConfig = {
      ...fallbackCta,
      label:
        fallbackCta.label ||
        getCtaLabelForSection(section.type, brief.language),
    };

    const image: SectionImage = section.image
      ? {
          mode: section.image.mode ?? "none",
          url: section.image.url,
          alt: section.image.alt,
          credit: section.image.credit,
          sourceUrl: section.image.sourceUrl,
          suggestionQuery: section.image.suggestionQuery,
          mediaRef: section.image.mediaRef,
        }
      : { mode: brief.defaultImageMode ?? "none" };

    const video: VideoSource | undefined = section.video?.url
      ? {
          provider: section.video.provider ?? detectVideoProvider(section.video.url),
          url: section.video.url,
          posterUrl: section.video.posterUrl,
        }
      : undefined;

    return {
      id: section.id ?? `${section.type}-${index + 1}`,
      type: section.type as FunnelSectionType,
      eyebrow: section.eyebrow,
      headline: section.headline,
      subheadline: section.subheadline,
      body: section.body,
      bullets: section.bullets,
      cta:
        section.cta !== undefined
          ? normalizeCta(section.cta, sectionFallbackCta)
          : undefined,
      image,
      video,
      visible: section.visible ?? true,
      style: section.style as FunnelSection["style"],
      visualDirection: section.visualDirection,
      items: section.items
        ? normalizeSectionItems(section.items, sectionFallbackCta)
        : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bibliothèque média
// ─────────────────────────────────────────────────────────────────────────────
function buildMediaLibraryFromBrief(brief: FunnelBrief): Funnel["media"] {
  if (!brief.medias || brief.medias.length === 0) return undefined;
  const cleaned = brief.medias.filter(
    (m) => typeof m.url === "string" && m.url.length > 0,
  );
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application du style de template
// ─────────────────────────────────────────────────────────────────────────────
function buildStyleMapByType(
  styledSections: FunnelSection[] | undefined,
): Map<string, Partial<FunnelSection>> {
  const map = new Map<string, Partial<FunnelSection>>();
  if (!styledSections || styledSections.length === 0) return map;
  for (const s of styledSections) {
    if (map.has(s.type)) continue;
    map.set(s.type, {
      style: s.style,
      // ⚠️ image et video volontairement omis : le template ne fournit
      // QUE le style visuel, jamais de média. Les médias viennent
      // exclusivement du brief via placeMediasIntoSections.
      visualDirection: s.visualDirection,
    });
  }
  return map;
}

function applyStyleMapToSections(
  sections: FunnelSection[],
  styleMap: Map<string, Partial<FunnelSection>>,
): FunnelSection[] {
  if (styleMap.size === 0) return sections;
  return sections.map((sec) => {
    const styling = styleMap.get(sec.type);
    if (!styling) return sec;

    // ⚠️ NE JAMAIS réinjecter image/video du template : les médias
    // viennent EXCLUSIVEMENT du brief via placeMediasIntoSections /
    // ensureBriefVideoInSections. Le template ne fournit QUE le style.
    return {
      ...sec,
      style: sec.style ?? styling.style,
      visualDirection: sec.visualDirection ?? styling.visualDirection,
      // image et video : on garde STRICTEMENT ce qui était dans sec
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichissement des sections riches (faq, testimonials, pricing, bonus, guarantee)
// ─────────────────────────────────────────────────────────────────────────────

const RICH_SECTION_TYPES = new Set<string>([
  "faq",
  "testimonials",
  "proof",
  "pricing",
  "offer",
  "bonus",
  "guarantee",
]);

function tLang<T extends Record<Language, string>>(map: T, lang: Language): string {
  return map[lang] ?? map.fr;
}

function generateFaqAnswer(question: string, brief: FunnelBrief): string {
  const lang = brief.language;
  const q = question.toLowerCase();

  if (/combien|temps|délai|quand|durée/i.test(q)) {
    return tLang(
      {
        fr: `L'accès est envoyé immédiatement par email après votre inscription. Vous pouvez consulter ${brief.offerName} à votre rythme, sans limite de temps.`,
        en: `Access is sent immediately by email after sign-up. You can go through ${brief.offerName} at your own pace, with no time limit.`,
        es: `El acceso se envía de inmediato por email tras la inscripción. Puedes consultar ${brief.offerName} a tu ritmo, sin límite de tiempo.`,
      },
      lang,
    );
  }
  if (/mobile|téléphone|smartphone|tablette|appareil/i.test(q)) {
    return tLang(
      {
        fr: `Oui, tous les contenus sont 100% compatibles mobile, tablette et ordinateur. Vous pouvez les consulter sur n'importe quel appareil.`,
        en: `Yes, all content is 100% compatible with mobile, tablet and desktop. You can access it on any device.`,
        es: `Sí, todo el contenido es 100% compatible con móvil, tableta y escritorio. Puedes acceder desde cualquier dispositivo.`,
      },
      lang,
    );
  }
  if (/remboursement|garantie|satisfait/i.test(q)) {
    return tLang(
      {
        fr: `Nous offrons une garantie satisfait ou remboursé de 30 jours. Si vous n'êtes pas satisfait, écrivez-nous et vous serez remboursé sans justification.`,
        en: `We offer a 30-day money-back guarantee. If you're not satisfied, just email us and you'll be refunded, no questions asked.`,
        es: `Ofrecemos una garantía de devolución de 30 días. Si no estás satisfecho, escríbenos y serás reembolsado sin preguntas.`,
      },
      lang,
    );
  }
  if (/débutant|niveau|expérience|connaissance/i.test(q)) {
    return tLang(
      {
        fr: `Aucune connaissance préalable n'est nécessaire. Le contenu de ${brief.offerName} est pensé pour ${brief.targetAudience}, à partir de zéro.`,
        en: `No prior knowledge is required. The content of ${brief.offerName} is designed for ${brief.targetAudience}, from scratch.`,
        es: `No se requiere conocimiento previo. El contenido de ${brief.offerName} está pensado para ${brief.targetAudience}, desde cero.`,
      },
      lang,
    );
  }
  if (/prix|coût|payer|gratuit/i.test(q)) {
    return tLang(
      {
        fr: `Le tarif est de ${brief.price}. Aucun frais caché. Vous bénéficiez d'un accès complet et illimité.`,
        en: `The price is ${brief.price}. No hidden fees. You get full unlimited access.`,
        es: `El precio es ${brief.price}. Sin tarifas ocultas. Obtienes acceso completo e ilimitado.`,
      },
      lang,
    );
  }
  if (/contact|support|aide|question/i.test(q)) {
    return tLang(
      {
        fr: `Notre équipe est joignable par email et répond sous 24 à 48 heures ouvrées. Nous sommes là pour vous accompagner.`,
        en: `Our team is reachable by email and answers within 24 to 48 business hours. We're here to help.`,
        es: `Nuestro equipo está disponible por email y responde en 24 a 48 horas hábiles. Estamos aquí para ayudarte.`,
      },
      lang,
    );
  }

  return tLang(
    {
      fr: `Excellente question. ${brief.offerName} a été conçu spécifiquement pour répondre à ce point : ${brief.promise}. Si vous avez besoin de précisions, contactez-nous.`,
      en: `Great question. ${brief.offerName} was designed specifically to address this: ${brief.promise}. Contact us if you need more details.`,
      es: `Excelente pregunta. ${brief.offerName} fue diseñado específicamente para abordar este punto: ${brief.promise}. Contáctanos si necesitas más detalles.`,
    },
    lang,
  );
}

function buildFallbackFaqItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const questions = tLang(
    {
      fr: [
        `Comment vais-je recevoir ${brief.offerName} ?`,
        `Combien de temps faut-il pour voir des résultats ?`,
        `Est-ce que ça fonctionne pour les débutants ?`,
        `Y a-t-il une garantie satisfait ou remboursé ?`,
        `Comment vous contacter si j'ai une question ?`,
      ].join("|"),
      en: [
        `How will I receive ${brief.offerName}?`,
        `How long does it take to see results?`,
        `Does it work for beginners?`,
        `Is there a money-back guarantee?`,
        `How can I contact you if I have a question?`,
      ].join("|"),
      es: [
        `¿Cómo recibiré ${brief.offerName}?`,
        `¿Cuánto tiempo para ver resultados?`,
        `¿Funciona para principiantes?`,
        `¿Hay garantía de devolución?`,
        `¿Cómo contactarles si tengo dudas?`,
      ].join("|"),
    },
    lang,
  ).split("|");

  return questions.map((q) => ({
    kind: "faq" as const,
    data: { question: q, answer: generateFaqAnswer(q, brief) },
  }));
}

function buildFallbackTestimonialItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const exampleTag = tLang(
    { fr: "Exemple — à personnaliser :", en: "Example — to customize:", es: "Ejemplo — a personalizar:" },
    lang,
  );

  const personasByLang: Record<Language, { name: string; role: string }[]> = {
    fr: [
      { name: "Claire D.", role: "Maman de 2 enfants" },
      { name: "Marc L.", role: "Entrepreneur" },
      { name: "Sophie M.", role: "Coach indépendante" },
    ],
    en: [
      { name: "Claire D.", role: "Mother of two" },
      { name: "Mark L.", role: "Entrepreneur" },
      { name: "Sophie M.", role: "Independent coach" },
    ],
    es: [
      { name: "Clara D.", role: "Madre de dos hijos" },
      { name: "Marco L.", role: "Emprendedor" },
      { name: "Sofía M.", role: "Coach independiente" },
    ],
  };
  const personas = personasByLang[lang] ?? personasByLang.fr;

  const quotes = tLang(
    {
      fr: [
        `${exampleTag} ${brief.offerName} m'a vraiment aidé à avancer concrètement, je le recommande sans hésiter.`,
        `${exampleTag} Enfin un contenu clair et actionnable sur ${brief.promise}. Bravo !`,
        `${exampleTag} J'ai vu des résultats en quelques semaines, contenu très bien structuré.`,
      ].join("|"),
      en: [
        `${exampleTag} ${brief.offerName} really helped me move forward. I recommend it without hesitation.`,
        `${exampleTag} Finally clear, actionable content on ${brief.promise}. Well done!`,
        `${exampleTag} I saw results in just a few weeks. Very well-structured content.`,
      ].join("|"),
      es: [
        `${exampleTag} ${brief.offerName} realmente me ayudó a avanzar. Lo recomiendo sin dudar.`,
        `${exampleTag} Por fin contenido claro y accionable sobre ${brief.promise}. ¡Genial!`,
        `${exampleTag} Vi resultados en pocas semanas. Contenido muy bien estructurado.`,
      ].join("|"),
    },
    lang,
  ).split("|");

  return personas.map((p, i) => ({
    kind: "testimonial" as const,
    data: {
      quote: quotes[i] ?? quotes[0],
      authorName: p.name,
      authorRole: p.role,
      rating: 5,
    },
  }));
}

function convertBulletsToTestimonialItems(
  bullets: string[],
  brief: FunnelBrief,
): SectionItem[] {
  const lang = brief.language;
  const exampleTag = tLang(
    { fr: "Exemple — à personnaliser :", en: "Example — to customize:", es: "Ejemplo — a personalizar:" },
    lang,
  );
  const namesByLang: Record<Language, string[]> = {
    fr: ["Claire D.", "Marc L.", "Sophie M."],
    en: ["Claire D.", "Mark L.", "Sophie M."],
    es: ["Clara D.", "Marco L.", "Sofía M."],
  };
  const names = namesByLang[lang] ?? namesByLang.fr;

  return bullets.slice(0, 3).map((b, i) => ({
    kind: "testimonial" as const,
    data: {
      quote: `${exampleTag} ${b}`,
      authorName: names[i] ?? names[0],
      authorRole: undefined,
      rating: 5,
    },
  }));
}

function buildFallbackPricingItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const features = tLang(
    {
      fr: [
        `Accès complet à ${brief.offerName}`,
        `Compatible mobile, tablette et ordinateur`,
        `Mises à jour à vie incluses`,
        `Garantie satisfait ou remboursé 30 jours`,
      ].join("|"),
      en: [
        `Full access to ${brief.offerName}`,
        `Mobile, tablet and desktop compatible`,
        `Lifetime updates included`,
        `30-day money-back guarantee`,
      ].join("|"),
      es: [
        `Acceso completo a ${brief.offerName}`,
        `Compatible con móvil, tableta y escritorio`,
        `Actualizaciones de por vida incluidas`,
        `Garantía de devolución de 30 días`,
      ].join("|"),
    },
    lang,
  ).split("|");

  return [
    {
      kind: "pricing" as const,
      data: {
        name: brief.offerName,
        price: brief.price,
        period: tLang({ fr: "paiement unique", en: "one-time payment", es: "pago único" }, lang),
        description: brief.promise,
        features,
        highlighted: true,
        badge: tLang({ fr: "Recommandé", en: "Recommended", es: "Recomendado" }, lang),
        cta: {
          label: tLang({ fr: "Je veux l'accès", en: "I want access", es: "Quiero el acceso" }, lang),
          mode: "anchor",
          anchorId: "lead-form",
        },
      },
    },
  ];
}

function buildFallbackBonusItems(brief: FunnelBrief): SectionItem[] {
  const offerName = brief.offerName || "votre offre";

  const bonuses: BonusItem[] = [
    {
      title: "Guide de démarrage rapide",
      description: `Démarrez immédiatement avec ${offerName} grâce à ce guide pas à pas.`,
      iconName: "gift",
    },
    {
      title: "Checklist exclusive",
      description: "Une checklist complète pour ne rien oublier et progresser sereinement.",
      iconName: "checkCircle",
    },
    {
      title: "Accès communauté privée",
      description: "Rejoignez une communauté de membres motivés et bénéficiez d'un soutien continu.",
      iconName: "star",
    },
  ];

  return bonuses.map<SectionItem>((data) => ({ kind: "bonus", data }));
}

function convertBulletsToBonusItems(bullets: string[]): SectionItem[] {
  const iconCycle: IconName[] = ["checkCircle", "play", "download", "gift", "star"];
  return bullets.map<SectionItem>((b, i) => {
    const bonusData: BonusItem = {
      title: b,
      iconName: iconCycle[i % iconCycle.length],
    };
    return { kind: "bonus", data: bonusData };
  });
}

function buildFallbackGuaranteeItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const guarantees: GuaranteeItem[] = [
    {
      title: tLang({ fr: "Satisfait ou remboursé", en: "Money-back guarantee", es: "Satisfecho o reembolsado" }, lang),
      description: tLang(
        {
          fr: `Si dans les 30 jours vous n'êtes pas satisfait de ${brief.offerName}, demandez votre remboursement intégral, sans avoir à vous justifier.`,
          en: `If you're not satisfied with ${brief.offerName} within 30 days, request a full refund — no questions asked.`,
          es: `Si en 30 días no estás satisfecho con ${brief.offerName}, pide tu reembolso completo, sin justificaciones.`,
        },
        lang,
      ),
      duration: tLang({ fr: "30 jours", en: "30 days", es: "30 días" }, lang),
      iconName: "shield",
    },
  ];
  return guarantees.map<SectionItem>((data) => ({ kind: "guarantee", data }));
}

function enrichSectionsWithDefaults(
  sections: FunnelSection[],
  brief: FunnelBrief,
): FunnelSection[] {
  return sections.map((section) => {
    const type = section.type as string;

    if (!RICH_SECTION_TYPES.has(type)) return section;

    const existingItems = Array.isArray(section.items) ? section.items : [];

    if (type === "faq") {
      const validFaqItems = existingItems.filter(
        (it) => it.kind === "faq" && it.data?.question && it.data?.answer,
      );
      if (validFaqItems.length >= 3) {
        return { ...section, items: validFaqItems, body: undefined, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const items: SectionItem[] = section.bullets.map((q) => ({
          kind: "faq" as const,
          data: { question: q, answer: generateFaqAnswer(q, brief) },
        }));
        const enriched =
          items.length >= 3 ? items : [...items, ...buildFallbackFaqItems(brief)].slice(0, 5);
        return { ...section, items: enriched, body: undefined, bullets: undefined };
      }
      return {
        ...section,
        items: buildFallbackFaqItems(brief),
        body: undefined,
        bullets: undefined,
      };
    }

    if (type === "testimonials" || type === "proof") {
      const validTestimonials = existingItems.filter(
        (it) => it.kind === "testimonial" && it.data?.quote && it.data?.authorName,
      );
      if (validTestimonials.length >= 1) {
        return { ...section, items: validTestimonials, body: section.body, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const items = convertBulletsToTestimonialItems(section.bullets, brief);
        return { ...section, items, bullets: undefined };
      }
      const hasInformativeContent =
        !!(section.body && section.body.length > 30) ||
        !!(section.subheadline && section.subheadline.length > 10);
      if (type === "proof" && hasInformativeContent && !section.image) {
        return section;
      }
      return {
        ...section,
        items: buildFallbackTestimonialItems(brief),
        bullets: undefined,
      };
    }

    if (type === "pricing" || type === "offer") {
      const validPricing = existingItems.filter(
        (it) =>
          it.kind === "pricing" &&
          it.data?.name &&
          it.data?.price &&
          Array.isArray(it.data?.features),
      );
      if (validPricing.length >= 1) {
        return { ...section, items: validPricing, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const fallback = buildFallbackPricingItems(brief);
        const basePricing = (fallback[0] as Extract<SectionItem, { kind: "pricing" }>).data;
        const enriched: SectionItem[] = [
          {
            kind: "pricing" as const,
            data: {
              ...basePricing,
              features: section.bullets,
            },
          },
        ];
        return { ...section, items: enriched, bullets: undefined };
      }
      return { ...section, items: buildFallbackPricingItems(brief), bullets: undefined };
    }

    if (type === "bonus") {
      const validBonus = existingItems.filter(
        (it) => it.kind === "bonus" && it.data?.title,
      );
      if (validBonus.length >= 1) {
        return { ...section, items: validBonus, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const items = convertBulletsToBonusItems(section.bullets);
        return { ...section, items, bullets: undefined };
      }
      return { ...section, items: buildFallbackBonusItems(brief), bullets: undefined };
    }

    if (type === "guarantee") {
      const validGuarantee = existingItems.filter(
        (it) => it.kind === "guarantee" && it.data?.title,
      );
      if (validGuarantee.length >= 1) {
        return { ...section, items: validGuarantee.slice(0, 1), bullets: undefined };
      }
      return { ...section, items: buildFallbackGuaranteeItems(brief), bullets: undefined };
    }

    return section;
  });
}

/**
 * Enrichit toutes les pages d'un funnel : remplissage des sections riches
 * uniquement. Le nettoyage final (removeOrFillEmptySections) est appelé
 * SÉPARÉMENT après la pipeline médias, pour éviter qu'il s'exécute avant
 * que les médias aient pu remplir les sections "about", "video", etc.
 */
function enrichFunnelPages(
  pages: FunnelPage[],
  brief: FunnelBrief,
  _funnelKind: FunnelKind,
): FunnelPage[] {
  return pages.map((page) => {
    const enrichedSections = enrichSectionsWithDefaults(page.sections, brief);
    return { ...page, sections: enrichedSections };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseur principal (legacy single-page)
// ─────────────────────────────────────────────────────────────────────────────
export function parseFunnelJson(raw: string, brief: FunnelBrief): Funnel {
  const clean = extractJsonPayload(raw);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(clean);
  } catch (err) {
    throw new AiGenerationError(
      "invalid-json",
      "La réponse de l'IA n'est pas un JSON valide",
      err instanceof Error ? err.message : String(err),
    );
  }

  const normalized = normalizeRawAiJson(parsedJson);
  const result = funnelSchema.safeParse(normalized);
  if (!result.success) {
    console.log("=== ZOD ERRORS (parseFunnelJson) — detailed ===");
    console.log(JSON.stringify(result.error.issues, null, 2));
    console.log("=== END ZOD ERRORS ===");
    throw new AiGenerationError(
      "schema-mismatch",
      "La réponse de l'IA ne respecte pas la structure attendue",
      JSON.stringify(result.error.flatten().fieldErrors).slice(0, 500),
    );
  }
  const parsed = result.data;

  const fallbackCta: CtaConfig =
    brief.primaryCta ??
    makeAnchorCta(
      brief.language === "fr"
        ? "Recevoir les détails"
        : brief.language === "es"
          ? "Recibir los detalles"
          : "Get the details",
      "lead-form",
    );

  const rawSections = parseSectionsArray(parsed.sections, fallbackCta, brief);
  const sections = enrichSectionsWithDefaults(rawSections, brief);

  const media = buildMediaLibraryFromBrief(brief);

  return {
    funnelName: parsed.funnelName,
    language: parsed.language,
    sections,
    thankYouPage: {
      headline: parsed.thankYouPage.headline,
      body: parsed.thankYouPage.body,
      cta: parsed.thankYouPage.cta
        ? normalizeCta(parsed.thankYouPage.cta, fallbackCta)
        : undefined,
    },
    emails: (parsed.emails ?? []).map((email) => ({
      subject: email.subject,
      html: email.html,
      text: email.text,
      cta: normalizeCta(email.cta, fallbackCta),
    })),
    seo: parsed.seo,
    design: parsed.design,
    defaultCta: fallbackCta,
    media,
    meta: {
      funnelKind: brief.funnelKind,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : instruction template
// ─────────────────────────────────────────────────────────────────────────────
function buildTemplateInstruction(
  template: ReturnType<typeof getPremiumTemplate>,
  brief: FunnelBrief,
): string {
  if (!template) return "";

  const lang = brief.language ?? "fr";
  const personality = template.personality[lang] ?? template.personality.fr;
  const expectedSections = getTemplateSectionTypes(template, brief);

  const header =
    lang === "fr"
      ? "CONTRAINTES DE TEMPLATE (à respecter strictement) :"
      : lang === "es"
        ? "RESTRICCIONES DE PLANTILLA (a respetar estrictamente):"
        : "TEMPLATE CONSTRAINTS (must be strictly respected):";

  const lines = [
    header,
    `- Template: "${template.name}" — ${personality}`,
    `- Densité: ${template.density}`,
    lang === "fr"
      ? `- Génère EXACTEMENT ces sections, dans cet ordre, en utilisant ces "type" dans le JSON :`
      : lang === "es"
        ? `- Genera EXACTAMENTE estas secciones, en este orden:`
        : `- Generate EXACTLY these sections, in this order:`,
    ...expectedSections.map((t, i) => `  ${i + 1}. "${t}"`),
    lang === "fr"
      ? `- N'ajoute pas d'autres sections. N'omet aucune section listée.`
      : lang === "es"
        ? `- No añadas otras secciones. No omitas ninguna sección listada.`
        : `- Do not add other sections. Do not omit any listed section.`,
  ];

  return "\n\n" + lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Consigne CTA stricte
// ─────────────────────────────────────────────────────────────────────────────
function buildCtaInstruction(lang: Language): string {
  const fr = `

RÈGLE STRICTE POUR LE CHAMP "cta" (à respecter pour CHAQUE section) :
- Le champ "cta" doit être un OBJET JSON exactement de cette forme :
  { "label": "Texte du bouton", "mode": "anchor", "anchorId": "lead-form" }
- "label" est OBLIGATOIRE et doit être une chaîne non vide (5 à 30 caractères).
- N'utilise JAMAIS une simple chaîne de caractères pour "cta".
- N'omet JAMAIS le champ "label" dans l'objet "cta".
- Si tu hésites, utilise : { "label": "Je veux y accéder", "mode": "anchor", "anchorId": "lead-form" }

RÈGLE STRICTE POUR LA STRUCTURE DES SECTIONS :
- Chaque section doit avoir ses champs DIRECTEMENT à la racine : "headline", "subheadline", "body", "items", "image", "cta".
- N'imbrique JAMAIS ces champs dans un sous-objet "content" : { "type": "...", "content": {...} } est INTERDIT.
- Le champ "body" doit toujours être une CHAÎNE, jamais un objet.
- Pour les items typés (faq, testimonial, pricing, bonus, guarantee), utilise OBLIGATOIREMENT le format :
  { "kind": "faq", "data": { "question": "...", "answer": "..." } }
- Pour le champ "image", utilise OBLIGATOIREMENT { "url": "...", "alt": "..." } et JAMAIS { "src": "..." }.
`;
  const en = `

STRICT RULE FOR THE "cta" FIELD (must apply to EVERY section):
- The "cta" field must be a JSON OBJECT with exactly this shape:
  { "label": "Button text", "mode": "anchor", "anchorId": "lead-form" }
- "label" is REQUIRED and must be a non-empty string (5 to 30 chars).
- NEVER use a plain string for "cta".
- NEVER omit the "label" field inside the "cta" object.

STRICT RULE FOR SECTION STRUCTURE:
- Each section must have its fields DIRECTLY at the root: "headline", "subheadline", "body", "items", "image", "cta".
- NEVER nest these fields inside a "content" sub-object: { "type": "...", "content": {...} } is FORBIDDEN.
- The "body" field must always be a STRING, never an object.
- For typed items (faq, testimonial, pricing, bonus, guarantee), use ONLY this format:
  { "kind": "faq", "data": { "question": "...", "answer": "..." } }
- For the "image" field, use ONLY { "url": "...", "alt": "..." } and NEVER { "src": "..." }.
`;
  const es = `

REGLA ESTRICTA PARA EL CAMPO "cta" (aplica a CADA sección):
- El campo "cta" debe ser un OBJETO JSON con esta forma exacta:
  { "label": "Texto del botón", "mode": "anchor", "anchorId": "lead-form" }
- "label" es OBLIGATORIO y debe ser una cadena no vacía (5 a 30 caracteres).
- NUNCA uses una cadena simple para "cta".

REGLA ESTRICTA PARA LA ESTRUCTURA DE LAS SECCIONES:
- Cada sección debe tener sus campos DIRECTAMENTE en la raíz: "headline", "subheadline", "body", "items", "image", "cta".
- NUNCA anides estos campos en un sub-objeto "content".
- El campo "body" debe ser siempre una CADENA, nunca un objeto.
- Para items tipados, usa SOLO: { "kind": "faq", "data": { "question": "...", "answer": "..." } }.
- Para el campo "image", usa SOLO { "url": "...", "alt": "..." } y NUNCA { "src": "..." }.
`;
  return lang === "fr" ? fr : lang === "es" ? es : en;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper appel OpenAI réutilisable
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAI(args: {
  systemMessage: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez",
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: args.systemMessage },
        { role: "user", content: args.userPrompt },
      ],
      temperature: args.temperature ?? 0.7,
      response_format: { type: "json_object" },
      max_tokens: args.maxTokens ?? 8000,
    });

    const rawText = response.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawText || rawText.length < 20) {
      throw new AiGenerationError(
        "empty-response",
        "L'IA a retourné une réponse vide. Réessayez la génération",
      );
    }
    return rawText;
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number; code?: string })?.status;
    const code = (error as { status?: number; code?: string })?.code;

    if (status === 401 || status === 403 || code === "invalid_api_key") {
      throw new AiGenerationError(
        "invalid-key",
        "La clé OpenAI a été refusée. Vérifiez sa validité sur platform.openai.com",
        message,
      );
    }
    if (status === 429 || code === "insufficient_quota") {
      const insufficient = /insufficient_quota|exceeded your current quota/i.test(message);
      throw new AiGenerationError(
        insufficient ? "insufficient-quota" : "rate-limit",
        insufficient
          ? "Quota OpenAI épuisé. Ajoutez du crédit sur platform.openai.com/account/billing"
          : "Trop de requêtes en peu de temps. Réessayez dans une minute",
        message,
      );
    }

    throw new AiGenerationError(
      "network-error",
      "Impossible de joindre OpenAI. Vérifiez votre connexion ou réessayez dans un instant",
      message,
    );
  }
}

const SYSTEM_MESSAGE_FUNNEL =
  "You are an expert funnel copywriter and conversion specialist. " +
  "You MUST respond with a single JSON object that strictly matches the requested schema. " +
  "Do not wrap the JSON in markdown code fences. Do not add any prose before or after the JSON. " +
  "Write all copy in the language specified in the brief, with the requested tone and target audience in mind. " +
  "Every section's \"cta\" field MUST be an object of the form { \"label\": \"...\", \"mode\": \"anchor\", \"anchorId\": \"lead-form\" }, " +
  "never a plain string, and \"label\" must always be a non-empty string. " +
  "Each section MUST have its fields directly at the root (headline, body, items, image, cta) — NEVER nested inside a 'content' sub-object. " +
  "The 'body' field MUST always be a string, never an object. " +
  "EVERY section MUST include an 'eyebrow' field (2-5 words, preferably uppercase).";

// ─────────────────────────────────────────────────────────────────────────────
// Helper : conversion MediaItem[] → MediaInput[] (pour les prompts)
// ─────────────────────────────────────────────────────────────────────────────
function toMediaInputs(medias: MediaItem[] | undefined): MediaInput[] | undefined {
  if (!medias || medias.length === 0) return undefined;
  return medias.map((m) => ({
    id: m.id,
    url: m.url?.startsWith("data:") ? `[uploaded-${m.id}]` : m.url,
    kind: m.kind,
    description: m.description,
    alt: m.alt,
    filename: m.fileName,
    sectionHint: m.sectionHint,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : convertit brief.videoUrl en MediaItem virtuel
// ─────────────────────────────────────────────────────────────────────────────
function videoUrlToMediaItem(videoUrl: string | undefined): MediaItem | null {
  if (!videoUrl || !videoUrl.trim()) return null;
  return {
    id: `brief-video-${Date.now().toString(36)}`,
    kind: "video",
    url: videoUrl.trim(),
    description: "Vidéo principale du tunnel (à placer dans la section video)",
    sectionHint: "video",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : header déterministe construit depuis le brief
// ─────────────────────────────────────────────────────────────────────────────
function buildDeterministicHeader(
  brief: FunnelBrief,
  fallbackCta: CtaConfig,
): FunnelHeader {
  return {
    enabled: true,
    displayMode: brief.logoUrl ? "both" : "name",
    logoUrl: brief.logoUrl,
    brandName: brief.brandName,
    sticky: true,
    transparent: false,
    cta: brief.primaryCta ?? fallbackCta,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE MÉDIAS RÉUTILISABLE — appliquée en DERNIER sur toutes les pages
// ─────────────────────────────────────────────────────────────────────────────
function applyMediaPipeline(
  page: FunnelPage,
  brief: FunnelBrief,
  briefMediasWithVideo: MediaItem[],
  funnelKind: FunnelKind,
): FunnelPage {
  let sections = placeMediasIntoSections(page.sections, briefMediasWithVideo, {
    funnelKind,
    role: page.role,
  });
  sections = enforceHeroSingleMedia(sections, {
    funnelKind,
    role: page.role,
  });
  sections = ensureBriefVideoInSections(sections, brief.videoUrl, {
    funnelKind,
    role: page.role,
  });
  return { ...page, sections };
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération multi-pages (fonction principale)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMultiPageFunnelWithAI(brief: FunnelBrief): Promise<Funnel> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez",
    );
  }

  const normalizedKind = normalizeFunnelKind(brief.funnelKind) ?? "lead-magnet";
  const funnelBlueprint = getFunnelBlueprint(normalizedKind);
  const blueprints = funnelBlueprint.pages;

  if (blueprints.length === 0) {
    console.warn(
      `[generateMultiPageFunnelWithAI] Pas de catalogue pour kind="${brief.funnelKind}", fallback monopage`,
    );
    return generateFunnelWithAI(brief);
  }

  const homeRole = getHomeRoleForKind(normalizedKind);
  const mainBlueprint =
    blueprints.find((b) => b.role === homeRole) ?? blueprints[0];
  const secondaryBlueprints = blueprints.filter((b) => b !== mainBlueprint);

  const template =
    getPremiumTemplate(brief.templateId) ??
    getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
    PREMIUM_TEMPLATES[0];

  console.info(
    `[generateMultiPageFunnelWithAI] Lancement de la génération en parallèle (Main + ${secondaryBlueprints.length} pages secondaires)...`,
  );

  const ctaInstruction = buildCtaInstruction(brief.language);

  const videoMediaItem = videoUrlToMediaItem(brief.videoUrl);
  const briefMediasWithVideo: MediaItem[] = [
    ...(brief.medias ?? []),
    ...(videoMediaItem ? [videoMediaItem] : []),
  ];

  const mainPromptText =
    mainPagePrompt({
      brand: brief.brandName,
      offer: brief.offerName,
      audience: brief.targetAudience,
      funnelKind: normalizedKind,
      language: brief.language,
      medias: toMediaInputs(briefMediasWithVideo),
      cta: brief.primaryCta
        ? { primary: brief.primaryCta.label }
        : undefined,
      videoUrl: brief.videoUrl,
      brief,
    }) + ctaInstruction;

  const mainPromise = callOpenAI({
    systemMessage: SYSTEM_MESSAGE_FUNNEL,
    userPrompt: mainPromptText,
    maxTokens: 4000,
  });

  let secondaryPromise: Promise<string | null> = Promise.resolve(null);
  if (secondaryBlueprints.length > 0) {
    const secondaryPromptText =
      secondaryPagesPrompt({
        brand: brief.brandName,
        offer: brief.offerName,
        funnelKind: normalizedKind,
        language: brief.language,
        pages: secondaryBlueprints.map((bp) => ({
          role: bp.role,
          slug: bp.slug,
          name: bp.name,
        })),
        medias: toMediaInputs(briefMediasWithVideo),
        videoUrl: brief.videoUrl,
        brief,
      }) + ctaInstruction;
    secondaryPromise = callOpenAI({
      systemMessage: SYSTEM_MESSAGE_FUNNEL,
      userPrompt: secondaryPromptText,
      maxTokens: 3500,
    });
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout AI")), 75000),
  );

  let mainRawText: string;
  let secondaryRawText: string | null = null;

  try {
    mainRawText = (await Promise.race([mainPromise, timeoutPromise])) as string;
  } catch (err) {
    console.error(
      "[generateMultiPageFunnelWithAI] Échec critique de la page principale ou timeout global:",
      err,
    );
    throw new AiGenerationError(
      "network-error",
      "Le serveur AI a mis trop de temps à répondre. Réessayez avec un brief plus court ou vérifiez votre connexion.",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (secondaryBlueprints.length > 0) {
    try {
      secondaryRawText = (await Promise.race([
        secondaryPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 60000)),
      ])) as string | null;
    } catch (secErr) {
      console.warn(
        "[generateMultiPageFunnelWithAI] Échec non-bloquant des pages secondaires:",
        secErr,
      );
      secondaryRawText = null;
    }
  }

  const rawMainJson = JSON.parse(extractJsonPayload(mainRawText));
  const normalizedMain = normalizeRawAiJson(rawMainJson);

  console.log("=== NORMALIZED MAIN (section[0]) ===");
  console.log(
    JSON.stringify(
      (normalizedMain as { sections?: unknown[] }).sections?.[0],
      null,
      2,
    ),
  );
  console.log("=== END NORMALIZED ===");

  const mainParsed = funnelSchema.safeParse(normalizedMain);
  if (!mainParsed.success) {
    console.log("=== RAW AI MAIN PAGE RESPONSE ===");
    console.log(mainRawText);
    console.log("=== END RAW MAIN ===");
    console.log("=== ZOD ERRORS (main page) — detailed ===");
    console.log(JSON.stringify(mainParsed.error.issues, null, 2));
    console.log("=== END ZOD ERRORS ===");
    console.error(
      "[generateMultiPageFunnelWithAI] Schema mismatch on main page:",
      mainParsed.error.flatten().fieldErrors,
    );
    throw new AiGenerationError(
      "schema-mismatch",
      "La page principale générée ne respecte pas la structure attendue",
      JSON.stringify(mainParsed.error.flatten().fieldErrors).slice(0, 500),
    );
  }

  const mainData = mainParsed.data;

  console.info("[generateMultiPageFunnelWithAI] Page principale générée avec succès.");

  const fallbackCta: CtaConfig =
    brief.primaryCta ??
    makeAnchorCta(
      brief.language === "fr"
        ? "Recevoir les détails"
        : brief.language === "es"
          ? "Recibir los detalles"
          : "Get the details",
      "lead-form",
    );

  const mainSections = parseSectionsArray(mainData.sections, fallbackCta, brief);

  const sectionsByRole = new Map<PageRole, FunnelSection[]>();
  sectionsByRole.set(mainBlueprint.role, mainSections);

  if (secondaryRawText) {
    try {
      console.log("=== RAW AI SECONDARY PAGES RESPONSE ===");
      console.log(secondaryRawText);
      console.log("=== END RAW SECONDARY ===");

      const secondaryParsed = secondaryPagesSchema.safeParse(
        normalizeSecondaryPagesRawJson(JSON.parse(extractJsonPayload(secondaryRawText))),
      );

      if (secondaryParsed.success) {
        for (const page of secondaryParsed.data.pages) {
          const role = page.role as PageRole;
          const sections = parseSectionsArray(page.sections, fallbackCta, brief);
          sectionsByRole.set(role, sections);
          console.info(
            `[generateMultiPageFunnelWithAI] Page secondaire "${role}" : ${sections.length} sections OK.`,
          );
        }
        console.info(
          "[generateMultiPageFunnelWithAI] Pages secondaires intégrées avec succès.",
        );
      } else {
        console.warn(
          "[generateMultiPageFunnelWithAI] Schema mismatch sur pages secondaires, utilisation des placeholders.",
        );
        console.warn("=== ZOD ERRORS (secondary pages) — detailed ===");
        console.warn(JSON.stringify(secondaryParsed.error.issues, null, 2));
        console.warn("=== END ZOD ERRORS ===");
      }
    } catch (err) {
      console.warn(
        "[generateMultiPageFunnelWithAI] Erreur de parsing des pages secondaires:",
        err,
      );
    }
  }

  const pages = buildPagesFromBlueprints({
    blueprints,
    sectionsByRole,
    brief,
    homeRole,
  });

  const media = buildMediaLibraryFromBrief(brief);
  const homePageRaw = pages.find((p) => p.isHome) ?? pages[0];
  const homeSectionsRaw = homePageRaw?.sections ?? mainSections;

  // ===== ÉTAPE 1 : Funnel brut (pages IA, pas encore de template ni de médias) =====
  const aiFunnel: Funnel = {
    funnelName: mainData.funnelName,
    language: mainData.language,
    pages,
    sections: homeSectionsRaw,
    thankYouPage: {
      headline: mainData.thankYouPage.headline,
      body: mainData.thankYouPage.body,
      cta: mainData.thankYouPage.cta
        ? normalizeCta(mainData.thankYouPage.cta, fallbackCta)
        : undefined,
    },
    emails: (mainData.emails ?? []).map((email) => ({
      subject: email.subject,
      html: email.html,
      text: email.text,
      cta: normalizeCta(email.cta, fallbackCta),
    })),
    seo: mainData.seo,
    design: mainData.design,
    defaultCta: fallbackCta,
    media,
    meta: {
      funnelKind: normalizedKind ?? brief.funnelKind,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
      schemaVersion: 2,
    },
  };

  // ===== ÉTAPE 2 : Application du template (style uniquement, JAMAIS de média) =====
  const styledFunnel = applyTemplateToFunnel(template, aiFunnel, brief);
  const styleMap = buildStyleMapByType(styledFunnel.sections);
  const filteredPages = styledFunnel.pages ?? pages;

  // ===== ÉTAPE 3 : Filtrage par blueprint + style (sans toucher aux médias) =====
  const styledPages: FunnelPage[] = filteredPages.map((page) => {
    const blueprint = getPageBlueprint(normalizedKind, page.role);
    let sections = blueprint
      ? filterSectionsByBlueprint(page.sections, blueprint)
      : page.sections;
    sections = applyStyleMapToSections(sections, styleMap);
    return { ...page, sections };
  });

  // ===== ÉTAPE 4 : Enrichissement riche (faq, testimonials, pricing, bonus, guarantee) =====
  const enrichedPages = enrichFunnelPages(styledPages, brief, normalizedKind);

  // ===== ÉTAPE 5 : 🎯 PIPELINE MÉDIAS — en DERNIER, sur TOUTES les pages =====
  // À ce stade plus aucune étape postérieure ne peut réintroduire un média parasite.
  const pagesWithMedias: FunnelPage[] = enrichedPages.map((page) =>
    applyMediaPipeline(page, brief, briefMediasWithVideo, normalizedKind),
  );

  // ===== ÉTAPE 6 : Nettoyage final (suppression des sections non autorisées ou vides) =====
  const cleanedPages: FunnelPage[] = pagesWithMedias.map((page) => {
    const allowed = getAllowedSectionTypes(normalizedKind, page.role);
    const stats = removeOrFillEmptySections(page, allowed, brief);
    if (stats.removed > 0 || stats.filled > 0) {
      console.log(
        `[final-clean] page "${page.role}" : ${stats.kept} gardées, ` +
          `${stats.removed} supprimées, ${stats.filled} remplies.`,
      );
    }
    return page;
  });

  // ===== ÉTAPE 7 : Re-chaînage de la navigation entre pages =====
  const rechainedPages = chainPagesNavigation(cleanedPages);
  const rechainedHome = rechainedPages.find((p) => p.isHome) ?? rechainedPages[0];

  const deterministicHeader = buildDeterministicHeader(brief, fallbackCta);

  return {
    ...styledFunnel,
    pages: rechainedPages,
    sections: rechainedHome?.sections ?? homeSectionsRaw,
    media: styledFunnel.media ?? media,
    header: styledFunnel.header ?? deterministicHeader,
    meta: {
      ...(styledFunnel.meta ?? {}),
      templateId: template.id,
      schemaVersion: 2,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération legacy single-page
// ─────────────────────────────────────────────────────────────────────────────
export async function generateFunnelWithAI(brief: FunnelBrief): Promise<Funnel> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez",
    );
  }

  const template =
    getPremiumTemplate(brief.templateId) ??
    getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
    PREMIUM_TEMPLATES[0];

  const basePrompt = completeFunnelPrompt(brief);
  const templateInstruction = buildTemplateInstruction(template, brief);
  const ctaInstruction = buildCtaInstruction(brief.language);
  const finalPrompt = basePrompt + templateInstruction + ctaInstruction;

  const rawText = await callOpenAI({
    systemMessage: SYSTEM_MESSAGE_FUNNEL,
    userPrompt: finalPrompt,
    maxTokens: 8000,
  });

  const aiFunnel = parseFunnelJson(rawText, brief);

  const videoMediaItem = videoUrlToMediaItem(brief.videoUrl);
  const briefMediasWithVideo: MediaItem[] = [
    ...(brief.medias ?? []),
    ...(videoMediaItem ? [videoMediaItem] : []),
  ];

  const normalizedKind = normalizeFunnelKind(brief.funnelKind) ?? "lead-magnet";
  const homeRole = getHomeRoleForKind(normalizedKind);

  // ===== ÉTAPE 1 : Application du template (style uniquement) =====
  const styledFunnel = applyTemplateToFunnel(template, aiFunnel, brief);

  // ===== ÉTAPE 2 : Enrichissement riche =====
  const enrichedSections = enrichSectionsWithDefaults(styledFunnel.sections, brief);

  // ===== ÉTAPE 3 : 🎯 PIPELINE MÉDIAS — en DERNIER =====
  let processedSections = placeMediasIntoSections(
    enrichedSections,
    briefMediasWithVideo,
    { funnelKind: normalizedKind, role: homeRole },
  );
  processedSections = enforceHeroSingleMedia(processedSections, {
    funnelKind: normalizedKind,
    role: homeRole,
  });
  processedSections = ensureBriefVideoInSections(
    processedSections,
    brief.videoUrl,
    { funnelKind: normalizedKind, role: homeRole },
  );

  // ===== ÉTAPE 4 : Nettoyage final =====
  const fakeHomePage: FunnelPage = {
    id: "home",
    slug: "/",
    name: "Accueil",
    role: homeRole,
    sections: processedSections,
    visible: true,
    isHome: true,
  };
  const allowed = getAllowedSectionTypes(normalizedKind, homeRole);
  const stats = removeOrFillEmptySections(fakeHomePage, allowed, brief);
  if (stats.removed > 0 || stats.filled > 0) {
    console.log(
      `[final-clean single-page] ${stats.kept} gardées, ` +
        `${stats.removed} supprimées, ${stats.filled} remplies.`,
    );
  }

  const fallbackCta: CtaConfig =
    brief.primaryCta ??
    makeAnchorCta(
      brief.language === "fr" ? "Recevoir les détails" : "Get the details",
      "lead-form",
    );
  const deterministicHeader = buildDeterministicHeader(brief, fallbackCta);

  return {
    ...styledFunnel,
    sections: fakeHomePage.sections,
    media: styledFunnel.media ?? aiFunnel.media,
    header: styledFunnel.header ?? deterministicHeader,
    meta: {
      ...(styledFunnel.meta ?? {}),
      templateId: template.id,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tunnel de démo
// ─────────────────────────────────────────────────────────────────────────────
export function createDemoFunnel(brief: FunnelBrief): Funnel {
  const isFr = brief.language === "fr";
  const isEs = brief.language === "es";

  const ctaLabel = isFr ? "Obtenir l'accès" : isEs ? "Obtener el acceso" : "Get access";
  const primaryCta: CtaConfig = brief.primaryCta ?? makeAnchorCta(ctaLabel, "lead-form");

  const mood = getMood(brief.moodId);
  const primaryColor = brief.mainColor ?? mood?.primary ?? "#080E1A";
  const secondaryColor = brief.secondaryColor ?? mood?.secondary ?? "#C7A436";
  const accentColor = mood?.accent ?? "#31845C";

  const t = (fr: string, en: string, es: string) => (isFr ? fr : isEs ? es : en);

  const sections: FunnelSection[] = [
    {
      id: "hero",
      type: "hero",
      eyebrow: brief.funnelType,
      headline: `${brief.offerName} : ${brief.promise}`,
      subheadline: t(
        `Un tunnel pensé pour ${brief.targetAudience}`,
        `A funnel built for ${brief.targetAudience}`,
        `Un embudo pensado para ${brief.targetAudience}`,
      ),
      cta: primaryCta,
      image: { mode: brief.defaultImageMode ?? "none" },
      visible: true,
    },
  ];

  return {
    funnelName: `${brief.brandName} — ${brief.offerName}`,
    language: brief.language,
    sections,
    thankYouPage: {
      headline: t("Merci", "Thank you", "Gracias"),
      body: t(
        "Votre demande est confirmée",
        "Your request is confirmed",
        "Tu solicitud est confirmada",
      ),
      cta: makeAnchorCta(t("Retour", "Back", "Volver"), "top"),
    },
    emails: [],
    seo: {
      title: `${brief.offerName} | ${brief.brandName}`,
      description: brief.promise,
    },
    design: {
      primaryColor,
      secondaryColor,
      accentColor,
      style: brief.designStyle,
    },
    defaultCta: primaryCta,
    meta: {
      funnelKind: brief.funnelKind,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
    },
  };
}
