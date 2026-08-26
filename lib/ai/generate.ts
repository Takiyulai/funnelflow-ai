// lib/ai/generate.ts
import { z, type ZodIssue } from "zod";
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
  TimerItem,
} from "@/lib/funnels/types";
import { makeAnchorCta, makeRedirectCta, normalizeIconName, makePageId } from "@/lib/funnels/types";
import { buildWebinarIcsDataUri } from "@/lib/funnels/ics";
import {
  toWallClockString,
  wallClockToUtcDate,
  utcDateToWallClock,
  formatEventLong,
} from "@/lib/funnels/eventDate";
import {
  completeFunnelPrompt,
  mainPagePrompt,
  secondaryPagesPrompt,
  sequenceGenerationPrompt,
  type MediaInput,
} from "./prompts";
import type {
  SequenceEmailDraft,
  SequenceGenerationInput,
} from "@/lib/crm/types";
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
  buildPlaceholderPage,
  chainPagesNavigation,
  filterSectionsByBlueprint,
} from "@/lib/funnels/pageGenerator";
import { normalizeFunnelKind } from "@/lib/funnels/kinds";
// 🆕 Défaut + bornes de durée du challenge, partagés avec le wizard, le schéma
// zod de la route et le prompt. Voir lib/funnels/challenge.ts.
import { resolveChallengeDays } from "@/lib/funnels/challenge";
// 🆕 B3 — Résolution du mode de réservation (natif / externe). Module PUR :
// aucun accès base, importable côté serveur comme côté client.
import { externalCalendarUrl, resolveBookingMode } from "@/lib/booking/mode";
import { isUsableMediaUrl } from "@/lib/funnels/resolveMedia";
import {
  getFunnelBlueprint,
  getPageBlueprint,
  getHeroMediaPolicy,
  getAllowedSectionTypes,
  sectionTypeAcceptsImage,
  sectionTypeAcceptsAvatars,
  sectionTypeAcceptsVideo,
  type PageBlueprint,
} from "@/lib/funnels/pageCatalogs";
import { removeOrFillEmptySections, dedupeSectionsAcrossPages,
  ensurePricingOnConversionPage, tryFillSectionFromBrief,
  isSectionEmpty, isPlaceholderHeadline, } from "@/lib/funnels/sectionFillers";
import {
  getCTAConfig,
  getArchetype,
  resolveCTAIntent,
  OFFER_PRIMARY_LABEL,
  type CTAIntent,
} from "./cta-matrix";


// ─────────────────────────────────────────────────────────────────────────────
// Helper : retire le CTA d'une section de façon type-safe
// ─────────────────────────────────────────────────────────────────────────────
function stripCta(section: FunnelSection): FunnelSection {
  // On reconstruit la section sans la propriété cta, type-safe (pas de any).
  const next: FunnelSection = { ...section };
  delete (next as { cta?: CtaConfig }).cta;
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : détecte si l'offre est gratuite
// ─────────────────────────────────────────────────────────────────────────────
function isFreeOffer(price: string | undefined): boolean {
  if (!price) return false;
  const normalized = price.trim().toLowerCase();
  return /^(gratuit|free|gratis|0|0€|0\s*€|sans\s*frais|offert|libre)$/i.test(normalized);
}

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

// 🆕 Sous-étape A (P1) : l'ordre compte (1re règle qui matche gagne).
// "about" (photo de l'auteur/coach) est placé AVANT "testimonials" pour qu'une
// photo de l'auteur décrite avec ses clients ("moi, le coach, qui aide mes
// clients") soit reconnue comme média auteur, jamais comme témoignage.
// La règle "testimonials" n'accepte plus que des marqueurs EXPLICITES de
// témoignage client : on a retiré les mots génériques "client", "customer",
// "screenshot", "capture d'écran", "opinion" qui faisaient fuiter des photos
// d'auteur ou des visuels produit dans les témoignages.
const MEDIA_KEYWORD_MAP: Array<{ section: FunnelSectionType; keywords: RegExp }> = [
  {
    section: "about",
    keywords:
      /\b(coach|fondateur|founder|about\s*me|[àa]\s*propos|portrait|photo\s*de\s*moi|profile|profil|equipo|sobre\s*m[ií]|biographie|bio)\b/i,
  },
  {
    section: "testimonials",
    keywords:
      /\b(t[ée]moignage|avis\s*client|client\s*review|customer\s*review|testimonial|testimonio|rese[ñn]a)\b/i,
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
        const realRef = real.id || real.url || placeholderImg;
        // Anti-duplication : un même média ne doit pas se retrouver sur
        // plusieurs sections (l'IA réutilise parfois le même [uploaded-id]).
        if (alreadyPlaced.has(realRef)) {
          section.image = { mode: "none" };
        } else {
          attachMediaToSection(section, real);
          alreadyPlaced.add(realRef);
        }
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

    const hintType = media.sectionHint as FunnelSectionType | undefined;
    const detectedType = detectSectionFromKeywords(media);
    let targetType: FunnelSectionType =
      hintType ||
      detectedType ||
      fallbackSectionByKind(media.kind || "image");

    // 🆕 Sous-étape A (P1) — INVARIANT TÉMOIGNAGES :
    // Une section "testimonials" ne peut recevoir QUE des médias explicitement
    // fournis comme témoignages clients, c.-à-d. sectionHint="testimonials" ou
    // un mot-clé de témoignage explicite détecté. Tout autre média qui
    // retomberait sur "testimonials" (photo auteur, fallback…) est redirigé
    // vers "about" — un média auteur n'apparaît JAMAIS dans les témoignages.
    const isExplicitTestimonial =
      hintType === "testimonials" || detectedType === "testimonials";
    if (targetType === "testimonials" && !isExplicitTestimonial) {
      targetType = "about";
    }

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
      // 🆕 Jamais deux hero : si la cible est "hero" mais qu'un hero existe
      // déjà (avec média), on crée une section "about" à la place.
      const heroExists = result.some((s) => s.type === "hero");
      const createType: FunnelSectionType =
        targetType === "hero" && heroExists ? "about" : targetType;
      const newSection = createSectionWithMedia(createType, media);
      const heroIdx = result.findIndex((s) => s.type === "hero");
      if (heroIdx >= 0) {
        result.splice(heroIdx + 1, 0, newSection);
      } else {
        result.push(newSection);
      }
      alreadyPlaced.add(ref);
    }
  }

  // ─── PASS 3 : remplir les avatars testimonials UNIQUEMENT avec des images
  // explicitement destinées aux témoignages (sectionHint="testimonials").
  // 🆕 Avant, toute image uploadée non placée (photo du coach, visuel produit…)
  // était versée dans les avatars de témoignages → elle se retrouvait à tort en
  // haut de page. Les images génériques passent désormais au PASS 4 (about/…).
  const unplacedImages = medias.filter(
    (m) =>
      (m.kind || "image") === "image" &&
      m.url &&
      !alreadyPlaced.has(m.id || m.url) &&
      m.sectionHint === "testimonials",
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

  // ─── PASS 5 : 🆕 l'image auteur doit apparaître AUSSI dans le hero (en plus
  // du about). Demande explicite : la photo de l'auteur est visible dans le hero
  // ET dans le about. On copie l'image du "about" vers le "hero" SI ce dernier
  // n'a ni image ni vidéo (la vidéo prime sur le hero). Duplication VOULUE.
  const heroSection = result.find((s) => s.type === "hero");
  const aboutWithImg = result.find((s) => s.type === "about" && s.image?.url);
  if (
    heroSection &&
    aboutWithImg?.image?.url &&
    !heroSection.image?.url &&
    !heroSection.video?.url
  ) {
    heroSection.image = {
      ...aboutWithImg.image,
      mode:
        aboutWithImg.image.mode && aboutWithImg.image.mode !== "none"
          ? aboutWithImg.image.mode
          : "upload",
    };
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

  // 🆕 RÈGLE STRICTE : une image uploadée au wizard ne va JAMAIS dans les
  // témoignages (ni en avatar, ni en image de section). Les avatars de
  // témoignages ne sont remplis que par des images EXPLICITEMENT destinées aux
  // témoignages (sectionHint="testimonials"), géré ailleurs — pas ici.
  if (section.type === "testimonials") {
    return;
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
    offer: "Votre offre",
    benefits: "Ce que vous allez gagner",
    bonus: "Vos bonus",
    guarantee: "Garantie sans risque",
    faq: "Vos questions",
    problem: "Le vrai problème",
    agitation: "Ce que ça vous coûte",
    solution: "La solution",
    urgency: "C'est maintenant",
    process: "Comment ça marche",
    hero: "",
    cta: "",
  };
  // 🆕 Plus JAMAIS de "Section" littéral : à défaut on renvoie une chaîne vide
  // → isSectionEmpty traitera la section comme vide (remplie ou supprimée).
  return titles[type] ?? "";
}

function pickFallbackAllowedSection(
  media: MediaItem,
  allowed: readonly FunnelSectionType[],
): FunnelSectionType {
  const kind = media.kind || "image";
  // 🆕 Pour une IMAGE, on préfère HERO/about (visuel principal) AVANT
  // testimonials : une image uploadée (ex. « photo du coach ») doit atterrir
  // dans le hero/à-propos, pas comme avatar de témoignage par défaut.
  const preferences: FunnelSectionType[] =
    kind === "video"
      ? ["video", "hero", "about", "testimonials"]
      : ["about", "hero", "proof", "pricing", "testimonials"];
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

  // 🆕 Tunnel VIDÉO ("prefer-video") : une image SEULE dans le hero n'a rien à y
  // faire (le hero est réservé à la vidéo / au formulaire). On la déplace vers
  // about/preuve plutôt que de la laisser remplacer la vidéo attendue.
  if (policy === "prefer-video" && hasImage && !hasVideo) {
    const movedImg: MediaItem = {
      id: `moved_${Date.now()}`,
      kind: "image",
      url: hero.image?.url || hero.image?.mediaRef || "",
      alt: hero.image?.alt || "",
    };
    hero.image = { mode: "none" };
    result[heroIdx] = hero;

    const allowedImg = getAllowedSectionTypes(opts.funnelKind, opts.role);
    let moveTo: FunnelSectionType = "about";
    if (allowedImg && !allowedImg.includes(moveTo)) {
      moveTo = pickFallbackAllowedSection(movedImg, allowedImg);
    }
    const target = result.find(
      (s, i) => i !== heroIdx && s.type === moveTo && !hasMediaAttached(s),
    );
    if (target) {
      attachMediaToSection(target, movedImg);
    } else if (!allowedImg || allowedImg.includes(moveTo)) {
      result.splice(heroIdx + 1, 0, createSectionWithMedia(moveTo, movedImg));
    }
    return result;
  }

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
    if (heroSection?.video?.url) {
      heroSection.video = undefined;
    }

    if (dedicatedVideoSections.length > 0) {
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

  if (heroSection && (!allowedSet || allowedSet.has("hero"))) {
    heroSection.video = videoSource;
    if (heroSection.image?.url) {
      heroSection.image = { mode: "none" };
    }
    result = result.filter((s) => s.type !== "video");
    return result;
  }

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
  | "invalid-model"
  | "unknown";

export class AiGenerationError extends Error {
  reason: AiErrorReason;
  details?: string;
  /**
   * Issues Zod conservées côté serveur pour produire un message utilisateur
   * sûr. Elles ne doivent jamais être sérialisées directement dans une réponse
   * API : la route se charge d'en extraire uniquement un libellé et une raison
   * en français simple.
   */
  validationIssues?: ZodIssue[];

  constructor(
    reason: AiErrorReason,
    message: string,
    details?: string,
    validationIssues?: ZodIssue[],
  ) {
    super(message);
    this.name = "AiGenerationError";
    this.reason = reason;
    this.details = details;
    this.validationIssues = validationIssues;
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
      accentColor2: z.string().optional(),
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

    return {
      ...sec,
      style: sec.style ?? styling.style,
      visualDirection: sec.visualDirection ?? styling.visualDirection,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichissement des sections riches
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
  const free = isFreeOffer(brief.price);
  const archetype = getArchetype(brief.funnelKind);

  // Features adaptées au TYPE de tunnel (transformation vs accès produit)
  type FeaturePack = { fr: string[]; en: string[]; es: string[] };

  const featuresByArchetype: Record<string, { free: FeaturePack; paid: FeaturePack }> = {
    registration: {
      // Webinaire / challenge : on parle de transformation et d'apprentissage
      free: {
        fr: [
          `Une méthode concrète appliquée pas à pas pendant la session`,
          `Les erreurs à éviter pour gagner des mois de travail`,
          `Une session live avec Q&R personnalisé à la fin`,
          `Le replay offert si vous ne pouvez pas être présent en direct`,
        ],
        en: [
          `A concrete method walked through step by step during the session`,
          `The mistakes to avoid to save months of work`,
          `A live session with personalized Q&A at the end`,
          `The replay included if you can't attend live`,
        ],
        es: [
          `Un método concreto aplicado paso a paso durante la sesión`,
          `Los errores a evitar para ganar meses de trabajo`,
          `Una sesión en vivo con preguntas y respuestas personalizadas`,
          `El replay incluido si no puedes asistir en directo`,
        ],
      },
      paid: {
        fr: [
          `Une stratégie complète pour ${brief.promise}`,
          `Des cas concrets décortiqués en direct`,
          `Un accompagnement personnalisé après la session`,
          `Accès à la communauté privée des participants`,
        ],
        en: [
          `A complete strategy to ${brief.promise}`,
          `Real-world cases broken down live`,
          `Personalized follow-up after the session`,
          `Access to the private community of participants`,
        ],
        es: [
          `Una estrategia completa para ${brief.promise}`,
          `Casos reales analizados en directo`,
          `Seguimiento personalizado tras la sesión`,
          `Acceso a la comunidad privada de participantes`,
        ],
      },
    },
    booking: {
      // RDV / coaching : on parle d'accompagnement personnalisé
      free: {
        fr: [
          `Un appel découverte de 30 minutes en visio`,
          `Un diagnostic personnalisé de votre situation`,
          `Un plan d'action concret repartir avec`,
          `Aucun engagement, aucune obligation d'achat`,
        ],
        en: [
          `A 30-minute discovery call via video`,
          `A personalized diagnosis of your situation`,
          `A concrete action plan to leave with`,
          `No commitment, no obligation to buy`,
        ],
        es: [
          `Una llamada de descubrimiento de 30 minutos por videollamada`,
          `Un diagnóstico personalizado de tu situación`,
          `Un plan de acción concreto para llevarte`,
          `Sin compromiso, sin obligación de compra`,
        ],
      },
      paid: {
        fr: [
          `Un accompagnement personnalisé avec ${brief.brandName}`,
          `Des objectifs clairs et mesurables`,
          `Un suivi régulier pour garantir vos résultats`,
          `Une transformation durable de votre situation`,
        ],
        en: [
          `Personalized support with ${brief.brandName}`,
          `Clear, measurable objectives`,
          `Regular follow-up to guarantee your results`,
          `A lasting transformation of your situation`,
        ],
        es: [
          `Acompañamiento personalizado con ${brief.brandName}`,
          `Objetivos claros y medibles`,
          `Seguimiento regular para garantizar tus resultados`,
          `Una transformación duradera de tu situación`,
        ],
      },
    },
    download: {
      // Lead magnet : on parle du contenu et de ce qu'on apprend
      free: {
        fr: [
          `Un guide actionnable de A à Z, prêt à appliquer`,
          `Des exemples concrets et des templates inclus`,
          `Livré immédiatement par email après inscription`,
          `Sans carte bancaire, sans engagement`,
        ],
        en: [
          `An actionable A-to-Z guide, ready to apply`,
          `Concrete examples and templates included`,
          `Delivered instantly by email after signup`,
          `No credit card, no commitment`,
        ],
        es: [
          `Una guía accionable de la A a la Z, lista para aplicar`,
          `Ejemplos concretos y plantillas incluidas`,
          `Entregado al instante por email tras la inscripción`,
          `Sin tarjeta bancaria, sin compromiso`,
        ],
      },
      paid: {
        fr: [
          `Le guide complet pour ${brief.promise}`,
          `Des bonus exclusifs réservés aux acheteurs`,
          `Accès à vie au contenu et aux mises à jour`,
          `Garantie satisfait ou remboursé 30 jours`,
        ],
        en: [
          `The complete guide to ${brief.promise}`,
          `Exclusive bonuses reserved for buyers`,
          `Lifetime access to content and updates`,
          `30-day money-back guarantee`,
        ],
        es: [
          `La guía completa para ${brief.promise}`,
          `Bonos exclusivos reservados a compradores`,
          `Acceso de por vida al contenido y actualizaciones`,
          `Garantía de devolución de 30 días`,
        ],
      },
    },
    purchase: {
      // Vente de produit / formation : features produit classiques
      free: {
        fr: [
          `Accès immédiat à ${brief.offerName}`,
          `Sans carte bancaire ni engagement`,
          `Compatible mobile, tablette et ordinateur`,
          `Annulez à tout moment, sans condition`,
        ],
        en: [
          `Instant access to ${brief.offerName}`,
          `No credit card, no commitment`,
          `Mobile, tablet and desktop compatible`,
          `Cancel anytime, no questions asked`,
        ],
        es: [
          `Acceso inmediato a ${brief.offerName}`,
          `Sin tarjeta bancaria ni compromiso`,
          `Compatible con móvil, tableta y escritorio`,
          `Cancela en cualquier momento, sin condiciones`,
        ],
      },
      paid: {
        fr: [
          `Accès complet à ${brief.offerName}`,
          `Compatible mobile, tablette et ordinateur`,
          `Mises à jour à vie incluses`,
          `Garantie satisfait ou remboursé 30 jours`,
        ],
        en: [
          `Full access to ${brief.offerName}`,
          `Mobile, tablet and desktop compatible`,
          `Lifetime updates included`,
          `30-day money-back guarantee`,
        ],
        es: [
          `Acceso completo a ${brief.offerName}`,
          `Compatible con móvil, tableta y escritorio`,
          `Actualizaciones de por vida incluidas`,
          `Garantía de devolución de 30 días`,
        ],
      },
    },
    "post-conversion": {
      // Page thank-you isolée : features minimalistes
      free: {
        fr: [`Accès immédiat`, `Sans engagement`, `Contenu de qualité`],
        en: [`Instant access`, `No commitment`, `Quality content`],
        es: [`Acceso inmediato`, `Sin compromiso`, `Contenido de calidad`],
      },
      paid: {
        fr: [`Accès complet`, `Support inclus`, `Contenu de qualité`],
        en: [`Full access`, `Support included`, `Quality content`],
        es: [`Acceso completo`, `Soporte incluido`, `Contenido de calidad`],
      },
    },
  };

  const pack = featuresByArchetype[archetype] ?? featuresByArchetype.purchase;
  const featuresPack = free ? pack.free : pack.paid;
  const features = featuresPack[lang] ?? featuresPack.fr;

  // Label CTA adapté à l'archétype + gratuité
  const ctaLabelsByArchetype: Record<string, { free: Record<Language, string>; paid: Record<Language, string> }> = {
    registration: {
      free: { fr: "Je réserve ma place", en: "I save my spot", es: "Reservo mi lugar" },
      paid: { fr: "Je m'inscris", en: "I register", es: "Me inscribo" },
    },
    booking: {
      free: { fr: "Je réserve mon créneau", en: "I book my slot", es: "Reservo mi cita" },
      paid: { fr: "Je réserve", en: "I book", es: "Reservo" },
    },
    download: {
      free: { fr: "Je télécharge maintenant", en: "Download now", es: "Descargar ahora" },
      paid: { fr: "Je veux le guide", en: "I want the guide", es: "Quiero la guía" },
    },
    purchase: {
      free: { fr: "Je commence maintenant", en: "Start now for free", es: "Empezar gratis ahora" },
      paid: { fr: "Je veux l'accès", en: "I want access", es: "Quiero el acceso" },
    },
    "post-conversion": {
      free: { fr: "Continuer", en: "Continue", es: "Continuar" },
      paid: { fr: "Continuer", en: "Continue", es: "Continuar" },
    },
  };
  const ctaPack = ctaLabelsByArchetype[archetype] ?? ctaLabelsByArchetype.purchase;
  const ctaLabel = free ? ctaPack.free[lang] : ctaPack.paid[lang];

  // Period adaptée
  const period = free
    ? tLang({ fr: "accès gratuit", en: "free access", es: "acceso gratuito" }, lang)
    : archetype === "booking"
      ? tLang({ fr: "à partir de", en: "starting from", es: "desde" }, lang)
      : tLang({ fr: "paiement unique", en: "one-time payment", es: "pago único" }, lang);

  // Description adaptée
  const description = free
    ? tLang(
        {
          fr: `${brief.promise} — sans engagement.`,
          en: `${brief.promise} — no commitment.`,
          es: `${brief.promise} — sin compromiso.`,
        },
        lang,
      )
    : brief.promise;

  // Nom du "plan" adapté à l'archétype (pas "BusinessGameChanger" pour un webinaire !)
  const planNameByArchetype: Record<string, Record<Language, string>> = {
    registration: { fr: "Votre place au webinaire", en: "Your webinar spot", es: "Tu lugar al webinar" },
    booking: { fr: "Votre rendez-vous", en: "Your appointment", es: "Tu cita" },
    download: { fr: "Votre accès", en: "Your access", es: "Tu acceso" },
    purchase: { fr: brief.offerName, en: brief.offerName, es: brief.offerName },
    "post-conversion": { fr: brief.offerName, en: brief.offerName, es: brief.offerName },
  };
  const planNamePack = planNameByArchetype[archetype] ?? planNameByArchetype.purchase;
  const planName = planNamePack[lang] ?? brief.offerName;

  return [
    {
      kind: "pricing" as const,
      data: {
        name: planName,
        price: brief.price,
        period,
        description,
        features,
        highlighted: false,
        badge: undefined,
        // 🆕 Palier 1 paiement : si l'offre est payante ET qu'un lien de
        // paiement a été fourni, le CTA REDIRIGE vers ce lien (Stripe Payment
        // Link, systeme.io…). Sinon, comportement historique : ancre vers le
        // formulaire de lead.
        cta:
          !free && brief.paymentUrl && brief.paymentUrl.trim().length > 0
            ? {
                label: ctaLabel,
                mode: "redirect" as const,
                url: brief.paymentUrl.trim(),
                target: "_blank" as const,
              }
            : {
                label: ctaLabel,
                mode: "anchor" as const,
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

/**
 * 🆕 Détecte une section "proof" faite de statistiques ("12K+ | Clients servis")
 * plutôt que de témoignages. Critère : ≥2 puces "valeur | label" dont la valeur
 * (partie avant le "|") est courte et contient un chiffre. Sert à préserver les
 * puces (pas de conversion en témoignages) pour le rendu stats.
 */
function looksLikeStatsBullets(bullets: unknown): boolean {
  if (!Array.isArray(bullets)) return false;
  const rows = bullets.filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (rows.length < 2) return false;
  const statLike = rows.filter((raw) => {
    const pipe = raw.indexOf("|");
    if (pipe < 0) return false;
    const value = raw.slice(0, pipe).trim();
    return value.length > 0 && value.length <= 12 && /\d/.test(value);
  });
  return statLike.length >= Math.ceil(rows.length / 2);
}

/**
 * 🆕 TRUSTBAR presse : puces "Média | courte citation" — gauche = nom court de
 * média/marque (sans chiffre), droite = phrase de validation courte. Sert à
 * router une section proof vers une bande de citations presse plutôt que des
 * témoignages classiques. Volontairement STRICT pour ne pas voler les vrais
 * témoignages (gauche courte, non chiffrée).
 */
function looksLikePressBullets(bullets: unknown): boolean {
  if (!Array.isArray(bullets)) return false;
  const rows = bullets.filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (rows.length < 2) return false;
  const pressLike = rows.filter((raw) => {
    const pipe = raw.indexOf("|");
    if (pipe < 0) return false;
    const left = raw.slice(0, pipe).trim();
    const right = raw.slice(pipe + 1).trim();
    // gauche = source courte non chiffrée ; droite = citation courte présente.
    return (
      left.length > 0 &&
      left.length <= 24 &&
      !/\d/.test(left) &&
      right.length >= 6 &&
      right.length <= 120
    );
  });
  return pressLike.length >= Math.ceil(rows.length / 2);
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
      // 🆕 STATS : une section "proof" dont les puces sont chiffrées
      // ("12K+ | Clients servis") n'est pas une preuve témoignage mais une bande
      // de statistiques. On PRÉSERVE les puces (aucune conversion en témoignages)
      // pour que le pattern stats-* puisse s'appliquer (voir StatsRenderer).
      if (
        type === "proof" &&
        existingItems.length === 0 &&
        (looksLikeStatsBullets(section.bullets) || looksLikePressBullets(section.bullets))
      ) {
        return section;
      }
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
      // 🔧 Aucune garantie de remboursement n'a de sens pour une offre gratuite
      if (isFreeOffer(brief.price)) {
        return { ...section, visible: false, items: [], bullets: undefined };
      }
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
      // 🆕 Rattachement au moteur de RDV natif : lu par harmonizeCTAsByFunnelKind
      // (étape 11) pour pointer les CTA vers /rdv/{slug}. Absent = comportement
      // historique.
      bookingSlug: brief.bookingSlug,
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
function buildCtaInstruction(lang: Language, brief?: FunnelBrief): string {
  const freeOffer = brief ? isFreeOffer(brief.price) : false;
  const priceLabel = brief?.price ?? "";

  const freeInstructionFr = freeOffer
    ? `

IMPORTANT — OFFRE GRATUITE (PRIORITÉ ABSOLUE) :
- Le prix de l'offre est "${priceLabel}" (gratuit).
- N'inclus AUCUNE mention de garantie satisfait ou remboursé, ni de remboursement sous 30 jours.
- Ne génère AUCUNE section "guarantee" basée sur l'argent ou le remboursement.
- Dans le pricing (s'il y en a un), mets en avant : accès immédiat, sans carte bancaire, sans engagement, annulation libre à tout moment.
- N'utilise PAS le badge "Recommandé" sur le pricing s'il n'y a qu'un seul plan généré.
- Les CTA doivent refléter la gratuité : "Je commence maintenant", "Recevoir gratuitement", "Accéder gratuitement", JAMAIS "Je commande" ni "Acheter".
- Adapte tout le copywriting (hero, pricing, FAQ, CTA) au fait que l'offre est 100% gratuite.

`
    : "";

  const freeInstructionEn = freeOffer
    ? `

IMPORTANT — FREE OFFER (TOP PRIORITY):
- The offer price is "${priceLabel}" (free).
- Do NOT include any money-back guarantee or 30-day refund mention.
- Do NOT generate any "guarantee" section based on money or refund.
- For pricing (if any), emphasize: instant access, no credit card, no commitment, cancel anytime.
- Do NOT use the "Recommended" badge on pricing if there's only one plan generated.
- CTAs must reflect the free nature: "Start now for free", "Get free access", NEVER "Order now" or "Buy now".
- Adapt all copywriting (hero, pricing, FAQ, CTA) to the fact that the offer is 100% free.

`
    : "";

  const freeInstructionEs = freeOffer
    ? `

IMPORTANTE — OFERTA GRATUITA (PRIORIDAD ABSOLUTA):
- El precio de la oferta es "${priceLabel}" (gratis).
- NO incluyas ninguna garantía de devolución o reembolso a 30 días.
- NO generes ninguna sección "guarantee" basada en dinero o reembolso.
- En el pricing (si lo hay), destaca: acceso inmediato, sin tarjeta bancaria, sin compromiso, cancela en cualquier momento.
- NO uses el badge "Recomendado" en el pricing si solo hay un plan generado.
- Los CTA deben reflejar la gratuidad: "Empezar gratis ahora", "Recibir gratis", NUNCA "Comprar" ni "Pedir".
- Adapta todo el copywriting (hero, pricing, FAQ, CTA) al hecho de que la oferta es 100% gratuita.

`
    : "";

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
RÈGLE STRICTE POUR LES SECTIONS À ITEMS (benefits, process, program, steps, bonus, guarantee) :
- CHAQUE item DOIT avoir une "description" de 15 à 30 mots minimum, jamais juste un titre seul.
- Le format obligatoire est : { "kind": "bonus", "data": { "title": "Titre concret de 4-8 mots", "description": "Phrase complète de 15-30 mots qui explique le bénéfice/l'étape, en s'adressant directement au lecteur." } }
- ❌ INTERDIT : { "data": { "title": "Stratégies éprouvées" } } sans description.
- ✅ CORRECT : { "data": { "title": "Stratégies éprouvées pour croître", "description": "Découvrez les méthodes testées et validées qui ont déjà permis à des dizaines d'entrepreneurs de doubler leur chiffre d'affaires en moins d'un an." } }
- Génère TOUJOURS entre 3 et 6 items par section, jamais moins.

RÈGLE STRICTE POUR LES SECTIONS "about" :
- La section "about" DOIT avoir un "body" de 80 à 200 mots minimum qui présente la marque, le coach/fondateur, ou l'entreprise.
- Le body ne peut JAMAIS être vide, même si une image est présente.
- Inclus : qui vous êtes, ce que vous faites, pour qui, et pourquoi vous le faites.

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
STRICT RULE FOR ITEM-BASED SECTIONS (benefits, process, program, steps, bonus, guarantee):
- EVERY item MUST have a "description" of at least 15-30 words, never a title alone.
- Required format: { "kind": "bonus", "data": { "title": "Concrete 4-8 word title", "description": "Full 15-30 word sentence explaining the benefit/step, speaking directly to the reader." } }
- ❌ FORBIDDEN: { "data": { "title": "Proven strategies" } } without description.
- ✅ CORRECT: { "data": { "title": "Proven growth strategies", "description": "Discover the tested and validated methods that have already helped dozens of entrepreneurs double their revenue in less than a year." } }
- Always generate between 3 and 6 items per section, never fewer.

STRICT RULE FOR "about" SECTIONS:
- The "about" section MUST have a "body" of at least 80-200 words presenting the brand, coach/founder, or company.
- The body can NEVER be empty, even if an image is present.
- Include: who you are, what you do, for whom, and why you do it.

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
REGLA ESTRICTA PARA SECCIONES CON ITEMS (benefits, process, program, steps, bonus, guarantee):
- CADA item DEBE tener una "description" de 15 a 30 palabras mínimo, nunca solo un título.
- Formato obligatorio: { "kind": "bonus", "data": { "title": "Título concreto de 4-8 palabras", "description": "Frase completa de 15-30 palabras que explica el beneficio/paso, dirigiéndose directamente al lector." } }
- ❌ PROHIBIDO: { "data": { "title": "Estrategias probadas" } } sin description.
- ✅ CORRECTO: { "data": { "title": "Estrategias probadas de crecimiento", "description": "Descubre los métodos validados que ya han ayudado a decenas de emprendedores a duplicar sus ingresos en menos de un año." } }
- Genera SIEMPRE entre 3 y 6 items por sección, nunca menos.

REGLA ESTRICTA PARA SECCIONES "about":
- La sección "about" DEBE tener un "body" de 80 a 200 palabras mínimo que presente la marca, el coach/fundador o la empresa.
- El body NUNCA puede estar vacío, incluso si hay una imagen.
- Incluye: quién eres, qué haces, para quién y por qué lo haces.

`;

  const base = lang === "fr" ? fr : lang === "es" ? es : en;
  const freeInstruction =
    lang === "fr" ? freeInstructionFr : lang === "es" ? freeInstructionEs : freeInstructionEn;

  return base + freeInstruction;
}


// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Abstraction fournisseur IA — AI_PROVIDER = "openai" (défaut) | "anthropic".
// Tout le pipeline (prompts, schémas, assemblage) reste identique : seul l'appel
// réseau change. Permet de basculer sur Claude sans réécrire la génération.
// ─────────────────────────────────────────────────────────────────────────────
type AiCallArgs = {
  systemMessage: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * 🆕 SÉCURITÉ COÛTS (audit #3) — Kill-switch global de la génération IA PAYANTE.
 * Permet de couper d'un coup TOUTE génération (bug/boucle, abus, budget dépassé)
 * en posant la variable d'env `AI_KILL_SWITCH=1` (aucun redéploiement de code —
 * juste la variable sur Vercel). Ne concerne PAS le chatbot (modèles gratuits,
 * chemin séparé).
 */
export function isAiKillSwitchOn(): boolean {
  const v = (process.env.AI_KILL_SWITCH ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export async function callAI(args: AiCallArgs): Promise<string> {
  if (isAiKillSwitchOn()) {
    throw new AiGenerationError(
      "insufficient-quota",
      "La génération IA est temporairement indisponible. Réessaie dans un moment.",
    );
  }
  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  if (provider === "anthropic" || provider === "claude") {
    return callAnthropic(args);
  }
  return callOpenAI(args);
}

// 🆕 Appel Anthropic (Messages API) via fetch — AUCUNE dépendance npm requise
// (évite de casser le build si @anthropic-ai/sdk n'est pas installé).
async function callAnthropic(args: AiCallArgs): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé Anthropic détectée. Ajoutez ANTHROPIC_API_KEY dans .env.local puis redémarrez",
    );
  }
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: args.maxTokens ?? 8000,
        temperature: args.temperature ?? 0.7,
        system:
          args.systemMessage +
          "\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte ni balises markdown autour.",
        messages: [{ role: "user", content: args.userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const status = res.status;
      if (status === 401 || status === 403) {
        throw new AiGenerationError(
          "invalid-key",
          "La clé Anthropic a été refusée. Vérifiez ANTHROPIC_API_KEY",
          errText,
        );
      }
      if (status === 429) {
        throw new AiGenerationError(
          "rate-limit",
          "Trop de requêtes Anthropic en peu de temps. Réessayez dans une minute",
          errText,
        );
      }
      if (status === 404 || status === 400) {
        throw new AiGenerationError(
          "invalid-model",
          `Le modèle Anthropic "${model}" est introuvable ou refuse ces paramètres (vérifie ANTHROPIC_MODEL). Détail : ${errText}`,
          errText,
        );
      }
      throw new AiGenerationError(
        "network-error",
        "Impossible de joindre Anthropic. Vérifiez la connexion ou réessayez",
        errText,
      );
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const rawText = (data?.content?.[0]?.text ?? "").trim();
    if (!rawText || rawText.length < 20) {
      throw new AiGenerationError(
        "empty-response",
        "Anthropic a retourné une réponse vide. Réessayez la génération",
      );
    }
    return rawText;
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;
    throw new AiGenerationError(
      "network-error",
      "Impossible de joindre Anthropic. Vérifiez la connexion ou réessayez",
      error instanceof Error ? error.message : String(error),
    );
  }
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

  // 🆕 Provider courant. L'endpoint OpenAI-compatible (base_url) permet de
  // pointer le MÊME client SDK vers OpenAI (défaut) OU vers un fournisseur
  // compatible comme Z.AI / GLM, sans réécrire les routes. OpenAI reste le
  // défaut tant qu'AI_PROVIDER n'est pas explicitement basculé.
  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const isZai = provider === "zai" || provider === "z.ai" || provider === "glm";
  // 🆕 OpenRouter : agrégateur OpenAI-compatible. On réutilise le MÊME client SDK
  // (clé dans OPENAI_API_KEY = clé OpenRouter), seul l'endpoint + le slug de
  // modèle changent. Permet d'utiliser GLM (z-ai/glm-4.6) via les crédits OpenRouter.
  const isOpenRouter =
    provider === "openrouter" || provider === "open-router" || provider === "or";

  // 🆕 Modèle : toujours piloté par OPENAI_MODEL (jamais en dur). Le fallback ne
  // sert que si la variable est absente ; en Z.AI/OpenRouter l'utilisateur fixe
  // lui-même l'identifiant exact (ex. "glm-5.2", "z-ai/glm-4.6"). On NE choisit pas.
  const model =
    process.env.OPENAI_MODEL ??
    (isZai ? "glm-4.6" : isOpenRouter ? "z-ai/glm-4.6" : "gpt-4o-mini");

  // 🆕 base_url optionnel. Z.AI et OpenRouter ont un défaut documenté ;
  // pour OpenAI on laisse undefined (le SDK utilise son endpoint natif).
  const baseURL =
    process.env.OPENAI_BASE_URL?.trim() ||
    (isZai
      ? "https://api.z.ai/api/paas/v4/"
      : isOpenRouter
        ? "https://openrouter.ai/api/v1"
        : undefined);

  // 🆕 Les modèles de raisonnement OpenAI (GPT-5.x, série o1/o3/o4…) REFUSENT
  // `max_tokens` et un `temperature` personnalisé : ils exigent
  // `max_completion_tokens` et la température par défaut. Envoyer
  // `max_tokens`/`temperature:0.7` provoque un 400 immédiat (faussement
  // rapporté comme « timeout »). On adapte donc les paramètres. Ce chemin est
  // réservé à OpenAI : GLM (glm-x.y) accepte `max_tokens` + `temperature`.
  const isReasoningModel = !isZai && !isOpenRouter && /^(gpt-5|o[1-9])/i.test(model);

  // 🆕 Les modèles de raisonnement consomment des tokens en RAISONNEMENT INTERNE
  // AVANT de produire la sortie. Avec un JSON de tunnel volumineux, un budget de
  // 8000 tokens peut être ENTIÈREMENT mangé par le raisonnement → JSON tronqué /
  // pages tardives vides (upsell/downsell/merci), à tort imputé au modèle.
  // On élargit donc fortement le budget de complétion ET on baisse l'effort de
  // raisonnement (gpt-5.x accepte `reasoning_effort`) pour réserver des tokens
  // à la sortie réelle. Surchargeable via OPENAI_REASONING_MAX_TOKENS / EFFORT.
  const reasoningMaxTokens = Number(
    process.env.OPENAI_REASONING_MAX_TOKENS ?? "16000",
  );
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT ?? "low";

  // 🆕 Budget de sortie par défaut configurable (sans hardcoder une limite basse
  // héritée d'OpenAI) : GLM-5.2 supporte jusqu'à 128K en sortie. Surchargeable
  // via OPENAI_MAX_TOKENS. Reste 8000 par défaut pour ne rien changer côté OpenAI.
  const defaultMaxTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "8000");
  // 🆕 GLM/OpenRouter : la sortie JSON d'une page est volumineuse ; un cap bas
  // (ex. 4000 passé par l'appelant) TRONQUE le JSON ("Unterminated string in
  // JSON"). On garantit donc un plancher généreux (≥ OPENAI_MAX_TOKENS, défaut
  // 8000) pour ces fournisseurs, sans changer le comportement OpenAI.
  const baseMaxTokens = args.maxTokens ?? defaultMaxTokens;
  const effectiveMaxTokens =
    isZai || isOpenRouter ? Math.max(baseMaxTokens, defaultMaxTokens) : baseMaxTokens;
  // 🆕 Température par défaut : GLM = 1.0 (défaut Z.AI, et OpenRouter quand le
  // modèle est un GLM), OpenAI = 0.7 (inchangé).
  const defaultTemperature =
    isZai || (isOpenRouter && /glm/i.test(model)) ? 1.0 : 0.7;
  // 🆕 top_p optionnel (GLM défaut 0.95). N'ajuster QU'UN seul de temperature/top_p
  // à la fois → on n'envoie top_p que s'il est explicitement configuré.
  const topP =
    process.env.OPENAI_TOP_P != null && process.env.OPENAI_TOP_P !== ""
      ? Number(process.env.OPENAI_TOP_P)
      : undefined;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(baseURL ? { baseURL } : {}),
      // 🆕 OpenRouter recommande (optionnel) ces en-têtes d'attribution. Sans
      // effet sur la génération ; surchargeables via env. Jamais envoyés ailleurs.
      ...(isOpenRouter
        ? {
            defaultHeaders: {
              "HTTP-Referer":
                process.env.OPENROUTER_SITE_URL?.trim() || "https://autofunnel.ai",
              "X-Title": process.env.OPENROUTER_APP_NAME?.trim() || "AutoFunnel AI",
            },
          }
        : {}),
    });

    const createParams = {
      model,
      messages: [
        { role: "system" as const, content: args.systemMessage },
        { role: "user" as const, content: args.userPrompt },
      ],
      response_format: { type: "json_object" as const },
      ...(isReasoningModel
        ? {
            max_completion_tokens: Math.max(effectiveMaxTokens, reasoningMaxTokens),
          }
        : {
            max_tokens: effectiveMaxTokens,
            temperature: args.temperature ?? defaultTemperature,
            ...(topP != null && !Number.isNaN(topP) ? { top_p: topP } : {}),
          }),
    };

    // `reasoning_effort` n'est pas typé dans toutes les versions du SDK : on
    // l'ajoute via un cast pour rester compatible (l'API OpenAI l'accepte pour
    // les modèles de raisonnement). Réserve plus de tokens à la sortie réelle.
    if (isReasoningModel) {
      (createParams as Record<string, unknown>).reasoning_effort = reasoningEffort;
    }

    // 🆕 Paramètres SPÉCIFIQUES à Z.AI/GLM — jamais envoyés à OpenAI (gate isZai).
    //   - thinking={"type":"enabled"|"disabled"} → ZAI_THINKING
    //   - reasoning_effort=("high"|"max")        → ZAI_REASONING_EFFORT
    // Optionnels : on ne les inclut que s'ils sont explicitement configurés.
    if (isZai) {
      const zaiThinking = process.env.ZAI_THINKING?.trim();
      if (zaiThinking) {
        (createParams as Record<string, unknown>).thinking = { type: zaiThinking };
      }
      const zaiEffort = process.env.ZAI_REASONING_EFFORT?.trim();
      if (zaiEffort) {
        (createParams as Record<string, unknown>).reasoning_effort = zaiEffort;
      }
    }

    // 🆕 OpenRouter : contrôle du "reasoning"/thinking via le param unifié
    // `reasoning`. Les modèles GLM (z-ai/glm-*) raisonnent par défaut → lent, ce
    // qui dépasse le timeout sur un gros JSON de tunnel. On DÉSACTIVE donc le
    // raisonnement par défaut (génération structurée, pas besoin de thinking) ;
    // surchargeable via OPENROUTER_REASONING = low|medium|high (ou default/model
    // pour laisser le modèle décider). Sans effet si le modèle ne le supporte pas.
    if (isOpenRouter) {
      // Routage : privilégier le provider le plus RAPIDE pour ce modèle (gros
      // levier quand le provider par défaut est lent/saturé). Surchargeable via
      // OPENROUTER_PROVIDER_SORT = throughput|latency|price (ou off pour aucun).
      const sort = process.env.OPENROUTER_PROVIDER_SORT?.trim().toLowerCase();
      if (sort === "latency" || sort === "throughput" || sort === "price") {
        (createParams as Record<string, unknown>).provider = { sort };
      } else if (sort === "off" || sort === "none" || sort === "") {
        /* aucune préférence de provider */
      } else {
        (createParams as Record<string, unknown>).provider = { sort: "throughput" };
      }

      const r = process.env.OPENROUTER_REASONING?.trim().toLowerCase();
      if (r === "low" || r === "medium" || r === "high") {
        (createParams as Record<string, unknown>).reasoning = { effort: r };
      } else if (r === "default" || r === "model" || r === "auto") {
        /* on n'envoie rien → comportement par défaut du modèle */
      } else {
        // défaut (y compris OPENROUTER_REASONING absent / "disabled" / "off") :
        // raisonnement désactivé pour la vitesse.
        (createParams as Record<string, unknown>).reasoning = { enabled: false };
      }
    }

    const response = await client.chat.completions.create(createParams);

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
    // 🆕 Modèle inexistant (404) ou requête refusée (400 : paramètre/format non
    // supporté par ce modèle, ex. GPT-5 + max_tokens). À NE PAS confondre avec un
    // timeout : on remonte la vraie cause pour faciliter le diagnostic.
    if (
      status === 404 ||
      status === 400 ||
      code === "model_not_found" ||
      code === "unsupported_parameter" ||
      code === "unknown_parameter"
    ) {
      throw new AiGenerationError(
        "invalid-model",
        `Le modèle "${model}" est introuvable ou refuse ces paramètres (vérifie OPENAI_MODEL et l'accès du compte). Détail OpenAI : ${message}`,
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

export const SYSTEM_MESSAGE_FUNNEL =
  "You are an expert funnel copywriter and conversion specialist. " +
  "You MUST respond with a single JSON object that strictly matches the requested schema. " +
  "Do not wrap the JSON in markdown code fences. Do not add any prose before or after the JSON. " +
  "Write all copy in the language specified in the brief, with the requested tone and target audience in mind. " +
  "Every section's \"cta\" field MUST be an object of the form { \"label\": \"...\", \"mode\": \"anchor\", \"anchorId\": \"lead-form\" }, " +
  "never a plain string, and \"label\" must always be a non-empty string. " +
  "Each section MUST have its fields directly at the root (headline, body, items, image, cta) — NEVER nested inside a 'content' sub-object. " +
  "The 'body' field MUST always be a string, never an object. " +
  "EVERY section MUST include an 'eyebrow' field (2-5 words, preferably uppercase)." +
  " Every item inside an items[] array (benefits, process, program, steps, bonus, guarantee) MUST include both a 'title' (4-8 words) AND a 'description' (15-30 words). Items with only a title are forbidden. " +
  "Every 'about' section MUST have a 'body' of at least 80 words. About sections with only an image and no body text are forbidden.";

// ─────────────────────────────────────────────────────────────────────────────
// Helper : conversion MediaItem[] → MediaInput[]
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

function applyFooterMeta(funnel: Funnel, brief: FunnelBrief): void {
  const existingMeta = funnel.meta ?? {};
  const businessName =
    existingMeta.businessName?.trim() || brief.brandName?.trim() || "";
  const legalNotice = existingMeta.legalNotice?.trim() || undefined;
  const contactEmail = existingMeta.contactEmail?.trim() || undefined;

  funnel.meta = {
    ...existingMeta,
    ...(businessName ? { businessName } : {}),
    ...(legalNotice ? { legalNotice } : {}),
    ...(contactEmail ? { contactEmail } : {}),
  };
}

/**
 * Harmonise les CTA selon le funnelKind et le rôle de chaque page.
 * Garantit qu'aucun CTA n'incite à une action incohérente avec sa page :
 * - Landing → tous les CTA poussent vers la page de conversion
 * - Conversion (booking/checkout/optin/registration) → CTA = action sur le form
 * - Thankyou/confirmation → pas de CTA de reconversion, juste post-action
 *
 * Fonctionne pour TOUS les types de tunnels via la matrice cta-matrix.ts.
 */
// ⚠️ EXPORTÉE UNIQUEMENT POUR LES TESTS. Cette fonction décide de la
// destination de TOUS les CTA du tunnel — et vient de causer deux régressions
// silencieuses (CTA vers une page décorative, puis ancre vers un élément
// inexistant). Elle doit être vérifiable sans monter toute la génération IA.
export function harmonizeCTAsByFunnelKind(funnel: Funnel, brief: FunnelBrief): Funnel {
  const lang = brief.language;
  const isFree = isFreeOffer(brief.price);
  const archetype = getArchetype(brief.funnelKind);
  const config = getCTAConfig(brief.funnelKind);

  console.log(
    `[cta-harmonize] funnelKind="${brief.funnelKind}" → archetype="${archetype}" (verbe: ${config.primaryVerb[lang]})`
  );

  if (!funnel.pages || funnel.pages.length === 0) {
    console.warn("[cta-harmonize] ⚠️ Funnel sans pages, harmonisation ignorée.");
    return funnel;
  }

  // Identifie la page de conversion (première dont le rôle a defaultIntent="form-scroll")
  const conversionPage = funnel.pages.find((p) => {
    const intent = config.rules[p.role]?.defaultIntent;
    return intent === "form-scroll";
  });
  const conversionPageId = conversionPage?.id;

  // 🆕 B3 — DESTINATION DE RÉSERVATION, DEUX MODES.
  //
  // Pour un tunnel Booking, la conversion n'est pas une page du tunnel : c'est
  // un calendrier. Lequel dépend du mode choisi par l'utilisateur :
  //
  //   EXTERNE  → son Calendly/Cal.com. URL ABSOLUE et `_blank` : le tunnel doit
  //              rester fonctionnel une fois exporté vers Systeme.io, où ni le
  //              moteur natif ni les chemins relatifs d'AutoFunnel n'existent.
  //   NATIF    → /rdv/{slug}, en `_self` : on reste dans le tunnel, la
  //              redirection post-réservation ramènera sur sa confirmation.
  //
  // Aucun des deux → repli historique, protégé par le garde B2 plus bas.
  const bookingMode = archetype === "booking" ? resolveBookingMode(brief) : "native";
  const externalUrl = archetype === "booking" ? externalCalendarUrl(brief) : null;

  const bookingSlug =
    archetype === "booking" && bookingMode === "native"
      ? (funnel.meta as { bookingSlug?: string } | undefined)?.bookingSlug?.trim() || null
      : null;

  const bookingTarget: { url: string; target: "_self" | "_blank" } | null =
    bookingMode === "external" && externalUrl
      ? { url: externalUrl, target: "_blank" }
      : bookingSlug
        ? { url: `/rdv/${encodeURIComponent(bookingSlug)}`, target: "_self" }
        : null;

  if (bookingTarget) {
    console.log(
      `[cta-harmonize] Réservation en mode "${bookingMode}" → CTA vers ${bookingTarget.url}`,
    );
  } else if (archetype === "booking") {
    console.warn(
      "[cta-harmonize] ⚠️ Tunnel booking sans destination de réservation " +
        "(ni slug natif, ni URL externe) → repli sur le comportement historique.",
    );
  }

  // Compteur global pour varier les labels de la landing
  let landingCtaIndex = 0;

  const patchedPages: FunnelPage[] = funnel.pages.map((page) => {
    // Filtre offre gratuite : retire les sections guarantee partout
    const filteredSections = isFree
      ? page.sections.filter((s) => s.type !== "guarantee")
      : page.sections;

    // 🆕 Ancre de l'offre PROPRE à cette page (tripwire, upsell, downsell,
    // vente post-webinaire…) : les CTA « offer-primary » y renvoient, au lieu
    // de repartir vers la page de capture du tunnel.
    const ownOfferSection = filteredSections.find(
      (s) => s.type === "pricing" || s.type === "offer",
    );

    const patchedSections: FunnelSection[] = filteredSections.map((section): FunnelSection => {
      const intent: CTAIntent = resolveCTAIntent(config, page.role, section.type);

      switch (intent) {
        // 🆕 Page qui VEND sa propre offre : label d'achat neutre + destination
        // interne à la page. Avant, ces rôles n'étaient couverts par aucune
        // règle et retombaient sur "convert-primary" : le bouton d'un tripwire
        // à 17 € affichait « Télécharger gratuitement » et ramenait le visiteur
        // sur la page d'inscription.
        case "offer-primary": {
          if (!section.cta) return section;
          const label = (config.offerPrimaryLabel ?? OFFER_PRIMARY_LABEL)[lang];
          const isOfferSection = ownOfferSection?.id === section.id;
          const anchorId =
            !isOfferSection && ownOfferSection?.id ? ownOfferSection.id : "ff-checkout";
          const nextCta: CtaConfig = {
            ...section.cta,
            label,
            mode: "anchor",
            anchorId,
            pageId: undefined,
            url: undefined,
          };
          return { ...section, cta: nextCta };
        }

        case "convert-primary": {
          if (!section.cta) return section;
          const labels = config.primaryLabels[lang];
          const label = labels[landingCtaIndex % labels.length];
          landingCtaIndex++;

          // 🆕 B3 — Priorité absolue à la destination de réservation résolue
          // (calendrier externe OU natif) : c'est le seul endroit où le
          // prospect peut réellement choisir un créneau.
          if (bookingTarget) {
            const calendarCta: CtaConfig = {
              ...section.cta,
              label,
              mode: "redirect",
              url: bookingTarget.url,
              pageId: undefined,
              target: bookingTarget.target,
            };
            return { ...section, cta: calendarCta };
          }

          // Si on a une page de conversion identifiée → navigation inter-pages
          if (conversionPageId) {
            const nextCta: CtaConfig = {
              ...section.cta,
              label,
              mode: "redirect",
              pageId: conversionPageId,
              target: "_self",
            };
            return { ...section, cta: nextCta };
          }

          // 🆕 B2 — GARDE ANTI-ANCRE-MORTE (tous types, pas seulement booking).
          //
          // Le repli historique ancrait systématiquement vers `#lead-form`.
          // Si la page ne contient AUCUNE section `form`, ce bouton ne fait
          // rien du tout : aucune erreur, aucun log, juste un CTA inerte — le
          // pire mode d'échec possible sur l'élément qui porte la conversion.
          //
          // C'est exactement ce qui s'est produit sur Booking après le retrait
          // de sa page de réservation décorative : plus de page de conversion,
          // plus de section `form`, et une ancre vers le vide.
          const hasFormSection = filteredSections.some((s) => s.type === "form");
          if (!hasFormSection) {
            console.warn(
              `[cta-harmonize] Page "${page.role}" : aucune destination de conversion ` +
                `et aucune section "form" → CTA neutralisé (une ancre vers #lead-form ` +
                `serait morte).`,
            );
            return stripCta(section);
          }

          // Sinon, on scrolle vers le form de la page courante
          const anchorCta: CtaConfig = {
            ...section.cta,
            label,
            mode: "anchor",
            anchorId: "lead-form",
          };
          return { ...section, cta: anchorCta };
        }

        case "form-scroll": {
          if (!section.cta) return section;
          const nextCta: CtaConfig = {
            ...section.cta,
            label: config.formSubmitLabel[lang],
            mode: "anchor",
            anchorId: "lead-form",
          };
          return { ...section, cta: nextCta };
        }

        case "form-submit": {
          if (!section.cta) return section;
          const nextCta: CtaConfig = {
            ...section.cta,
            label: config.formSubmitLabel[lang],
            mode: "anchor",
            anchorId: "lead-form",
          };
          return { ...section, cta: nextCta };
        }

        case "post-action": {
          if (!config.postActionLabel) {
            // Pas de CTA post-action → on retire le CTA s'il existe
            return section.cta ? stripCta(section) : section;
          }
          if (!section.cta) return section;
          const nextCta: CtaConfig = {
            ...section.cta,
            label: config.postActionLabel[lang],
            mode: "redirect",
            url: "#",
            target: "_self",
          };
          return { ...section, cta: nextCta };
        }

        case "none":
        default: {
          return section.cta ? stripCta(section) : section;
        }
      }
    });

    return { ...page, sections: patchedSections };
  });

  // ─── INJECTION DÉTERMINISTE DE CTA POST-ACTION ───
  // Sur les pages thankyou/confirmation/replay/delivery/access, si AUCUN CTA
  // n'existe et qu'un postActionLabel est défini, on injecte une section "cta"
  // déterministe avec le bon label, pour que la page ne soit pas un cul-de-sac.
  const POST_CONVERSION_ROLES: PageRole[] = [
    "thankyou",
    "confirmation",
    "replay",
    "delivery",
    "access",
  ];

  const patchedPagesWithPostAction: FunnelPage[] = patchedPages.map((page) => {
    if (!POST_CONVERSION_ROLES.includes(page.role)) return page;
    if (!config.postActionLabel) return page;

    const hasCta = page.sections.some((s) => !!s.cta);
    if (hasCta) return page;

    // Construit une section "cta" déterministe
    const postActionHeadline = tLang(
      {
        fr: "Que faire ensuite ?",
        en: "What's next?",
        es: "¿Qué hacer ahora?",
      },
      lang,
    );
    const postActionSubheadline = tLang(
      {
        fr: "Préparez la suite dès maintenant.",
        en: "Get ready for what's next.",
        es: "Prepárate para lo que sigue.",
      },
      lang,
    );

    const ctaSection: FunnelSection = {
      id: `cta_post_action_${Date.now().toString(36)}`,
      type: "cta",
      headline: postActionHeadline,
      subheadline: postActionSubheadline,
      visible: true,
      cta: {
        label: config.postActionLabel[lang],
        mode: "redirect",
        url: "#",
        target: "_self",
      },
    };

    console.log(
      `[cta-harmonize] CTA post-action injecté sur page "${page.role}" : "${config.postActionLabel[lang]}"`,
    );

    return {
      ...page,
      sections: [...page.sections, ctaSection],
    };
  });

  // Log final récapitulatif
  console.log(
    "[cta-harmonize] Résultat :",
    patchedPagesWithPostAction.map((p) => ({
      role: p.role,
      slug: p.slug,
      ctas: p.sections
        .filter((s) => s.cta)
        .map((s) => ({ type: s.type, label: s.cta?.label, mode: s.cta?.mode })),
    })),
  );

  return { ...funnel, pages: patchedPagesWithPostAction };
}


// ─────────────────────────────────────────────────────────────────────────────
// Génération multi-pages (fonction principale)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Copywriting expert : CTA canonique par type de tunnel + directives transverses.
// ─────────────────────────────────────────────────────────────────────────────
function canonicalCtaLabel(kind: string, lang: Language): string {
  const map: Record<string, { fr: string; en: string; es: string }> = {
    "lead-magnet": { fr: "Recevoir le guide gratuit", en: "Get the free guide", es: "Recibir la guía gratis" },
    "digital-product": { fr: "Obtenir l'accès maintenant", en: "Get instant access", es: "Obtener acceso ahora" },
    "coaching-high-ticket": { fr: "Réserver mon appel", en: "Book my call", es: "Reservar mi llamada" },
    "booking": { fr: "Réserver mon créneau", en: "Book my slot", es: "Reservar mi cita" },
    "webinar": { fr: "Réserver ma place", en: "Save my seat", es: "Reservar mi plaza" },
    "challenge": { fr: "Rejoindre le challenge", en: "Join the challenge", es: "Unirme al reto" },
  };
  const e = map[kind] ?? map["lead-magnet"];
  return lang === "en" ? e.en : lang === "es" ? e.es : e.fr;
}

function copyDirectives(lang: Language): string {
  if (lang === "en" || lang === "es") {
    return (
      `\n\nSENIOR DIRECT-RESPONSE COPYWRITING DIRECTIVES (10+ years) — write to SELL, lead with emotion:\n` +
      `- BENEFITS = emotional TRANSFORMATIONS (the before→after the client lives), never technical features. Forbidden as benefits: "mobile compatible", "lifetime updates", "instant access". Each benefit names a real pain removed and the new reality gained.\n` +
      `- SECTION LABELS/eyebrows are client-oriented and benefit-led. Forbidden: "Our offer", "Your offer", "Our services", "Pricing". Use desire-driven labels (e.g. before pricing: "Ready to finally sleep through the night?").\n` +
      `- FAQ lifts REAL buying OBJECTIONS (price worth it?, no time, "will it work for me/my case?", fear of failure, guarantee, effort required), each answer reframes toward action. No descriptive feature questions.\n` +
      `- Each section CTA fits its role: hero = main offer; pricing/offer = buy ("Get access", "Order now"); faq = back to the form/CTA; guarantee = reassure then act; proof = lead into the main CTA. Never "Learn more".\n` +
      `- EVERY pricing card has its OWN clickable CTA. Pricing inclusions pair each concrete item with the outcome it unlocks.\n` +
      `- One message per section, credible promise (no hype), same product name/promise/tone throughout.\n` +
      `- ONE subheadline per section, and it must add NEW information: never paraphrase its own headline, never repeat the previous section's subheadline. If you have nothing to add, leave it EMPTY.`
    );
  }
  return (
    `\n\nDIRECTIVES DE COPYWRITING (copywriter direct-response sénior, 10+ ans) — écris pour VENDRE, guidé par l'émotion :\n` +
    `- LES BÉNÉFICES = des TRANSFORMATIONS émotionnelles (l'avant→après que vit le client), JAMAIS des features techniques. Interdits comme bénéfices : "compatible mobile", "mises à jour à vie", "accès immédiat", "garantie 30 jours". Chaque bénéfice nomme une douleur réelle supprimée et la nouvelle réalité gagnée (ex. "Des nuits complètes enfin retrouvées, sans culpabiliser").\n` +
    `- LES LABELS/eyebrows de section sont orientés CLIENT et bénéfice. INTERDITS : "Votre offre", "Notre offre", "Nos services", "Tarifs" tout court. Utilise des accroches de désir (ex. avant le pricing : "Prêt à retrouver des nuits paisibles ?").\n` +
    `- LA FAQ lève les VRAIES OBJECTIONS d'achat (le prix en vaut-il la peine ? je n'ai pas le temps, "est-ce que ça marche pour MON cas ?", peur d'échouer, garantie, effort demandé). Chaque réponse rassure et ramène vers l'action. Pas de questions descriptives de features.\n` +
    `- Chaque CTA de section colle à son rôle : hero = offre principale ; pricing/offer = achat ("Je commande", "Obtenir l'accès") ; faq = retour au formulaire/CTA ; garantie = rassurer puis agir ; preuve/témoignages = enchaîner vers le CTA. Jamais "En savoir plus".\n` +
    `- CHAQUE carte de pricing a SON bouton CTA. Dans le pricing, chaque inclusion concrète est reliée au résultat qu'elle débloque (pas une simple liste technique).\n` +
    `- Un seul message par section, promesse crédible (pas de survente), même nom de produit/promesse/ton partout.\n` +
    `- UN SEUL sous-titre par section, et il APPORTE une information NOUVELLE : il ne paraphrase JAMAIS le titre de sa propre section et ne répète JAMAIS le sous-titre de la section précédente. Si tu n'as rien à ajouter, laisse le sous-titre VIDE.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Framework de copywriting SPÉCIFIQUE au type de tunnel (page principale).
// Chaque type de page a sa structure persuasive éprouvée + une exigence de
// profondeur (les pages principales doivent être riches, jamais avares).
// ─────────────────────────────────────────────────────────────────────────────
function copyFramework(kind: string, lang: Language): string {
  const fr: Record<string, string> = {
    "digital-product":
      `PAGE DE VENTE — applique CETTE structure de copywriting direct-response, DÉTAILLÉE.\n` +
      `Émets une section pour CHAQUE étape, en utilisant le "type" indiqué entre crochets :\n` +
      `1) ACCROCHE [type:hero] : promesse forte centrée sur la transformation + sous-titre (pour qui + résultat concret).\n` +
      `2) PROBLÈME [type:problem] : nomme la douleur réelle et quotidienne du prospect (frustrations, échecs passés).\n` +
      `3) AMPLIFICATION [type:agitation] : conséquences si rien ne change (coût émotionnel, temps, argent perdus). Section DISTINCTE du problème.\n` +
      `4) SOLUTION [type:solution] : présente le produit comme le pont vers le résultat (mécanisme unique).\n` +
      `5) BÉNÉFICES [type:benefits] : 4 à 6 transformations concrètes (avant→après), orientées résultat.\n` +
      `6) PRÉSENTATION/AUTORITÉ [type:about] : qui tu es, ton expérience, pourquoi te faire confiance — APRÈS les bénéfices.\n` +
      `7) PREUVE SOCIALE [type:testimonials] : témoignages crédibles (uniquement de vrais clients).\n` +
      `8) OFFRE [type:pricing] + BONUS [type:bonus] : ce qui est inclus (relié au résultat), prix, bonus.\n` +
      `9) GARANTIE [type:guarantee] : renversement de risque clair.\n` +
      `10) OBJECTIONS [type:faq] : 5 à 6 vraies objections d'achat levées.\n` +
      `11) URGENCE/RARETÉ [type:urgency] : raison LÉGITIME d'agir maintenant (places, délai, bonus limité) — sans chiffre inventé.\n` +
      `12) CTA d'achat clair [type:cta], et RÉPÈTE un CTA après le hero, après les bénéfices et après l'offre.`,
    "lead-magnet":
      `PAGE DE CAPTURE — structure :\n` +
      `1) ACCROCHE : le bénéfice n°1 du lead magnet (résultat rapide et désirable).\n` +
      `2) MICRO-PROBLÈME : la difficulté précise que le lead magnet résout.\n` +
      `3) CE QU'IL CONTIENT : 3 à 5 points concrets (ce que la personne saura/pourra faire après).\n` +
      `4) CRÉDIBILITÉ : preuve courte (pourquoi te faire confiance).\n` +
      `5) FORMULAIRE simple + réassurance (pas de spam). Reste concis mais convaincant, focalisé sur l'inscription.`,
    "coaching-high-ticket":
      `PAGE HAUT DE GAMME (candidature/appel) — structure :\n` +
      `1) ACCROCHE aspirationnelle (la transformation visée).\n` +
      `2) POUR QUI c'est / pour qui ce n'est PAS (qualification).\n` +
      `3) PROBLÈME + pourquoi les solutions classiques échouent.\n` +
      `4) LA MÉTHODE / l'accompagnement (process en étapes claires).\n` +
      `5) RÉSULTATS clients (preuve forte).\n` +
      `6) CADRE / garantie + ce qui est inclus.\n` +
      `7) CTA : RÉSERVER UN APPEL (qualification), jamais un achat impulsif. Ton premium, crédible, sans survente.`,
    webinar:
      `PAGE D'INSCRIPTION WEBINAIRE — structure :\n` +
      `1) ACCROCHE : la grande promesse du webinaire (ce qu'ils repartiront en sachant faire).\n` +
      `2) CE QUE TU VAS APPRENDRE : 3 points clés.\n` +
      `3) POUR QUI c'est.\n` +
      `4) L'ANIMATEUR : crédibilité (qui, pourquoi l'écouter).\n` +
      `5) DATE/HEURE + urgence (places limitées / replay limité).\n` +
      `6) CTA : RÉSERVER SA PLACE. Si une vidéo est fournie, place-la en teaser près du hero.`,
    booking:
      `PAGE DE PRISE DE RENDEZ-VOUS — structure :\n` +
      `1) ACCROCHE : le résultat concret de l'appel/du service.\n` +
      `2) PROBLÈME + pour qui.\n` +
      `3) COMMENT ÇA SE PASSE (déroulé de l'appel/service).\n` +
      `4) PREUVE (clients, résultats).\n` +
      `5) RÉASSURANCE (sans engagement / gratuit).\n` +
      `6) CTA : RÉSERVER UN CRÉNEAU.`,
    challenge:
      `PAGE DE CHALLENGE — structure :\n` +
      `1) ACCROCHE : ce qu'ils vont accomplir en X jours.\n` +
      `2) LE PROBLÈME que le challenge règle.\n` +
      `3) LE PROGRAMME jour par jour (aperçu).\n` +
      `4) LA COMMUNAUTÉ / l'accompagnement.\n` +
      `5) PREUVE + urgence (date de démarrage).\n` +
      `6) CTA : REJOINDRE LE CHALLENGE.`,
  };

  const block =
    fr[kind] ??
    `PAGE PRINCIPALE — structure persuasive : Accroche → Problème → Amplification → ` +
      `Solution → Bénéfices (transformations) → Preuve → Offre → Objections → CTA.`;

  const depth =
    `\nPROFONDEUR : la page principale doit être RICHE et complète — sous-textes développés (2 à 4 phrases), ` +
    `titres percutants, aucune section vide ou avare, aucun texte générique de remplissage. ` +
    `Chaque élément doit faire avancer le prospect vers l'action.`;

  if (lang === "en" || lang === "es") {
    return (
      `\n\nPAGE-TYPE COPY FRAMEWORK ("${kind}"): follow a proven direct-response structure ` +
      `(Hook → Problem → Amplification → Solution → Benefits as transformations → Proof → Offer → Objections → CTA), ` +
      `adapted to this page type. The main page must be RICH and detailed — developed sub-copy (2-4 sentences), ` +
      `punchy headlines, no empty or filler sections.`
    );
  }
  return `\n\nFRAMEWORK DE COPY (type "${kind}") :\n${block}${depth}`;
}

// Directives de mise en page & d'usage des médias (anticipe les cas vidéo).
function layoutDirectives(kind: string, lang: Language): string {
  const isVideoKind = kind === "webinar" || kind === "vsl";
  if (lang === "en" || lang === "es") {
    return (
      `\n\nLAYOUT & MEDIA: group lists into designed blocks (icon cards, numbered steps, columns), ` +
      `never a raw bullet list; vary formats between sections. Present "about" as a split (text + visual) when an image exists.` +
      (isVideoKind
        ? ` This is a VIDEO funnel: the hero features the VIDEO (text + video + CTA stacked); ` +
          `never put an uploaded image in place of the hero video — images go to about/proof.`
        : "")
    );
  }
  return (
    `\n\nMISE EN PAGE & MÉDIAS :\n` +
    `- Regroupe les listes en BLOCS conçus (cards à icône, étapes numérotées, ou colonnes), jamais une longue liste à puces brute ; varie les formats entre sections.\n` +
    `- "about" : présente-le de préférence en SPLIT (texte d'un côté, visuel/photo de l'autre) si une image est disponible.` +
    (isVideoKind
      ? `\n- Tunnel VIDÉO (webinaire/VSL) : le hero met en avant la VIDÉO (texte + vidéo + CTA empilés) ; ` +
        `n'utilise JAMAIS une image uploadée à la place de la vidéo du hero — les images vont dans about/preuve.`
      : "")
  );
}

// CTA de "chaîne" : l'action attendue sur les pages secondaires (≠ CTA de la home).
function chainCtaGuidance(kind: string, lang: Language): string {
  const fr: Record<string, string> = {
    "lead-magnet":
      `CTA DE CHAÎNE : sur la page de remerciement, le CTA n'est PAS « s'inscrire » mais l'étape suivante — ` +
      `accéder au contenu / rejoindre le groupe, ou découvrir l'offre payante.`,
    "digital-product":
      `CTA DE CHAÎNE : sur la page de remerciement, le CTA mène à la livraison / l'espace membre ` +
      `(« Accéder à mon espace »), jamais « acheter ».`,
    "coaching-high-ticket":
      `CTA DE CHAÎNE : sur merci/confirmation, le CTA prépare l'appel (« Préparer mon appel », ajouter au calendrier).`,
    webinar:
      `CTA DE CHAÎNE : page de confirmation d'inscription → « Ajouter au calendrier » ou rejoindre le groupe ; ` +
      `page replay → CTA principal d'achat/réservation.`,
    booking:
      `CTA DE CHAÎNE : sur merci → « Ajouter au calendrier » / préparer le rendez-vous.`,
    challenge:
      `CTA DE CHAÎNE : sur merci → « Rejoindre le groupe du challenge ».`,
  };
  const block =
    fr[kind] ??
    `CTA DE CHAÎNE : sur les pages secondaires, le CTA engage vers l'étape SUIVANTE du parcours, jamais le même que la home.`;
  if (lang === "en" || lang === "es") {
    return `\nCHAIN CTA: on secondary pages, the CTA must drive the NEXT step of the journey, never repeat the home CTA.`;
  }
  return `\n${block}`;
}

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

  // 🆕 LOT 3 — Pages optionnelles cochées par l'utilisateur (calculé AVANT la
  // résolution de la home : LOT 8 en a besoin pour placer la VSL en entrée).
  const selectedOptional = new Set(brief.selectedOptionalPages ?? []);

  let homeRole = getHomeRoleForKind(normalizedKind);
  // 🆕 LOT 8 — Coaching high ticket : si la VSL optionnelle est cochée, c'est
  // ELLE la page d'entrée (avant la candidature), pas l'inverse.
  if (normalizedKind === "coaching-high-ticket" && selectedOptional.has("vsl")) {
    homeRole = "vsl";
  }
  const mainBlueprint =
    blueprints.find((b) => b.role === homeRole) ?? blueprints[0];
  let secondaryBlueprints = blueprints.filter((b) => b !== mainBlueprint);

  // 🆕 OTO CONDITIONNELS : on ne génère les pages upsell/downsell QUE si
  // l'utilisateur a renseigné le prix correspondant dans le wizard. Sinon on les
  // retire — pas de pages OTO génériques inventées par l'IA.
  const hasUpsell = !!(
    (brief.upsellPrice && brief.upsellPrice.trim()) ||
    (brief.upsellOffer && brief.upsellOffer.trim())
  );
  const hasDownsell = !!(
    (brief.downsellPrice && brief.downsellPrice.trim()) ||
    (brief.downsellOffer && brief.downsellOffer.trim())
  );
  secondaryBlueprints = secondaryBlueprints.filter((b) => {
    if (b.role === "upsell") return hasUpsell;
    if (b.role === "downsell") return hasDownsell;
    return true;
  });

  // 🆕 WEBINAIRE — page de VENTE post-webinaire CONDITIONNELLE : on ne la génère
  // QUE si l'utilisateur a renseigné l'« Offre vendue après le webinaire »
  // (postWebinarOfferName). Sinon on la retire complètement — sans offre réelle,
  // l'IA fabriquait une page de vente factice (infos inventées) qui ne
  // ressemblait même pas à une page de vente. Pas d'offre → pas de page de vente.
  const hasPostWebinarOffer = !!(
    brief.postWebinarOfferName && brief.postWebinarOfferName.trim()
  );
  if (normalizedKind === "webinar" && !hasPostWebinarOffer) {
    secondaryBlueprints = secondaryBlueprints.filter((b) => b.role !== "sales");
  }

  // 🆕 CHALLENGE — « Pitch final » CONDITIONNEL, exactement comme la page de
  // vente post-webinaire ci-dessus. `offerName`/`price` décrivent le CHALLENGE
  // (souvent gratuit) ; sans `challengeOfferName`, l'IA inventait une offre de
  // clôture de toutes pièces. Pas d'offre → pas de pitch final.
  const hasChallengeOffer = !!(
    brief.challengeOfferName && brief.challengeOfferName.trim()
  );
  if (normalizedKind === "challenge" && !hasChallengeOffer) {
    secondaryBlueprints = secondaryBlueprints.filter((b) => b.role !== "sales");
  }

  // 🆕 LOT 3 — Pages OPTIONNELLES génériques (ex. "oto", "vsl") : générées
  // UNIQUEMENT si l'utilisateur les a cochées dans l'aperçu "pages générées"
  // du wizard. Comportement rétrocompatible : `selectedOptionalPages`
  // absent/vide → aucune page optionnelle générée (aucun changement pour les
  // appels existants).
  secondaryBlueprints = secondaryBlueprints.filter((b) => {
    if (!b.optional) return true;
    return selectedOptional.has(b.role);
  });

  // 🆕 B4 — Page de confirmation d'un tunnel « booking ».
  //
  // Elle est GÉNÉRÉE PAR DÉFAUT (`bookingConfirmationPage` absent = true) et
  // seule une décoche explicite la retire — et uniquement en mode NATIF, où
  // l'écran de confirmation du calendrier suffit à lui seul.
  //
  // En mode EXTERNE elle est toujours produite : Calendly & consorts
  // redirigent vers l'URL qu'on leur donne, et cette page EST cette cible. La
  // retirer laisserait le mode externe sans atterrissage après réservation.
  if (normalizedKind === "booking" && brief.bookingConfirmationPage === false) {
    if (resolveBookingMode(brief) === "native") {
      secondaryBlueprints = secondaryBlueprints.filter((b) => b.role !== "confirmation");
      console.log(
        "[blueprint] Booking natif : page de confirmation décochée → non générée " +
          "(l'écran du calendrier natif fait office de confirmation).",
      );
    } else {
      console.log(
        "[blueprint] Booking externe : page de confirmation CONSERVÉE malgré la décoche — " +
          "c'est la cible de redirection de la plateforme tierce.",
      );
    }
  }

  // Express IA : on cale le nombre de pages sur le choix de l'utilisateur
  // (1 = page principale seule ; N = page principale + (N-1) pages secondaires).
  if (brief.creationMode === "express" && typeof brief.pageCount === "number") {
    const extra = Math.max(0, brief.pageCount - 1);
    secondaryBlueprints = secondaryBlueprints.slice(0, extra);
  }

  const template =
    getPremiumTemplate(brief.templateId) ??
    getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
    PREMIUM_TEMPLATES[0];

  console.info(
    `[generateMultiPageFunnelWithAI] Lancement de la génération en parallèle (Main + ${secondaryBlueprints.length} pages secondaires)...`,
  );

  const ctaInstruction = buildCtaInstruction(brief.language, brief);

  // Express IA : description libre de l'utilisateur, à utiliser en priorité.
  const businessContext =
    brief.businessPrompt && brief.businessPrompt.trim().length > 0
      ? `\n\nCONTEXTE LIBRE FOURNI PAR L'UTILISATEUR (source de vérité prioritaire pour l'offre, l'audience, le ton, la promesse et le copywriting) :\n"""\n${brief.businessPrompt.trim()}\n"""\n`
      : "";

  // 🆕 Webinaire : date/heure + urgence fixées par l'utilisateur → le copy doit
  // les refléter (jamais inventer une autre date ; le countdown est injecté
  // ensuite de façon déterministe, cf. applyWebinarSchedule).
  let webinarContext = "";
  if (brief.webinarDate) {
    const d = new Date(brief.webinarDate);
    if (!Number.isNaN(d.getTime())) {
      const locale =
        brief.language === "en" ? "en-US" : brief.language === "es" ? "es-ES" : "fr-FR";
      const formatted = d.toLocaleString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
      webinarContext =
        `\n\nWEBINAIRE — DATE OFFICIELLE FIXÉE PAR L'UTILISATEUR : ${formatted}. ` +
        `Utilise EXACTEMENT cette date/heure dans le copy (hero, confirmation, emails). N'invente JAMAIS une autre date.` +
        (brief.webinarUrgency
          ? ` Urgence/rareté à mettre en avant : "${brief.webinarUrgency}".`
          : "") +
        `\n`;
    }
  } else if (brief.webinarMode === "evergreen") {
    // 🆕 LOT 5 — Pas de date fixe : chaque prospect choisit son créneau et
    // regarde une vidéo pré-enregistrée. Le copy ne doit JAMAIS inventer de
    // date/heure commune ni promettre un hôte "en direct".
    webinarContext =
      `\n\nWEBINAIRE EN MODE AUTOMATISÉ (EVERGREEN) : il n'y a AUCUNE date fixe — ` +
      `chaque prospect choisit son propre créneau ("dans 15 min", "demain à la même heure"...) ` +
      `puis regarde une vidéo PRÉ-ENREGISTRÉE. N'invente AUCUNE date/heure précise, ne promets JAMAIS ` +
      `un hôte "en direct" ; parle de "ta session" au lieu de "le webinaire du [date]".` +
      (brief.webinarUrgency
        ? ` Urgence/rareté à mettre en avant : "${brief.webinarUrgency}".`
        : "") +
      `\n`;
  }

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
    }) + ctaInstruction + businessContext + webinarContext + copyDirectives(brief.language) + copyFramework(normalizedKind, brief.language) + layoutDirectives(normalizedKind, brief.language);

  const mainPromise = callAI({
    systemMessage: SYSTEM_MESSAGE_FUNNEL,
    userPrompt: mainPromptText,
    maxTokens: 4000,
  });

  // 🆕 Timeout global configurable + défaut adapté au fournisseur : GLM /
  // OpenRouter sont plus lents → 180 s par défaut (sinon 75 s). Surchargeable
  // via AI_TIMEOUT_MS (ms).
  const aiProviderLc = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const aiSlowProvider =
    aiProviderLc.includes("router") ||
    aiProviderLc === "zai" ||
    aiProviderLc === "z.ai" ||
    aiProviderLc === "glm";
  const aiTimeoutMs = Number(
    process.env.AI_TIMEOUT_MS ?? (aiSlowProvider ? "180000" : "75000"),
  );
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout AI")), aiTimeoutMs),
  );

  let mainRawText: string;

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
      mainParsed.error.issues,
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

  // ── Pages secondaires : génération PAGE PAR PAGE, EN PARALLÈLE ──
  // 🆕 Chaque page secondaire est générée par un appel IA INDÉPENDANT (timeout +
  // fallback propres). Vs l'ancien one-shot « toutes les pages d'un coup » : si
  // une page échoue, SEULE celle-là retombe en placeholder (pas toutes) ; chaque
  // page dispose de tout le budget de tokens ; c'est plus rapide (parallèle).
  // ⚠️ L'ORDRE, les LIENS et les REDIRECTIONS ne dépendent PAS de la génération :
  // ils sont reconstruits ensuite par buildPagesFromBlueprints + chainPagesNavigation.
  if (secondaryBlueprints.length > 0) {
    const mainHero = mainSections.find((s) => s.type === "hero");
    const heroHeadline = (mainHero?.headline ?? "").trim();
    const heroSub = (mainHero?.subheadline ?? "").trim();
    const primaryCtaLabel =
      brief.primaryCta?.label ?? canonicalCtaLabel(normalizedKind, brief.language);

    const coherenceBlock =
      `\n\nCOHÉRENCE OBLIGATOIRE AVEC LA PAGE PRINCIPALE DÉJÀ GÉNÉRÉE :\n` +
      `- Marque : "${brief.brandName}" — Offre/produit : "${brief.offerName}"\n` +
      (brief.upsellOffer && brief.upsellOffer.trim()
        ? `- OFFRE UPSELL IMPOSÉE (la page upsell DOIT présenter EXACTEMENT cette offre, pas une offre générique inventée) : "${brief.upsellOffer.trim()}"\n`
        : "") +
      (brief.upsellPrice && brief.upsellPrice.trim()
        ? `- PRIX UPSELL IMPOSÉ (utilise EXACTEMENT ce montant pour l'offre de la page upsell, n'invente AUCUN autre prix) : "${brief.upsellPrice.trim()}"\n`
        : "") +
      (brief.downsellOffer && brief.downsellOffer.trim()
        ? `- OFFRE DOWNSELL IMPOSÉE (la page downsell DOIT présenter EXACTEMENT cette offre, pas une offre générique inventée) : "${brief.downsellOffer.trim()}"\n`
        : "") +
      (brief.downsellPrice && brief.downsellPrice.trim()
        ? `- PRIX DOWNSELL IMPOSÉ (utilise EXACTEMENT ce montant pour l'offre de la page downsell, n'invente AUCUN autre prix) : "${brief.downsellPrice.trim()}"\n`
        : "") +
      // 🆕 Page OTO/tripwire générique (rôle "oto", cochable sur tous les
      // types de tunnel) : offre imposée par l'utilisateur, sinon l'IA
      // inventait systématiquement nom/prix/promesse.
      (brief.otoOfferName && brief.otoOfferName.trim()
        ? `- OFFRE OTO/TRIPWIRE IMPOSÉE (la page "oto" DOIT présenter EXACTEMENT cette offre, pas une offre générique inventée) : "${brief.otoOfferName.trim()}"\n`
        : "") +
      (brief.otoPrice && brief.otoPrice.trim()
        ? `- PRIX OTO IMPOSÉ (utilise EXACTEMENT ce montant pour l'offre de la page "oto", n'invente AUCUN autre prix) : "${brief.otoPrice.trim()}"\n`
        : "") +
      (brief.otoPromise && brief.otoPromise.trim()
        ? `- PROMESSE OTO IMPOSÉE (reprends cette promesse pour l'offre de la page "oto") : "${brief.otoPromise.trim()}"\n`
        : "") +
      (heroHeadline ? `- Titre de la home : "${heroHeadline}"\n` : "") +
      (heroSub ? `- Promesse de la home : "${heroSub}"\n` : "") +
      `- CTA PRINCIPAL DU TUNNEL (réutilise EXACTEMENT ce libellé et cette intention sur toutes les pages) : "${primaryCtaLabel}"\n` +
      `Reprends le même nom de produit, le même ton et le même vocabulaire que la home. ` +
      `Cette page est une SUITE logique, JAMAIS une répétition : n'y remets PAS ` +
      `les sections déjà présentes sur la home (pas de FAQ, "about", liste de bénéfices ni pricing en double). ` +
      `Chaque page joue son rôle : "merci"/"confirmation" rassure et annonce la prochaine étape ; ` +
      `"upsell"/"downsell" OUVRENT par une confirmation rassurante ("Commande confirmée ✓") PUIS présentent UNE offre additionnelle UNIQUE (OTO) — DIFFÉRENTE de l'offre principale, avec son propre prix — et un CTA "Oui, je l'ajoute" + un lien discret "Non merci, continuer" ; ` +
      `"replay"/"watch" donne l'accès et pousse vers le CTA principal ; "optin" reste minimale (promesse + capture).` +
      `\n\nSTYLE DES PAGES SECONDAIRES — CONCISION STRICTE : ces pages viennent APRÈS l'achat, le visiteur veut décider vite. ` +
      `Va DROIT À L'ESSENTIEL : titres courts (max ~6 mots), AU PLUS une phrase de sous-titre, body de 1-2 phrases maximum, ` +
      `bullets de 4 à 7 mots. PAS de blabla, pas de longs paragraphes, pas de remplissage, pas de storytelling. ` +
      `Le ton reste direct et chaleureux mais ULTRA concis.` +
      chainCtaGuidance(normalizedKind, brief.language);

    // Génère UNE page secondaire via un appel IA isolé. Retourne null en cas
    // d'échec (timeout / schema / vide) → la page tombera sur un placeholder
    // enrichi côté buildPagesFromBlueprints.
    const results = await Promise.allSettled(
      secondaryBlueprints.map(async (bp) => {
        // 🆕 Webinaire — DOUBLE OFFRE : la page "sales" (post-webinaire) ne
        // vend PAS le webinaire mais un produit distinct. Si l'utilisateur a
        // renseigné `postWebinarOfferName`, on substitue offerName/price/promise
        // UNIQUEMENT pour la génération de CETTE page (offer name affiché à
        // l'IA + richSectionsBlock/strictSectionRequirements internes à
        // secondaryPagesPrompt). Aucun changement pour les autres rôles/types.
        const isWebinarSalesPage =
          normalizedKind === "webinar" &&
          bp.role === "sales" &&
          !!(brief.postWebinarOfferName && brief.postWebinarOfferName.trim());
        // 🆕 CHALLENGE — même logique de DOUBLE OFFRE : le « pitch final » ne
        // vend pas le challenge (souvent gratuit) mais l'offre de clôture.
        const isChallengeSalesPage =
          normalizedKind === "challenge" &&
          bp.role === "sales" &&
          !!(brief.challengeOfferName && brief.challengeOfferName.trim());
        const secondaryOffer = isWebinarSalesPage
          ? {
              name: brief.postWebinarOfferName!.trim(),
              price: brief.postWebinarPrice,
              promise: brief.postWebinarPromise,
              context:
                "cette page vend un produit DIFFÉRENT du webinaire, qui a déjà eu lieu",
              avoid:
                "Ne parle PAS du webinaire comme de l'offre à vendre (il est déjà terminé)",
            }
          : isChallengeSalesPage
            ? {
                name: brief.challengeOfferName!.trim(),
                price: brief.challengeOfferPrice,
                promise: brief.challengeOfferPromise,
                context:
                  "cette page vend un produit DIFFÉRENT du challenge, qui se termine",
                avoid:
                  "Ne parle PAS du challenge comme de l'offre à vendre (il est terminé) ; capitalise sur les résultats obtenus pendant le challenge",
              }
            : null;

        const pageBrief: FunnelBrief = secondaryOffer
          ? {
              ...brief,
              offerName: secondaryOffer.name,
              price: (secondaryOffer.price ?? brief.price ?? "").trim() || brief.price,
              promise: (secondaryOffer.promise ?? "").trim() || brief.promise,
            }
          : brief;
        const salesOfferOverride = secondaryOffer
          ? `\n\nOFFRE RÉELLEMENT VENDUE SUR CETTE PAGE (IMPÉRATIF — ${secondaryOffer.context}) :\n` +
            `- Nom du produit/offre : "${pageBrief.offerName}"\n` +
            `- Prix : "${pageBrief.price}"\n` +
            (pageBrief.promise ? `- Promesse principale : "${pageBrief.promise}"\n` : "") +
            `${secondaryOffer.avoid} : rédige un copywriting de vente complet (problème, solution, bénéfices, preuve, prix, garantie, urgence) pour CE produit.\n`
          : "";
        const promptText =
          secondaryPagesPrompt({
            brand: brief.brandName,
            offer: pageBrief.offerName,
            funnelKind: normalizedKind,
            language: brief.language,
            pages: [{ role: bp.role, slug: bp.slug, name: bp.name }],
            medias: toMediaInputs(briefMediasWithVideo),
            videoUrl: brief.videoUrl,
            brief: pageBrief,
          }) + ctaInstruction + businessContext + copyDirectives(brief.language) + coherenceBlock + salesOfferOverride;

        const rawText = (await Promise.race([
          callAI({
            systemMessage: SYSTEM_MESSAGE_FUNNEL,
            userPrompt: promptText,
            maxTokens: 3000,
          }),
          new Promise<null>((resolve) =>
            setTimeout(
              () => resolve(null),
              Number(process.env.AI_PAGE_TIMEOUT_MS ?? (aiSlowProvider ? "150000" : "60000")),
            ),
          ),
        ])) as string | null;

        if (!rawText) {
          console.warn(`[generateMultiPageFunnelWithAI] Page "${bp.role}" : timeout → placeholder.`);
          return null;
        }

        const parsed = secondaryPagesSchema.safeParse(
          normalizeSecondaryPagesRawJson(JSON.parse(extractJsonPayload(rawText))),
        );
        if (!parsed.success) {
          console.warn(`[generateMultiPageFunnelWithAI] Page "${bp.role}" : schema mismatch → placeholder.`);
          return null;
        }

        // On a demandé UNE page : on prend celle qui matche le role, sinon la 1re.
        const page =
          parsed.data.pages.find((p) => (p.role as PageRole) === bp.role) ??
          parsed.data.pages[0];
        if (!page) return null;

        const sections = parseSectionsArray(page.sections, fallbackCta, pageBrief);
        if (sections.length === 0) return null;
        return { role: bp.role as PageRole, sections };
      }),
    );

    let okCount = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        sectionsByRole.set(r.value.role, r.value.sections);
        okCount++;
        console.info(
          `[generateMultiPageFunnelWithAI] Page secondaire "${r.value.role}" : ${r.value.sections.length} sections OK.`,
        );
      } else if (r.status === "rejected") {
        console.warn(
          "[generateMultiPageFunnelWithAI] Échec non-bloquant d'une page secondaire:",
          r.reason,
        );
      }
    }
    console.info(
      `[generateMultiPageFunnelWithAI] Pages secondaires : ${okCount}/${secondaryBlueprints.length} générées par IA (le reste → placeholder enrichi).`,
    );
  }

  // 🆕 On ne construit QUE les pages retenues (main + secondaires filtrées) :
  // c'est ici que les OTO non demandés (upsell/downsell vides) étaient malgré
  // tout recréés en placeholder. On respecte l'ordre du catalogue.
  const keptBlueprints = new Set<(typeof blueprints)[number]>([
    mainBlueprint,
    ...secondaryBlueprints,
  ]);
  const effectiveBlueprints = blueprints.filter((b) => keptBlueprints.has(b));

  const pages = buildPagesFromBlueprints({
    blueprints: effectiveBlueprints,
    sectionsByRole,
    brief,
    homeRole,
  });

  // 🆕 Sous-étape E : instrumentation — confirme que TOUTES les pages de la
  // chaîne sont générées (et lesquelles proviennent de l'IA vs d'un placeholder).
  console.info(
    `[generateMultiPageFunnelWithAI] Chaîne de ${pages.length} page(s) construite : ` +
      pages
        .map((p) => {
          const fromAi = sectionsByRole.has(p.role) ? "IA" : "placeholder";
          return `${p.role}(${p.sections.length} sect., ${fromAi})`;
        })
        .join(" → "),
  );

  const media = buildMediaLibraryFromBrief(brief);
  const homePageRaw = pages.find((p) => p.isHome) ?? pages[0];
  const homeSectionsRaw = homePageRaw?.sections ?? mainSections;

  // ===== ÉTAPE 1 : Funnel brut =====
  // 🆕 Nom du tunnel : on IGNORE le défaut générique "Mon Tunnel" de l'IA (qui
  // donnait à TOUS les tunnels le même slug). On dérive du brief (marque +
  // offre) → nom et slug personnalisés par tunnel. On garde le nom de l'IA
  // seulement s'il est spécifique.
  const aiName = (mainData.funnelName ?? "").trim();
  const briefName = `${brief.brandName} — ${brief.offerName}`
    .replace(/^\s*—\s*|\s*—\s*$/g, "")
    .trim();
  const resolvedFunnelName =
    aiName && aiName.toLowerCase() !== "mon tunnel" ? aiName : briefName || aiName || "Tunnel";
  const aiFunnel: Funnel = {
    funnelName: resolvedFunnelName,
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
      // 🆕 B1 — Rattachement au moteur de RDV natif.
      //
      // ⚠️ C'EST ICI que le champ doit être posé : ce littéral est le SEUL
      // emprunté par `generateMultiPageFunnelWithAI`. Une tentative
      // précédente l'avait ajouté au parseur mono-page legacy (~L2415) et à
      // un littéral de repli (~L6371), deux chemins morts pour le multi-pages
      // → `harmonizeCTAsByFunnelKind` lisait toujours `undefined`, et les CTA
      // Booking ancraient vers un `#lead-form` inexistant.
      //
      // Le champ est ensuite préservé par l'étape 6 (`finalFunnel.meta` fait
      // `...(styledFunnel.meta ?? {})`), donc il survit jusqu'à l'étape 11.
      bookingSlug: brief.bookingSlug,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
      schemaVersion: 2,
    },
  };

  // ===== ÉTAPE 2 : Application du template (style uniquement) =====
  const styledFunnel = applyTemplateToFunnel(template, aiFunnel, brief);
  const styleMap = buildStyleMapByType(styledFunnel.sections);
  const filteredPages = styledFunnel.pages ?? pages;

  // ===== ÉTAPE 3 : Filtrage par blueprint + style =====
  const styledPages: FunnelPage[] = filteredPages.map((page) => {
    const blueprint = getPageBlueprint(normalizedKind, page.role);
    let sections = blueprint
      ? filterSectionsByBlueprint(page.sections, blueprint)
      : page.sections;
    sections = applyStyleMapToSections(sections, styleMap);
    return { ...page, sections };
  });

  // ===== ÉTAPE 4 : Enrichissement riche =====
  const enrichedPages = enrichFunnelPages(styledPages, brief, normalizedKind);

  // ===== ÉTAPE 5 : Pipeline médias =====
  const pagesWithMedias: FunnelPage[] = enrichedPages.map((page) =>
    applyMediaPipeline(page, brief, briefMediasWithVideo, normalizedKind),
  );

  // ===== ÉTAPE 6 : Nettoyage final =====
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

  // ===== ÉTAPE 6bis : 🆕 GARDE-FOU ANTI-PAGE-VIDE/FALLBACK =====
  // Après nettoyage, si une page n'a plus AUCUNE section réelle (tout était vide
  // ou placeholder « Section »), on la reconstruit avec le placeholder ENRICHI
  // (copy conversion-first du rôle). Une page fallback/vide décrédibilise le
  // tunnel : exigence maximale ici.
  cleanedPages.forEach((page) => {
    const meaningful = page.sections.filter(
      (s) => !isSectionEmpty(s) && !isPlaceholderHeadline(s.headline),
    );
    // 🆕 Les pages OTO (upsell/downsell) sont des PAGES DE VENTE : un simple CTA
    // ne suffit pas. On exige ≥ 2 sections utiles, sinon on reconstruit avec le
    // placeholder enrichi (offre + bénéfices + CTA) — fini le downsell vide.
    const minMeaningful = page.role === "upsell" || page.role === "downsell" ? 2 : 1;
    if (meaningful.length < minMeaningful) {
      const bp = blueprints.find((b) => b.role === page.role) ?? blueprints[0];
      if (bp) {
        const rebuilt = buildPlaceholderPage(bp, brief, page.isHome);
        page.sections = rebuilt.sections;
        console.warn(
          `[anti-empty] page "${page.role}" trop pauvre (${meaningful.length} section utile) → reconstruite (placeholder enrichi, ${rebuilt.sections.length} sections).`,
        );
      }
    }
  });

  // ===== ÉTAPE 7 : Re-chaînage =====
  const rechainedPages = chainPagesNavigation(cleanedPages);
  const rechainedHome = rechainedPages.find((p) => p.isHome) ?? rechainedPages[0];

  const deterministicHeader = buildDeterministicHeader(brief, fallbackCta);
  let finalFunnel: Funnel = {
    ...styledFunnel,
    pages: rechainedPages,
    sections: rechainedHome?.sections ?? homeSectionsRaw,
    media: styledFunnel.media ?? media,
    header: styledFunnel.header ?? deterministicHeader,
    meta: {
      ...(styledFunnel.meta ?? {}),
      funnelKind: normalizedKind ?? brief.funnelKind,
      templateId: template.id,
      schemaVersion: 2,
    },
  };

  // ===== ÉTAPE 8 : Dédoublonnage inter-pages =====
  const dedupeStats = dedupeSectionsAcrossPages(finalFunnel);
  const totalRemovedDup = Object.values(dedupeStats.removedByPage).reduce(
    (a, b) => a + b,
    0,
  );
  if (totalRemovedDup > 0) {
    console.log(
      `[dedupe] ${totalRemovedDup} sections doublons supprimées : ` +
        Object.entries(dedupeStats.removedByPage)
          .map(([role, n]) => `${role}=${n}`)
          .join(", "),
    );
  }

// ===== ÉTAPE 9 : Garantir pricing UNIQUEMENT pour archétype "purchase" =====
const archetype = getArchetype(brief.funnelKind);
const shouldInjectPricing = archetype === "purchase" && !isFreeOffer(brief.price);

if (shouldInjectPricing) {
  const pricingStats = ensurePricingOnConversionPage(
    finalFunnel,
    brief,
    buildFallbackPricingItems,
  );
  if (pricingStats.injected) {
    console.log(
      `[ensure-pricing] section pricing injectée sur la page "${pricingStats.targetRole}".`,
    );
  }
  if (pricingStats.cleanedFromForbidden > 0) {
    console.log(
      `[ensure-pricing] ${pricingStats.cleanedFromForbidden} sections pricing/offer ` +
        `supprimées de pages interdites.`,
    );
  }
} else {
  console.log(
    `[ensure-pricing] Skipped : archétype="${archetype}" + gratuit=${isFreeOffer(brief.price)}. ` +
      `Pas de section pricing injectée pour ce type de tunnel.`,
  );
  // Nettoyage : on retire toute section pricing/offer qui aurait été générée par erreur
  if (finalFunnel.pages) {
    finalFunnel.pages = finalFunnel.pages.map((page) => ({
      ...page,
      sections: page.sections.filter((s) => s.type !== "pricing" && s.type !== "offer"),
    }));
  }
}

  // ===== ÉTAPE 9bis : 🆕 Supprimer les pages redondantes/vides =====
  // Vente directe : le paiement est externalisé (Stripe Payment Link/Checkout),
  // donc une page « Paiement » INTERNE est redondante → on la retire. On
  // supprime aussi toute page vide (0 section), artefact sans intérêt. On garde
  // toujours la page d'accueil.
  pruneRedundantPages(finalFunnel, brief);

  // ===== ÉTAPE 9ter : 🆕 GARANTIE DES PAGES REQUISES =====
  // Filet de sécurité FINAL : toute page PRÉVUE par le blueprint (selon les
  // conditions déjà appliquées → `effectiveBlueprints` : la page de vente
  // webinaire n'est là que si postWebinarOffer, les OTO que si cochés/prix, etc.)
  // DOIT exister dans le tunnel final. Une page requise (ex. « confirmation »)
  // pouvait disparaître de façon intermittente : le dédoublonnage inter-pages
  // (ÉTAPE 8) la vidait APRÈS le garde-fou anti-vide (6bis), puis prune la
  // supprimait. Ici on reconstruit toute page requise absente OU vide depuis le
  // placeholder enrichi, à sa position d'origine. AUCUNE condition n'autorise
  // l'absence d'une page requise (confirmation incluse).
  ensureRequiredBlueprintPages(finalFunnel, effectiveBlueprints, brief, homeRole);

  // ===== ÉTAPE 10 : Footer meta =====
  applyFooterMeta(finalFunnel, brief);

  // ===== ÉTAPE 11 : Harmonisation des CTA par funnelKind/role =====
  finalFunnel = harmonizeCTAsByFunnelKind(finalFunnel, brief);

  // ===== ÉTAPE 11bis : 🆕 Prix OFFRE PRINCIPALE + OTO fixés par l'utilisateur =====
  // Le prix du wizard est AUTORITAIRE : il remplace toute valeur inventée par
  // l'IA (ex. « Sur devis ») sur la card pricing de la page de vente, sinon le
  // checkout ne trouve pas de montant payable. Idem upsell/downsell.
  applyMainOfferPrice(finalFunnel, brief);
  applyOtoPrices(finalFunnel, brief);
  // 🆕 N1 — Prix de l'offre SECONDAIRE (page "sales") : couvre désormais le
  // webinaire ET le challenge par la même fonction. Ces pages ne sont jamais la
  // home pour ces types, donc hors de portée d'applyMainOfferPrice.
  applySecondaryOfferPrice(finalFunnel, brief);
  // 🆕 LOT 10 — Order bump (produit complémentaire) sur la page de checkout.
  applyOrderBumpConfig(finalFunnel, brief);
  // 🆕 LOT 7 — Embed calendrier natif (Calendly/Cal.com) sur la page de RDV.
  applyBookingCalendarEmbed(finalFunnel, brief);
  // 🆕 LOT 9 — Duplique la page "challenge-day" en jours 1..N + rechaîne.
  applyChallengeMultiDay(finalFunnel, brief);
  // 🆕 R3 — Explique au participant que son lien du jour arrive par email.
  applyChallengeEmailDeliveryNotice(finalFunnel, brief);

  // 🆕 Webinaire — l'offre PAYANTE à considérer pour "checkout actif ?" est
  // celle vendue APRÈS le webinaire (souvent brief.price = "Gratuit" pour le
  // webinaire lui-même, ce qui sautait à tort Palier 1/checkout interne sur la
  // page de vente réelle). Aucun effet sur les autres types (fallback brief.price).
  // 🆕 N2 — Porte « offre payante ». Pour un webinaire comme pour un challenge,
  // `brief.price` décrit l'ÉVÉNEMENT (souvent « Gratuit »), pas ce qui est
  // vendu. Évaluer ce champ faisait passer un tunnel à offre de clôture payante
  // pour un tunnel gratuit : le checkout n'était pas câblé et le prix
  // n'apparaissait pas sur le CTA final.
  //
  // Le repli `funnelHasPaidOffer` rattrapait parfois le coup selon ce que l'IA
  // avait écrit — un défaut INTERMITTENT, plus difficile à diagnostiquer qu'un
  // défaut franc. On lit désormais l'offre secondaire déclarée.
  const effectivePriceForPaidGate =
    secondaryOfferOf(brief)?.price || brief.price;

  // ===== ÉTAPE 12 : 🆕 Lien de paiement (Palier 1) sur les CTA pricing =====
  // Doit passer APRÈS l'harmonisation (sinon elle réécrirait le CTA). Si l'offre
  // est payante et qu'un lien de paiement a été fourni, TOUS les boutons des
  // cartes pricing redirigent vers ce lien (Stripe Payment Link, systeme.io…).
  // 🆕 Le déclencheur n'est plus le SEUL prix de l'offre principale : un tunnel
  // dont l'offre principale est gratuite (lead magnet, webinaire, challenge)
  // peut parfaitement porter une offre payante sur une AUTRE page (tripwire,
  // upsell, pitch final). Le checkout n'y était alors jamais câblé.
  // `funnelHasPaidOffer` inspecte toutes les pages ; `pageHasPaidOffer` garde
  // ensuite chaque page individuellement, donc rien ne change pour un tunnel
  // 100 % gratuit.
  const hasAnyPaidOffer =
    !isFreeOffer(effectivePriceForPaidGate) || funnelHasPaidOffer(finalFunnel);
  if (brief.paymentUrl && brief.paymentUrl.trim() && hasAnyPaidOffer) {
    applyPaymentUrlToPricingCtas(finalFunnel, brief.paymentUrl.trim());
  } else if (hasAnyPaidOffer) {
    // 🆕 Stripe Connect : pas de lien externe → les boutons d'offre déclenchent
    // le CHECKOUT INTERNE (#ff-checkout → /api/checkout → session sur le compte
    // connecté du créateur). Le bouton « achète » sans config supplémentaire.
    applyInternalCheckoutCtas(finalFunnel);
  }

  // ===== ÉTAPE 12ter : 🆕 Lien « Non merci » sur les pages OTO =====
  // Upsell/downsell : le CTA principal achète (#ff-checkout), on ajoute un lien
  // discret qui DÉCLINE l'offre et passe à l'étape suivante du tunnel.
  applyUpsellDeclineLinks(finalFunnel, brief.language);

  // ===== ÉTAPE 12quater : 🆕 Prix sur le CTA FINAL de la page de vente =====
  if (!isFreeOffer(effectivePriceForPaidGate)) appendPriceToFinalCta(finalFunnel);

  // ===== ÉTAPE 12bis : 🆕 Sous-étape B — garantir la section Présentation/Autorité =====
  // Si l'utilisateur a saisi un texte « à propos » mais que la page principale
  // n'a PAS de section "about", on en injecte une (remplie depuis aboutText).
  ensureAuthoritySection(finalFunnel, brief);

  // ===== ÉTAPE 13 : 🆕 Ordre canonique des sections =====
  // L'IA renvoie parfois les sections dans un ordre incohérent (ex. témoignages
  // juste après le hero). On force un ordre de page de vente déterministe :
  // hero en tête, témoignages vers la FIN (juste avant la FAQ), CTA/FAQ en bas.
  reorderFunnelSectionsCanonically(finalFunnel);

  // ===== ÉTAPE 13bis : 🆕 NETTOYAGE DES MÉDIAS NON RÉSOLUS =====
  // L'IA émet parfois un placeholder `[uploaded-xxx]` (ou un texte descriptif)
  // qui ne correspond à AUCUN média réellement uploadé. Laissé tel quel, il
  // produit une <img> cassée + une colonne split vide. On purge donc toute
  // image/vidéo non chargeable AVANT d'assigner les layouts split.
  stripUnresolvedMedia(finalFunnel);

  // ===== ÉTAPE 14 : 🆕 B2 — alternance STRICTE des sections split =====
  // L'ordre canonique est figé : on assigne ensuite text↔image en alternance
  // aux sections « split-éligibles » (image + texte). Le renderer ET l'export
  // lisent déjà section.layoutVariant → aucun changement de rendu nécessaire.
  assignAlternatingSplitLayouts(finalFunnel);

  // ===== ÉTAPE 14bis : 🆕 patterns de sections (variété par famille) =====
  // Attribue un pattern visuel (problème/agitation, process, stats) par section,
  // en sélection semi-aléatoire stable (seed = nom du tunnel) + anti-répétition.
  assignSectionPatterns(finalFunnel);
  assignFooterVariant(finalFunnel);

  // ===== ÉTAPE 15 : 🆕 B2 — variation des cards (icônes distinctes) =====
  assignCardVariation(finalFunnel);

  // ===== ÉTAPE 16 : 🆕 hero épuré + image auteur partagée hero/about =====
  tidyHeroSections(finalFunnel);
  shareAuthorImageHeroAbout(finalFunnel);

  // ===== ÉTAPE 17 : 🆕 pages post-achat épurées (merci/confirmation centrés) =====
  simplifyPostConversionPages(finalFunnel);

  // ===== ÉTAPE 18 : 🆕 page merci/confirmation CÉLÉBRATOIRE (icône ✓ + message) =====
  ensureCelebratoryThankYou(finalFunnel, brief.language);

  // ===== ÉTAPE 18bis : 🆕 une seule action par page de succès =====
  // Le hero ET la section "cta" recevaient le MÊME libellé post-action
  // (« Vérifier ma boîte mail ») → double bouton redondant.
  dedupeSuccessPageCtas(finalFunnel);

  // ===== ÉTAPE 18ter : 🆕 sous-titres redondants =====
  // Deux sous-titres quasi identiques à la suite, ou un sous-titre qui
  // paraphrase le titre de sa propre section.
  dedupeRedundantSubheadlines(finalFunnel);

  // ===== ÉTAPE 18quater : 🆕 canaux communautaires du wizard =====
  // WhatsApp/Telegram saisis au wizard → meta.socialChannels, rendu par
  // SuccessChannels sur les pages de succès (aperçu, publication, export).
  applyCommunityChannels(finalFunnel, brief);

  // ===== ÉTAPE 19 : 🆕 ACCENT COULEUR sur les mots les plus captivants =====
  // Met en valeur prix / pourcentages / chiffres marquants avec la couleur accent
  // du template (`var(--ff-accent)` via [[...]] sans hex). N'écrase JAMAIS un
  // surlignage déjà choisi par l'IA (champ contenant déjà `[[`).
  applyAccentHighlights(finalFunnel);

  // ===== ÉTAPE 20 : 🆕 Webinaire — date/heure + urgence saisies au wizard =====
  // Injecte un compte à rebours (countdown-date) dans la section urgency de la
  // page d'inscription (créée si absente) + le message d'urgence utilisateur.
  // 🆕 LOT 5 — Mode Evergreen : pas de date fixe, logique dédiée.
  if (brief.webinarMode === "evergreen") {
    applyEvergreenWebinarSchedule(finalFunnel, brief);
  } else {
    applyWebinarSchedule(finalFunnel, brief);
  }

  // ===== ÉTAPE 21 : 🆕 Couleurs de MARQUE (branding choisi au template) =====
  // Si l'utilisateur a activé « Utiliser les couleurs de ma marque », le design
  // du tunnel prend SES couleurs (1 à 4, saisies au choix du template) :
  // [0] primaryColor (foncé/titres/fonds), [1] secondaryColor (accent/boutons),
  // [2] accentColor (détails), [3] accentColor2 (prix/éléments spéciaux).
  // Rétrocompat : à défaut de brief.brandColors, retombe sur mainColor/secondaryColor.
  if (brief.brandColorsEnabled) {
    // brandColors (nouveau) respecte l'ordre affiché à l'utilisateur :
    // [0]=principale/boutons, [1]=foncée, [2]=secondaire, [3]=accent spécial.
    // À défaut, rétrocompat sur les anciens champs mainColor/secondaryColor
    // (mainColor=foncé, secondaryColor=principale/boutons).
    const colors = brief.brandColors?.length
      ? brief.brandColors
      : [brief.secondaryColor, brief.mainColor].filter((c): c is string => !!c);
    finalFunnel.design = {
      ...finalFunnel.design,
      ...(colors[0] ? { secondaryColor: colors[0] } : {}),
      ...(colors[1] ? { primaryColor: colors[1] } : {}),
      ...(colors[2] ? { accentColor: colors[2] } : {}),
      ...(colors[3] ? { accentColor2: colors[3] } : {}),
    };
    console.log(`[brand-colors] palette de marque appliquée (${colors.join(", ")}).`);
  }
  // 🆕 Persiste le flag EXPLICITEMENT (true ET false) — sert de garde pour
  // FunnelPreview/TemplateThemeProvider : primaryColor/secondaryColor/
  // accentColor ont TOUJOURS une valeur (IA ou défaut), ce flag seul dit si
  // elle vient d'un choix de branding réel de l'utilisateur. Sans lui, le
  // fond/les cartes/le header-footer de TOUS les templates (y compris ceux
  // sans branding) se retrouvaient recolorés par erreur.
  finalFunnel.design = {
    ...finalFunnel.design,
    brandColorsEnabled: brief.brandColorsEnabled === true,
  };

  return finalFunnel;
}

/**
 * 🆕 Webinaire : applique la date/heure (brief.webinarDate) et le message
 * d'urgence (brief.webinarUrgency) au tunnel généré. La date alimente un
 * TimerItem `countdown-date` posé sur la section `urgency` de la page
 * d'accueil (inscription). Si aucune section urgency n'existe, on en crée une
 * juste après le hero. Idempotent : ne duplique pas un timer existant.
 */
function applyWebinarSchedule(funnel: Funnel, brief: FunnelBrief): void {
  if (!brief.webinarDate) return;
  // 🆕 On raisonne en WALL-CLOCK naïf (l'heure saisie, sans fuseau) pour que
  // l'affichage soit fidèle et IDENTIQUE côté serveur et client. `targetDate`
  // (Date construite en UTC littéral) ne sert qu'aux calculs (expiration, ICS).
  const wc = toWallClockString(brief.webinarDate);
  if (!wc) return;
  const targetDate = wallClockToUtcDate(wc);
  if (!targetDate || Number.isNaN(targetDate.getTime())) return;

  const lang = brief.language ?? "fr";
  const labels = {
    fr: "Le webinaire commence dans",
    en: "The webinar starts in",
    es: "El webinar empieza en",
  } as const;

  // 🆕 FIX : le countdown seul n'affichait JAMAIS la date/heure en clair
  // (l'IA était censée l'écrire dans le copy via `webinarContext`, mais ce
  // n'est qu'une INSTRUCTION IA, pas garantie). Le label du timer — posé ici,
  // 100% déterministe, jamais réécrit par l'IA — inclut désormais la date
  // formatée : elle s'affiche donc TOUJOURS, quoi qu'écrive le copy autour.
  // 🆕 Formatage STABLE (fuseau-indépendant) via le helper partagé.
  const formattedDate = formatEventLong(wc, lang) ?? "";
  const dateLabels = {
    fr: `Le webinaire commence le ${formattedDate} — dans`,
    en: `The webinar starts on ${formattedDate} — in`,
    es: `El webinar empieza el ${formattedDate} — en`,
  } as const;

  const timer: TimerItem = {
    id: `timer_webinar_${Date.now().toString(36)}`,
    mode: "countdown-date",
    targetDate: wc,
    label: dateLabels[lang] ?? dateLabels.fr ?? labels.fr,
    style: "cards",
    size: "lg",
    onExpire: "keep-zero",
    showDays: true,
  };

  const applyToPage = (sections: FunnelSection[]): FunnelSection[] => {
    const urgency = sections.find((s) => s.type === "urgency");
    if (urgency) {
      const items = Array.isArray(urgency.items) ? urgency.items : [];
      const hasTimer = items.some((it) => it.kind === "timer");
      if (!hasTimer) items.push({ kind: "timer", data: timer });
      else {
        // Timer déjà présent (souvent posé par l'IA elle-même, cadre
        // SCARCITY-URGENCY) → on ne le duplique pas, mais on CALE sa date ET
        // son label sur les valeurs déterministes ci-dessus. Sans réécrire le
        // label ici, le timer généré par l'IA gardait son texte d'origine
        // (générique, sans date) même si la cible du countdown, elle, était
        // correcte — c'est ce qui faisait dire "la date ne s'affiche nulle
        // part" alors que le countdown tournait bien.
        urgency.items = items.map((it) =>
          it.kind === "timer"
            ? {
                kind: "timer" as const,
                data: {
                  ...it.data,
                  mode: "countdown-date" as const,
                  targetDate: timer.targetDate,
                  label: timer.label,
                  showDays: true,
                },
              }
            : it,
        );
      }
      if (!hasTimer) urgency.items = items;
      if (brief.webinarUrgency && !urgency.subheadline) {
        urgency.subheadline = brief.webinarUrgency;
      }
      return sections;
    }
    // Pas de section urgency → on en crée une juste après le hero.
    const heroIdx = sections.findIndex((s) => s.type === "hero");
    const created: FunnelSection = {
      id: `urgency_${Date.now().toString(36)}`,
      type: "urgency",
      headline: labels[lang] ?? labels.fr,
      ...(brief.webinarUrgency ? { subheadline: brief.webinarUrgency } : {}),
      items: [{ kind: "timer", data: timer }],
      visible: true,
    };
    const out = [...sections];
    out.splice(heroIdx >= 0 ? heroIdx + 1 : 0, 0, created);
    return out;
  };

  const home = funnel.pages?.find((p) => p.isHome) ?? funnel.pages?.[0];
  if (home) {
    home.sections = applyToPage(home.sections);
    funnel.sections = home.sections;
  } else {
    funnel.sections = applyToPage(funnel.sections ?? []);
  }
  console.log(
    `[webinar-schedule] countdown appliqué (cible ${timer.targetDate}${brief.webinarUrgency ? " + urgence utilisateur" : ""}).`,
  );

  // 🆕 Date/heure affichée en clair dans le header sticky (page d'accueil
  // uniquement — le header ne s'affiche déjà que là par défaut). Distinct du
  // countdown : ici on montre juste la date/heure lisible, sans compte à
  // rebours, animée pour attirer l'œil.
  funnel.header = {
    ...funnel.header,
    eventDateTime: wc,
  };

  // 🆕 LOT 4 — Salle d'attente/live : même countdown + CTA vers le lien
  // externe (Zoom/YouTube/Meet) si renseigné.
  const livePage = funnel.pages?.find((p) => p.role === "live");
  if (livePage) {
    const liveTimer: TimerItem = { ...timer, id: `${timer.id}_live`, onExpire: "keep-zero" };
    const urgencyIdx = livePage.sections.findIndex((s) => s.type === "urgency");
    if (urgencyIdx >= 0) {
      // ⚠️ Annotation explicite : sans elle, TS (5.5+) infère un type prédicat
      // automatique sur .filter(it => it.kind !== "timer") qui EXCLUT "timer"
      // du type du tableau résultant → le .push({kind:"timer",...}) suivant
      // échoue à la compilation alors que c'est justement pour le réinsérer.
      const items: SectionItem[] = Array.isArray(livePage.sections[urgencyIdx].items)
        ? livePage.sections[urgencyIdx].items!.filter((it) => it.kind !== "timer")
        : [];
      items.push({ kind: "timer", data: liveTimer });
      livePage.sections[urgencyIdx] = { ...livePage.sections[urgencyIdx], items };
    }
    if (brief.webinarExternalLink?.trim()) {
      const link = brief.webinarExternalLink.trim();
      const ctaIdx = findLastIndex(livePage.sections, (s) => s.type === "cta");
      if (ctaIdx >= 0) {
        const label = livePage.sections[ctaIdx].cta?.label || "Rejoindre le direct";
        livePage.sections[ctaIdx] = {
          ...livePage.sections[ctaIdx],
          cta: makeRedirectCta(label, link, "_blank"),
        };
      }
    }
  }

  // 🆕 LOT 4 — Replay : timer d'expiration automatique (défaut 72h après le
  // webinaire). À expiration, le message remplace la vidéo (onExpire: "show-message").
  const replayPage = funnel.pages?.find((p) => p.role === "replay");
  if (replayPage) {
    const hours = Math.max(1, Math.min(720, Number(brief.replayExpiryHours) || 72));
    const expiryDate = new Date(targetDate.getTime() + hours * 60 * 60 * 1000);
    const expiryWc = utcDateToWallClock(expiryDate);
    const expiryLabels = {
      fr: "Le replay expire dans",
      en: "The replay expires in",
      es: "El replay expira en",
    } as const;
    const expiredMessages = {
      fr: "Ce replay n'est plus disponible.",
      en: "This replay is no longer available.",
      es: "Este replay ya no está disponible.",
    } as const;
    const expiryTimer: TimerItem = {
      id: `timer_replay_expiry_${Date.now().toString(36)}`,
      mode: "countdown-date",
      targetDate: expiryWc,
      label: expiryLabels[lang] ?? expiryLabels.fr,
      expiredMessage: expiredMessages[lang] ?? expiredMessages.fr,
      style: "cards",
      size: "md",
      onExpire: "show-message",
      showDays: true,
    };
    const replayUrgencyIdx = replayPage.sections.findIndex((s) => s.type === "urgency");
    if (replayUrgencyIdx >= 0) {
      const items: SectionItem[] = Array.isArray(replayPage.sections[replayUrgencyIdx].items)
        ? replayPage.sections[replayUrgencyIdx].items!.filter((it) => it.kind !== "timer")
        : [];
      items.push({ kind: "timer", data: expiryTimer });
      replayPage.sections[replayUrgencyIdx] = { ...replayPage.sections[replayUrgencyIdx], items };
    } else {
      const heroIdx = replayPage.sections.findIndex((s) => s.type === "hero");
      const created: FunnelSection = {
        id: `urgency_replay_${Date.now().toString(36)}`,
        type: "urgency",
        headline: expiryLabels[lang] ?? expiryLabels.fr,
        items: [{ kind: "timer", data: expiryTimer }],
        visible: true,
      };
      replayPage.sections.splice(heroIdx >= 0 ? heroIdx + 1 : 0, 0, created);
    }
  }

  // 🆕 LOT 4 — Confirmation : CTA "Ajouter à mon agenda" → fichier .ics en
  // data URI (fonctionne avec Google/Outlook/Apple Calendar, sans dépendre du
  // slug publié ni d'une route serveur).
  const confirmationPage = funnel.pages?.find((p) => p.role === "confirmation");
  if (confirmationPage) {
    const icsUri = buildWebinarIcsDataUri({
      title: brief.offerName || brief.brandName || "Webinaire",
      description: brief.promise || undefined,
      startDate: targetDate,
      durationMinutes: 60,
      location: brief.webinarExternalLink?.trim() || undefined,
    });
    const ctaIdx = findLastIndex(confirmationPage.sections, (s) => s.type === "cta");
    if (ctaIdx >= 0) {
      const label = confirmationPage.sections[ctaIdx].cta?.label || "Ajouter à mon calendrier";
      confirmationPage.sections[ctaIdx] = {
        ...confirmationPage.sections[ctaIdx],
        cta: makeRedirectCta(label, icsUri, "_blank"),
      };
    }
  }
}

/**
 * 🆕 LOT 5 — Version ÉVERGREEN du webinaire (pas de date fixe) : chaque
 * prospect choisit son créneau côté client (voir EvergreenPlayerBlock dans
 * FunnelPreview.tsx) et le compte à rebours d'offre est calculé depuis SON
 * inscription individuelle (mode "countdown-since-registration"), PAS depuis
 * une date commune. Remplace applyWebinarSchedule quand
 * brief.webinarMode === "evergreen".
 */
function applyEvergreenWebinarSchedule(funnel: Funnel, brief: FunnelBrief): void {
  const lang = brief.language ?? "fr";
  const offerHours = Math.max(1, Math.min(720, Number(brief.evergreenOfferHours) || 24));

  const offerLabels = {
    fr: "Offre spéciale valable",
    en: "Special offer valid for",
    es: "Oferta especial válida por",
  } as const;
  const expiredMessages = {
    fr: "Cette offre a expiré.",
    en: "This offer has expired.",
    es: "Esta oferta ha expirado.",
  } as const;

  const makeTimer = (idSuffix: string): TimerItem => ({
    id: `timer_evergreen_${idSuffix}_${Date.now().toString(36)}`,
    mode: "countdown-since-registration",
    durationHours: offerHours,
    label: offerLabels[lang] ?? offerLabels.fr,
    expiredMessage: expiredMessages[lang] ?? expiredMessages.fr,
    style: "cards",
    size: "lg",
    onExpire: "show-message",
    showDays: false,
  });

  const applyToUrgency = (sections: FunnelSection[] | undefined, idSuffix: string): void => {
    if (!sections) return;
    const idx = sections.findIndex((s) => s.type === "urgency");
    if (idx >= 0) {
      const items: SectionItem[] = Array.isArray(sections[idx].items)
        ? sections[idx].items!.filter((it) => it.kind !== "timer")
        : [];
      items.push({ kind: "timer", data: makeTimer(idSuffix) });
      sections[idx] = { ...sections[idx], items };
      if (brief.webinarUrgency && !sections[idx].subheadline) {
        sections[idx].subheadline = brief.webinarUrgency;
      }
    } else {
      const heroIdx = sections.findIndex((s) => s.type === "hero");
      const created: FunnelSection = {
        id: `urgency_evergreen_${idSuffix}_${Date.now().toString(36)}`,
        type: "urgency",
        headline: offerLabels[lang] ?? offerLabels.fr,
        ...(brief.webinarUrgency ? { subheadline: brief.webinarUrgency } : {}),
        items: [{ kind: "timer", data: makeTimer(idSuffix) }],
        visible: true,
      };
      sections.splice(heroIdx >= 0 ? heroIdx + 1 : 0, 0, created);
    }
  };

  // Countdown d'offre (relatif à l'inscription individuelle) sur live/replay/sales.
  const livePage = funnel.pages?.find((p) => p.role === "live");
  const replayPage = funnel.pages?.find((p) => p.role === "replay");
  const salesPage = funnel.pages?.find((p) => p.role === "sales");
  applyToUrgency(livePage?.sections, "live");
  applyToUrgency(replayPage?.sections, "replay");
  applyToUrgency(salesPage?.sections, "sales");

  // Vidéo pré-enregistrée diffusée sur la page "live", qui devient alors le
  // lecteur evergreen (créneau choisi par le prospect, voir FunnelPreview.tsx).
  if (livePage && brief.evergreenVideoUrl?.trim()) {
    livePage.evergreenVideoUrl = brief.evergreenVideoUrl.trim();
  }

  console.log(
    `[webinar-evergreen] countdown d'offre (${offerHours}h depuis inscription individuelle) appliqué` +
      (livePage?.evergreenVideoUrl ? " + lecteur evergreen sur la page live." : "."),
  );
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/**
 * 🆕 Surligne automatiquement les éléments les plus « captivants » d'un texte —
 * prix, pourcentages, chiffres marquants — avec la syntaxe `[[texte]]` (sans
 * couleur explicite → hérite de `var(--ff-accent)`, donc TOUJOURS la couleur du
 * template). Conservateur : max 2 surlignages par champ, et on ne touche pas un
 * champ que l'IA a déjà surligné (présence de `[[`).
 */
const ACCENT_TOKEN_RE =
  /(\d[\d  .,]*\d|\d)\s?(?:%|€|\$|£|FCFA|XOF|XAF|USD|EUR)|\b\d{2,}(?:[.,]\d+)?\b/g;

function highlightCaptivatingTokens(text: string | undefined): string | undefined {
  if (!text) return text;
  if (text.includes("[[")) return text; // déjà surligné par l'IA → on respecte
  let count = 0;
  // 🆕 Préférence utilisateur : couleur par défaut SOBRE → 1 seul surlignage max.
  return text.replace(ACCENT_TOKEN_RE, (m) => {
    if (count >= 1) return m;
    count++;
    return `[[${m.trim()}]]`;
  });
}

/**
 * 🆕 Retire toute COULEUR choisie par l'IA dans un surlignage : `[[mot|#fff]]`
 * → `[[mot]]`. Raison : l'IA choisissait parfois un hex clair (blanc) → texte
 * invisible sur fond clair. Sans hex, le rendu reprend `var(--ff-accent)` du
 * template (contraste garanti). N'affecte PAS les couleurs posées MANUELLEMENT
 * par l'utilisateur ensuite (outil « Colorer la sélection »), appliquées après
 * génération.
 */
function stripAiHighlightColors(text: string | undefined): string | undefined {
  if (!text || text.indexOf("[[") === -1) return text;
  return text.replace(/\[\[([^\]|]+?)\|[^\]]+\]\]/g, "[[$1]]");
}

function applyAccentHighlights(funnel: Funnel): void {
  const apply = (s: FunnelSection): void => {
    // 1) On neutralise d'abord les couleurs IA (évite le blanc-sur-blanc).
    //    `headline` est un champ requis (string) → on garde l'original si la
    //    fonction renvoie undefined (cas entrée vide), pour rester type-safe.
    s.headline = stripAiHighlightColors(s.headline) ?? s.headline;
    s.subheadline = stripAiHighlightColors(s.subheadline);
    s.body = stripAiHighlightColors(s.body);
    if (Array.isArray(s.bullets)) {
      s.bullets = s.bullets.map((b) => stripAiHighlightColors(b) ?? b);
    }
    // 2) Puis on ajoute l'accent du template sur le TITRE uniquement si rien.
    //    (🆕 sous-titre exclu : la couleur par défaut était jugée sur-appliquée)
    s.headline = highlightCaptivatingTokens(s.headline) ?? s.headline;
  };
  funnel.sections?.forEach(apply);
  funnel.pages?.forEach((p) => p.sections?.forEach(apply));
}

/**
 * 🆕 Garantit que les pages post-achat (merci/confirmation/livraison/accès)
 * portent un HERO célébratoire : le renderer y ajoute l'icône ✓ (layout
 * « success » lié au rôle) + un message de félicitations. Sans hero, la page
 * paraissait vide (« Que faire ensuite ? » seul, sans ✓).
 */
function ensureCelebratoryThankYou(funnel: Funnel, lang: Language): void {
  const ROLES: PageRole[] = ["thankyou", "confirmation", "delivery", "access"];
  type Tri = Record<Language, string>;
  type Block = { eyebrow: Tri; h: Tri; b: Tri };

  // 🆕 Le copy de remerciement doit s'adapter : un lead magnet GRATUIT ne parle
  // pas de « commande ». On ne garde la langue « commande/achat » que pour des
  // tunnels clairement PAYANTS.
  const PAID_KINDS = ["digital-product", "coaching-high-ticket", "vsl", "formation", "service", "saas"];
  const isPaid = PAID_KINDS.includes((funnel.meta?.funnelKind as string) ?? "");

  const thankyouPaid: Block = {
    eyebrow: { fr: "C'EST CONFIRMÉ", en: "CONFIRMED", es: "CONFIRMADO" },
    h: {
      fr: "Félicitations, votre commande est confirmée",
      en: "Congratulations, your order is confirmed",
      es: "Felicidades, tu pedido está confirmado",
    },
    b: {
      fr: "Merci pour votre confiance. Un email avec tous les détails d'accès arrive dans votre boîte de réception. Suivez l'étape ci-dessous pour démarrer.",
      en: "Thank you for your trust. An email with all your access details is on its way. Follow the step below to get started.",
      es: "Gracias por tu confianza. Un email con todos los detalles de acceso está en camino. Sigue el paso de abajo para empezar.",
    },
  };
  const thankyouFree: Block = {
    eyebrow: { fr: "C'EST FAIT", en: "ALL SET", es: "LISTO" },
    h: {
      fr: "Votre inscription est confirmée",
      en: "You're in — registration confirmed",
      es: "Tu inscripción está confirmada",
    },
    b: {
      fr: "Votre accès arrive par email d'ici quelques minutes. Pensez à regarder dans les spams ou promotions, et ajoutez l'expéditeur à vos contacts pour ne rien manquer.",
      en: "Your access is arriving by email within minutes. Check spam or promotions if needed, and add the sender to your contacts so you don't miss it.",
      es: "Tu acceso llega por email en unos minutos. Revisa spam o promociones si hace falta, y añade al remitente a tus contactos.",
    },
  };

  const copy: Partial<Record<PageRole, Block>> = {
    thankyou: isPaid ? thankyouPaid : thankyouFree,
    confirmation: {
      eyebrow: { fr: "C'EST CONFIRMÉ", en: "CONFIRMED", es: "CONFIRMADO" },
      h: {
        fr: "Votre inscription est confirmée",
        en: "Your registration is confirmed",
        es: "Tu inscripción está confirmada",
      },
      b: {
        fr: "Tout est bon de votre côté. Notez bien la prochaine étape ci-dessous.",
        en: "You're all set. Note the next step below.",
        es: "Todo listo. Anota el siguiente paso abajo.",
      },
    },
    delivery: {
      eyebrow: { fr: "ACCÈS PRÊT", en: "ACCESS READY", es: "ACCESO LISTO" },
      h: {
        fr: "Votre accès est prêt",
        en: "Your access is ready",
        es: "Tu acceso está listo",
      },
      b: {
        fr: "Récupérez votre contenu ci-dessous et commencez dès maintenant.",
        en: "Grab your content below and start right now.",
        es: "Obtén tu contenido abajo y empieza ahora mismo.",
      },
    },
    access: {
      eyebrow: { fr: "BIENVENUE", en: "WELCOME", es: "BIENVENIDO" },
      h: {
        fr: "Bienvenue, votre accès est ouvert",
        en: "Welcome, your access is open",
        es: "Bienvenido, tu acceso está abierto",
      },
      b: {
        fr: "Vous y êtes. Suivez l'étape ci-dessous pour démarrer.",
        en: "You're in. Follow the step below to get started.",
        es: "Ya estás dentro. Sigue el paso de abajo para empezar.",
      },
    },
  };

  funnel.pages?.forEach((page) => {
    if (!ROLES.includes(page.role)) return;
    if (!Array.isArray(page.sections)) page.sections = [];
    const c = copy[page.role] ?? copy.thankyou!;
    let hero = page.sections.find((s) => s.type === "hero");
    if (!hero) {
      hero = {
        id: `hero_thanks_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: "hero",
        headline: c.h[lang] ?? c.h.fr,
        visible: true,
      };
      page.sections.unshift(hero);
    }
    if (!hero.headline?.trim() || isPlaceholderHeadline(hero.headline)) {
      hero.headline = c.h[lang] ?? c.h.fr;
    }
    if (!hero.eyebrow?.trim()) hero.eyebrow = c.eyebrow[lang] ?? c.eyebrow.fr;
    if (!hero.body?.trim() || hero.body.trim().length < 20) {
      hero.body = c.b[lang] ?? c.b.fr;
    }
    hero.image = { mode: "none" };
    hero.layoutVariant = "centered";
  });
}

/**
 * 🆕 Hero SIMPLE : retire les puces du hero si elles ne tiennent pas sur UNE
 * seule ligne (bande « | »). Sinon on garde un hero épuré (titre, sous-titre,
 * média, CTA). Seuil : ≤4 puces ET ≤12 mots cumulés (≤6 mots chacune).
 */
function heroBulletsFitOneLine(bullets: string[]): boolean {
  if (bullets.length === 0 || bullets.length > 4) return false;
  const words = (b: string) => b.trim().split(/\s+/).filter(Boolean).length;
  const total = bullets.reduce((n, b) => n + words(b), 0);
  return total <= 12 && bullets.every((b) => words(b) <= 6);
}

function tidyHeroSections(funnel: Funnel): void {
  const apply = (sections?: FunnelSection[]): void => {
    if (!Array.isArray(sections)) return;
    for (const s of sections) {
      if (s.type !== "hero") continue;
      // 🆕 Hero = Hook (titre) + Promesse (sous-titre) + CTA. Aucun corps de
      // texte ("blabla") : après la promesse, on enchaîne direct sur le CTA.
      if (s.body) delete s.body;
      if (
        Array.isArray(s.bullets) &&
        s.bullets.length > 0 &&
        !heroBulletsFitOneLine(s.bullets)
      ) {
        delete s.bullets;
        delete s.bulletIcons;
      }
    }
  };
  if (Array.isArray(funnel.sections)) apply(funnel.sections);
  funnel.pages?.forEach((p) => apply(p.sections));
}

/**
 * 🆕 L'image de l'auteur doit apparaître DANS le hero ET dans le about. On prend
 * l'image disponible (de préférence celle du about = photo auteur) et on la copie
 * sur l'autre section si elle en manque. Page par page.
 */
function sectionHasImg(s: FunnelSection | undefined): boolean {
  return !!(s?.image && s.image.mode !== "none" && (s.image.url || s.image.mediaRef));
}

function shareAuthorImageHeroAbout(funnel: Funnel): void {
  const apply = (sections?: FunnelSection[]): void => {
    if (!Array.isArray(sections)) return;
    const hero = sections.find((s) => s.type === "hero");
    const about = sections.find((s) => s.type === "about");
    if (!hero || !about) return;
    const src = sectionHasImg(about)
      ? about.image
      : sectionHasImg(hero)
        ? hero.image
        : undefined;
    if (!src) return;
    if (!sectionHasImg(hero)) hero.image = { ...src };
    if (!sectionHasImg(about)) about.image = { ...src };
  };
  if (Array.isArray(funnel.sections)) apply(funnel.sections);
  funnel.pages?.forEach((p) => apply(p.sections));
}

/**
 * 🆕 B2 — Mise en page PILOTÉE PAR CALCUL, appliquée à TOUTES les sections
 * narratives (pas seulement problème/agitation), inspirée des tunnels premium
 * (systeme.io & co). Pour chaque section éligible, on choisit :
 *   - SPLIT MÉDIA : média (image/vidéo) d'un côté, texte de l'autre — dès qu'il
 *     y a un média + du texte.
 *   - SPLIT ÉDITORIAL : texte d'un côté, puces en CARTES de l'autre — quand il
 *     n'y a pas de média mais un corps consistant + 2 à 5 puces (le renderer
 *     pose data-ff-split-mode="text", déjà stylé dans funnel-theme.css).
 *   - Sinon : pas de split (grille de cartes pleine largeur ou centré selon le
 *     calcul des bullets), pour éviter de tasser de longues listes.
 * L'alternance gauche/droite est STRICTE (split-text-image ↔ split-image-text)
 * sur l'ensemble de la page, conformément à layout-design-tunnel.
 */
// 🆕 Types éligibles au SPLIT (texte | cartes, alternance gauche/droite).
// problem / agitation / proof en sont RETIRÉS : ils reçoivent désormais un
// PATTERN dédié (checklist douleur / bande de stats) via funnel-theme.css.
const SPLIT_ELIGIBLE_TYPES: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "about",
  "solution",
  "offer",
  "benefits",
]);

/**
 * 🆕 Purge des médias non résolus. Une image n'est conservée que si elle pointe
 * vers une ressource réellement chargeable : soit son `url` est utilisable
 * (http/https/data/blob/chemin), soit son `mediaRef` résout vers un média du
 * funnel possédant une URL utilisable. Sinon → `{ mode: "none" }` (aucune colonne
 * réservée, aucune <img> cassée). Idem pour les vidéos.
 */
function stripUnresolvedMedia(funnel: Funnel): void {
  const mediaById = new Map<string, MediaItem>();
  for (const m of funnel.media ?? []) {
    if (m.id) mediaById.set(m.id, m);
  }

  const refResolvesToUsable = (ref: string | undefined): boolean => {
    if (!ref) return false;
    if (isUsableMediaUrl(ref)) return true;
    const m = mediaById.get(ref);
    return !!(m && isUsableMediaUrl(m.url));
  };

  const cleanSection = (s: FunnelSection): void => {
    if (s.image && s.image.mode !== "none") {
      const usable =
        isUsableMediaUrl(s.image.url) || refResolvesToUsable(s.image.mediaRef);
      if (!usable) s.image = { mode: "none" };
    }
    if (s.video && !isUsableMediaUrl(s.video.url)) {
      s.video = undefined;
    }
  };

  funnel.sections?.forEach(cleanSection);
  funnel.pages?.forEach((p) => p.sections?.forEach(cleanSection));
}

function assignAlternatingSplitLayouts(funnel: Funnel): void {
  const apply = (sections?: FunnelSection[]): void => {
    if (!Array.isArray(sections)) return;
    let splitIndex = 0;
    for (const s of sections) {
      if (!SPLIT_ELIGIBLE_TYPES.has(s.type)) continue;

      const hasImage = !!(
        s.image &&
        s.image.mode !== "none" &&
        (s.image.url || s.image.mediaRef)
      );
      const hasVideo = !!(s.video && s.video.url);
      const hasMedia = hasImage || hasVideo;
      const bodyLen = (s.body ?? "").trim().length;
      const bulletCount = Array.isArray(s.bullets) ? s.bullets.length : 0;
      const hasText = !!(s.headline?.trim() || bodyLen > 0 || bulletCount > 0);

      // Calcul : split média seulement si TEXTE SUBSTANTIEL (sinon une section
      // pauvre — juste un titre + image — donne un split bancal, image « flottante »
      // et colonne vide). Split éditorial : corps consistant + 2 à 5 puces, sans média.
      void hasText;
      const mediaSplit = hasMedia && (bodyLen >= 40 || bulletCount >= 2);
      // 🆕 Split éditorial ÉLARGI (sans média) pour casser la monotonie « tout
      // centré » quand le tunnel n'a pas d'images : dès qu'une section a 2–4
      // cartes et un minimum de corps, on la passe en split (texte | cartes),
      // en alternance gauche/droite. Le renderer rééquilibre lui-même (4+ cartes
      // → grille centrée) donc pas de colonne bancale.
      const editorialSplit =
        !hasMedia && bulletCount >= 2 && bulletCount <= 4 && bodyLen >= 30;
      if (!mediaSplit && !editorialSplit) continue;

      s.layoutVariant = splitIndex % 2 === 0 ? "split-text-image" : "split-image-text";
      splitIndex++;
    }
  };
  if (Array.isArray(funnel.sections)) apply(funnel.sections);
  funnel.pages?.forEach((p) => {
    // 🆕 Pages post-achat (merci/confirmation/accès…) : PAS de split → rendu
    // simple et centré (cf. simplifyPostConversionPages).
    if (POST_CONVERSION_ROLES.has(p.role)) return;
    apply(p.sections);
  });
}

// 🆕 Patterns de sections : chaque famille (problème/agitation, process, stats)
// reçoit un pattern visuel choisi ALÉATOIREMENT à chaque génération, avec
// anti-répétition de STYLE entre deux sections qui se suivent (peu importe
// leur type) : on ne pioche jamais deux fois de suite dans la même « famille »
// visuelle (centered / split / grid / cards / timeline / …). Le renderer émet
// data-ff-pattern → funnel-theme.css applique la mise en page correspondante.
const SECTION_PATTERN_VARIANTS: Partial<Record<FunnelSectionType, readonly string[]>> = {
  hero: ["hero-centered-nav-glow", "hero-split-stats-search-b2b", "hero-video-centered-funnel"],
  problem: [
    "problem-split-pain-checklist",
    "problem-centered-quote-stat",
    "problem-cards-before-comparison",
  ],
  agitation: [
    "problem-split-pain-checklist",
    "problem-centered-quote-stat",
    "problem-cards-before-comparison",
  ],
  benefits: [
    "benefits-grid-numbered-flat",
    "benefits-cards-4-shadow-longtext",
    "benefits-horizontal-steps-arrow",
    "benefits-cards-6-shadow-classic",
  ],
  process: [
    "process-grid-numbered-rich",
    "process-timeline-vertical-circles",
    "process-faq-numbered-hybrid",
    "process-horizontal-steps-arrow",
  ],
  proof: [
    "stats-cards-4-suffix-badge",
    "stats-cards-4-percent-icons",
    "stats-bar-horizontal-no-card",
  ],
  testimonials: [
    "testimonials-3cards-grid",
    "testimonials-2x2-stars-date",
    "testimonials-list-quotes",
    "testimonials-carousel-video",
  ],
  pricing: [
    "pricing-comparison-3tiers",
    "pricing-single-card-spotlight",
    "pricing-split-guarantee-emphasis",
  ],
  offer: [
    "pricing-comparison-3tiers",
    "pricing-single-card-spotlight",
    "pricing-split-guarantee-emphasis",
  ],
  cta: [
    "cta-final-centered-urgency",
    "cta-final-split-recap-benefits",
    "cta-final-glow-countdown",
  ],
  faq: [
    "faq-accordion",
    "faq-sandwich-double-cta",
    "faq-hub-grid-links",
    "faq-grid-intro",
  ],
};

// 🆕 Variante de footer choisie de façon seedée (stable par tunnel). N'écrase
// jamais un choix explicite déjà présent. Rendu par FunnelFooter.tsx.
const FOOTER_VARIANTS = [
  "footer-minimal-centered",
  "footer-grid-sitemap",
  "footer-cta-newsletter",
] as const;

function assignFooterVariant(funnel: Funnel): void {
  const meta = (funnel.meta ?? {}) as { footerVariant?: string };
  if (meta.footerVariant) return; // respecte un choix explicite
  const seed = funnel.funnelName || "af";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const chosen = FOOTER_VARIANTS[Math.abs(h) % FOOTER_VARIANTS.length];
  funnel.meta = { ...(funnel.meta ?? {}), footerVariant: chosen };
}

// 🆕 « Famille » visuelle d'un pattern (déduite de son nom) : sert uniquement
// à empêcher deux sections consécutives d'avoir le même AIR (deux « centered »
// ou deux « grid » qui se suivent), même si leurs types diffèrent. Ordre des
// tests important (du plus spécifique au plus générique).
function patternFamily(pattern?: string | null): string {
  if (!pattern) return "none";
  const p = pattern.toLowerCase();
  if (p.includes("split")) return "split";
  if (p.includes("centered")) return "centered";
  if (p.includes("timeline")) return "timeline";
  if (p.includes("carousel")) return "carousel";
  if (p.includes("accordion")) return "accordion";
  if (p.includes("grid") || p.includes("2x2")) return "grid";
  if (p.includes("card")) return "cards";
  if (p.includes("steps")) return "steps";
  if (p.includes("list")) return "list";
  if (p.includes("bar")) return "bar";
  if (p.includes("comparison")) return "comparison";
  if (p.includes("glow")) return "glow";
  if (p.includes("video")) return "video";
  return "other";
}

// 🆕 Tirage VRAIMENT aléatoire dans un pool, en excluant la famille du style
// précédent quand c'est possible (anti-répétition entre deux sections qui se
// suivent). Si l'exclusion viderait le pool, on retombe sur le pool complet.
function pickPattern(pool: readonly string[], lastFamily: string | null): string {
  if (pool.length === 0) return "";
  let candidates: readonly string[] = pool;
  if (lastFamily && pool.length > 1) {
    const filtered = pool.filter((p) => patternFamily(p) !== lastFamily);
    if (filtered.length > 0) candidates = filtered;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function assignSectionPatterns(funnel: Funnel): void {
  const apply = (sections?: FunnelSection[]): void => {
    if (!Array.isArray(sections)) return;
    // Style de la section précédente (toutes familles de sections confondues)
    // — c'est CE qu'on compare pour éviter deux styles identiques d'affilée.
    let lastFamily: string | null = null;
    sections.forEach((s) => {
      const variants = SECTION_PATTERN_VARIANTS[s.type];
      if (!variants || variants.length === 0) return;
      // 🆕 Hero : sélection selon le média disponible (image-aware / video-aware).
      //  - vidéo → hero-video-centered-funnel (embed réel)
      //  - image → hero-split-stats-search-b2b (photo à droite)
      //  - aucun → centré-glow OU split-stats (mock), au tirage aléatoire
      if (s.type === "hero") {
        const hasVideo = !!(s.video && s.video.url);
        const hasImage = !!(
          s.image && s.image.mode !== "none" && (s.image.url || s.image.mediaRef)
        );
        if (hasVideo) s.pattern = "hero-video-centered-funnel";
        else if (hasImage) s.pattern = "hero-split-stats-search-b2b";
        else s.pattern = pickPattern(["hero-centered-nav-glow", "hero-split-stats-search-b2b"], lastFamily);
        lastFamily = patternFamily(s.pattern);
        return;
      }
      // 🆕 Prix/offre : CONTENT-AWARE. single-card/split n'affichent qu'UN palier
      // → réservés au tarif à 1 palier. ≥2 paliers → comparaison (affiche tout).
      if (s.type === "pricing" || s.type === "offer") {
        const tierCount = (s.items || []).filter((it) => it.kind === "pricing").length;
        if (tierCount === 0) return;
        s.pattern =
          tierCount >= 2
            ? "pricing-comparison-3tiers"
            : pickPattern(["pricing-single-card-spotlight", "pricing-split-guarantee-emphasis"], lastFamily);
        lastFamily = patternFamily(s.pattern);
        return;
      }
      // 🆕 CTA final : content-aware. split-recap nécessite ≥2 puces (récap).
      if (s.type === "cta") {
        const hasCta = !!s.cta;
        const hasHeadline = !!(s.headline && s.headline.trim());
        if (!hasCta && !hasHeadline) return;
        const hasBullets = Array.isArray(s.bullets) && s.bullets.length >= 2;
        const pool = hasBullets
          ? [
              "cta-final-centered-urgency",
              "cta-final-split-recap-benefits",
              "cta-final-glow-countdown",
            ]
          : ["cta-final-centered-urgency", "cta-final-glow-countdown"];
        s.pattern = pickPattern(pool, lastFamily);
        lastFamily = patternFamily(s.pattern);
        return;
      }
      // 🆕 Preuve sociale (proof) : CONTENT-AWARE.
      //  - puces "Média | citation" courtes → bande presse (trustbar)
      //  - puces chiffrées "12K+ | label"   → stats
      //  - sinon (items témoignages)        → pas de pattern (rendu témoignages)
      if (s.type === "proof") {
        const bulletsArr = Array.isArray(s.bullets) ? s.bullets : [];
        if (looksLikePressBullets(bulletsArr)) {
          s.pattern = "trustbar-press-quote-strip";
          lastFamily = patternFamily(s.pattern);
        } else if (looksLikeStatsBullets(bulletsArr) && bulletsArr.length >= 2) {
          const statsPool = SECTION_PATTERN_VARIANTS.proof ?? [];
          if (statsPool.length > 0) {
            s.pattern = pickPattern(statsPool, lastFamily);
            lastFamily = patternFamily(s.pattern);
          }
        }
        return;
      }
      // FAQ / témoignages : basé sur les items, ≥2. Autres familles : ≥2 puces.
      if (s.type === "faq") {
        const faqCount = (s.items || []).filter((it) => it.kind === "faq").length;
        if (faqCount < 2) return;
      } else if (s.type === "testimonials") {
        const tCount = (s.items || []).filter((it) => it.kind === "testimonial").length;
        if (tCount < 2) return;
      } else {
        const bulletCount = Array.isArray(s.bullets) ? s.bullets.length : 0;
        if (bulletCount < 2) return;
      }
      s.pattern = pickPattern(variants, lastFamily);
      lastFamily = patternFamily(s.pattern);
    });
  };
  if (Array.isArray(funnel.sections)) apply(funnel.sections);
  funnel.pages?.forEach((p) => {
    if (POST_CONVERSION_ROLES.has(p.role)) return;
    apply(p.sections);
  });
}

/**
 * 🆕 Pages POST-ACHAT (merci, confirmation, livraison, accès) : rendu épuré et
 * centré, à l'image des meilleurs tunnels. On retire les images de section
 * (pas de visuel parasite ni de split) et on force le hero en centré — le
 * renderer y ajoute déjà l'icône ✓ et le layout « success » via le rôle de page.
 */
const POST_CONVERSION_ROLES: ReadonlySet<PageRole> = new Set<PageRole>([
  "thankyou",
  "confirmation",
  "delivery",
  "access",
]);

/* ------------------------------------------------------------------ */
/*  🆕 Dédoublonnage déterministe (CTA + sous-titres)                   */
/* ------------------------------------------------------------------ */

/** Normalise un texte pour comparaison : minuscules, sans accent ni ponctuation. */
function normalizeForCompare(s?: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    // Retire les diacritiques combinants (U+0300–U+036F) laissés par NFD.
    .replace(/[̀-ͯ]/g, "")
    // Retire les marqueurs de surlignage [[...]] posés par applyAccentHighlights.
    .replace(/\[\[|\]\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deux textes sont « quasi identiques » : égaux, inclus l'un dans l'autre,
 *  ou partageant plus de 80 % de leurs mots significatifs. */
function isNearDuplicate(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 12 && b.length > 12 && (a.includes(b) || b.includes(a))) return true;
  const wa = new Set(a.split(" ").filter((w) => w.length > 3));
  const wb = new Set(b.split(" ").filter((w) => w.length > 3));
  if (wa.size < 3 || wb.size < 3) return false;
  let common = 0;
  wa.forEach((w) => {
    if (wb.has(w)) common += 1;
  });
  return common / Math.min(wa.size, wb.size) >= 0.8;
}

/**
 * 🆕 Pages de SUCCÈS (merci/confirmation/livraison/accès) : une seule action.
 * L'IA produit un CTA dans le hero ET une section "cta" ; l'harmonisation leur
 * donnait ensuite LE MÊME libellé post-action (« Vérifier ma boîte mail »), d'où
 * deux boutons identiques. On ne garde que le premier de chaque libellé et de
 * chaque destination ; la section "cta" devenue vide est supprimée.
 */
function dedupeSuccessPageCtas(funnel: Funnel): void {
  funnel.pages?.forEach((page) => {
    if (!POST_CONVERSION_ROLES.has(page.role) || !Array.isArray(page.sections)) return;

    const seenLabels = new Set<string>();
    const seenTargets = new Set<string>();
    const next: FunnelSection[] = [];

    for (const section of page.sections) {
      const cta = section.cta;
      if (!cta?.label) {
        next.push(section);
        continue;
      }
      const label = normalizeForCompare(cta.label);
      const target = [cta.mode ?? "", cta.url ?? "", cta.pageId ?? "", cta.anchorId ?? ""].join("|");
      const duplicate = Boolean(
        (label && seenLabels.has(label)) || seenTargets.has(target),
      );

      if (!duplicate) {
        if (label) seenLabels.add(label);
        seenTargets.add(target);
        next.push(section);
        continue;
      }

      // Section dédiée au bouton → on la retire entièrement (sinon elle
      // laisserait un titre orphelin sans action). Sur les autres sections, on
      // ne retire que le bouton.
      if (section.type === "cta") continue;
      next.push(stripCta(section));
    }

    page.sections = next;
  });
}

/**
 * 🆕 Supprime les SOUS-TITRES redondants : l'IA génère régulièrement deux
 * sous-titres quasi identiques à la suite (ou un sous-titre qui paraphrase le
 * titre de sa propre section). On garde le premier et on vide les suivants.
 */
function dedupeRedundantSubheadlines(funnel: Funnel): void {
  const apply = (sections?: FunnelSection[]): void => {
    if (!Array.isArray(sections)) return;
    let previous = "";
    for (const s of sections) {
      const sub = normalizeForCompare(s.subheadline);
      if (!sub) {
        previous = "";
        continue;
      }
      // a) paraphrase du titre de la MÊME section
      if (isNearDuplicate(sub, normalizeForCompare(s.headline))) {
        s.subheadline = undefined;
        continue;
      }
      // b) quasi identique au sous-titre de la section précédente
      if (isNearDuplicate(sub, previous)) {
        s.subheadline = undefined;
        continue;
      }
      previous = sub;
    }
  };
  if (Array.isArray(funnel.sections)) apply(funnel.sections);
  funnel.pages?.forEach((p) => apply(p.sections));
}

/**
 * 🆕 Canaux communautaires saisis dans le wizard (WhatsApp / Telegram) →
 * `funnel.meta.socialChannels`, lu par SuccessChannels (aperçu + publication)
 * et par l'export HTML. Avant, ces champs n'existaient QUE dans l'éditeur
 * (Style global) : les liens demandés au wizard n'apparaissaient jamais sur la
 * page de remerciement. N'écrase pas une valeur déjà présente.
 */
function applyCommunityChannels(funnel: Funnel, brief: FunnelBrief): void {
  const whatsapp = brief.communityWhatsappUrl?.trim();
  const telegram = brief.communityTelegramUrl?.trim();
  if (!whatsapp && !telegram) return;
  const current = funnel.meta?.socialChannels ?? {};
  funnel.meta = {
    ...funnel.meta,
    socialChannels: {
      ...current,
      ...(whatsapp && !current.whatsapp ? { whatsapp } : {}),
      ...(telegram && !current.telegram ? { telegram } : {}),
    },
  };
  console.log(
    `[community-channels] canaux appliqués : ${[whatsapp && "whatsapp", telegram && "telegram"]
      .filter(Boolean)
      .join(", ")}`,
  );
}

function simplifyPostConversionPages(funnel: Funnel): void {
  funnel.pages?.forEach((p) => {
    if (p.isHome || !Array.isArray(p.sections)) return;
    const isPostConv = POST_CONVERSION_ROLES.has(p.role);
    for (const s of p.sections) {
      // 🆕 STRICT : aucune image sur les pages AUTRES que l'accueil.
      if (s.image && s.image.mode !== "none") s.image = { mode: "none" };
      // Sans image, ces sections ne peuvent plus être en split média → on les
      // recentre (évite les colonnes vides / cartes qui « flottent »).
      if (s.layoutVariant === "split-text-image" || s.layoutVariant === "split-image-text") {
        s.layoutVariant = "centered";
      }
      if (isPostConv && s.type === "hero") s.layoutVariant = "centered";
    }
  });
}

/**
 * 🆕 B2 — Variation visuelle des cards (anti « toutes pareilles ») :
 *  - Sections à cards (bénéfices, bonus, problème, agitation, solution) →
 *    rotation d'icônes DISTINCTES (au lieu de la même « check » partout).
 * Data-level : le renderer (FunnelPreview) lit déjà bulletIcons[i].
 * N'écrase pas des icônes déjà fournies par l'IA.
 * NB : on ne force PLUS numberedBullets sur process/program — ces sections ont
 * déjà leur propre numérotation, ce qui créait un DOUBLON de numéros.
 */
const CARD_ICON_ROTATIONS: Partial<Record<FunnelSectionType, IconName[]>> = {
  benefits: ["target", "trendingUp", "zap", "star", "checkCircle", "award"],
  bonus: ["gift", "sparkles", "rocket", "crown", "star", "zap"],
  problem: ["flame", "clock", "trendingDown", "lock", "barChart", "shield"],
  agitation: ["flame", "clock", "trendingDown", "lock", "barChart", "shield"],
  solution: ["lightbulb", "rocket", "checkCircle", "zap", "target", "sparkles"],
};

function assignCardVariation(funnel: Funnel): void {
  const apply = (sections?: FunnelSection[]): void => {
    if (!Array.isArray(sections)) return;
    for (const s of sections) {
      const bulletCount = Array.isArray(s.bullets) ? s.bullets.length : 0;
      if (bulletCount === 0) continue;

      // Cards → icônes distinctes (si l'IA n'en a pas déjà fourni).
      const rotation = CARD_ICON_ROTATIONS[s.type];
      const hasIcons = Array.isArray(s.bulletIcons) && s.bulletIcons.length > 0;
      if (rotation && !hasIcons) {
        s.bulletIcons = (s.bullets ?? []).map((_, i) => rotation[i % rotation.length]);
      }
    }
  };
  if (Array.isArray(funnel.sections)) apply(funnel.sections);
  funnel.pages?.forEach((p) => apply(p.sections));
}

/**
 * 🆕 Sous-étape B : garantit une section "about" (Présentation/Autorité) sur la
 * page principale quand l'utilisateur a fourni un texte « à propos ».
 * - N'agit que si brief.aboutText est non vide.
 * - Ne fait rien si une section "about" existe déjà (sur n'importe quelle page).
 * - Respecte la whitelist : n'injecte que si "about" est autorisé sur la page.
 * - Le positionnement final (après les bénéfices) est géré par l'ordre canonique.
 */
function ensureAuthoritySection(funnel: Funnel, brief: FunnelBrief): void {
  const aboutText = brief.aboutText?.trim();
  if (!aboutText) return;

  const pages = funnel.pages ?? [];
  const alreadyHasAbout =
    pages.some((p) => p.sections?.some((s) => s.type === "about")) ||
    (Array.isArray(funnel.sections) && funnel.sections.some((s) => s.type === "about"));
  if (alreadyHasAbout) return;

  const kind =
    (funnel.meta?.funnelKind as FunnelKind | undefined) ??
    normalizeFunnelKind(brief.funnelKind) ??
    "lead-magnet";

  const homePage = pages.find((p) => p.isHome) ?? pages[0];
  if (!homePage || !Array.isArray(homePage.sections)) return;

  const allowed = getAllowedSectionTypes(kind, homePage.role);
  if (allowed && !allowed.includes("about")) return;

  const aboutSection: FunnelSection = {
    id: "about-authority",
    type: "about",
    headline: "",
    image: { mode: "none" },
    visible: true,
  };
  // Remplit headline + body depuis aboutText (et marque-place autorité).
  tryFillSectionFromBrief(aboutSection, brief);

  // Insère après le hero (l'ordre canonique le replacera après les bénéfices).
  const heroIdx = homePage.sections.findIndex((s) => s.type === "hero");
  if (heroIdx >= 0) {
    homePage.sections.splice(heroIdx + 1, 0, aboutSection);
  } else {
    homePage.sections.unshift(aboutSection);
  }

  // Garde la home mono-page (funnel.sections) cohérente si elle reflète la home.
  if (homePage.isHome && Array.isArray(funnel.sections)) {
    funnel.sections = homePage.sections;
  }
}

/**
 * Rang canonique d'une page de vente (plus petit = plus haut). Inspiré des
 * règles layout-design-tunnel, MAIS les témoignages sont placés volontairement
 * vers la fin (juste avant la FAQ) conformément à la préférence produit.
 */
const CANONICAL_SECTION_RANK: Record<string, number> = {
  hero: 0,
  problem: 20,
  agitation: 25, // 🆕 amplification : juste après le problème
  solution: 30,
  process: 40,
  program: 45,
  webinar: 48,
  benefits: 50,
  about: 55, // 🆕 Présentation/Autorité APRÈS les bénéfices (copywriting DR)
  video: 60,
  proof: 65,
  qualification: 68,
  offer: 70,
  pricing: 72,
  bonus: 80,
  guarantee: 90,
  testimonials: 100, // près de la fin, avant la FAQ
  faq: 110,
  urgency: 115, // 🆕 urgence/rareté juste avant le CTA final
  cta: 120,
  form: 125,
  thank_you: 130,
};

function reorderSectionsCanonically(sections?: FunnelSection[]): FunnelSection[] | undefined {
  if (!Array.isArray(sections) || sections.length < 2) return sections;
  // Tri STABLE : on conserve l'ordre relatif d'origine à rang égal (tie-break
  // par index) et un rang neutre (55) pour un type inconnu.
  return sections
    .map((s, i) => ({ s, i, rank: CANONICAL_SECTION_RANK[s.type] ?? 55 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.s);
}

/** Applique l'ordre canonique à la home mono-page ET à chaque page. */
function reorderFunnelSectionsCanonically(funnel: Funnel): void {
  if (Array.isArray(funnel.sections)) {
    funnel.sections = reorderSectionsCanonically(funnel.sections) ?? funnel.sections;
  }
  funnel.pages?.forEach((p) => {
    if (Array.isArray(p.sections)) {
      p.sections = reorderSectionsCanonically(p.sections) ?? p.sections;
    }
  });
}

/**
 * 🆕 Force le CTA de chaque item pricing à rediriger vers le lien de paiement
 * fourni. Couvre la page d'accueil mono-page (`funnel.sections`) ET les pages
 * (`funnel.pages[].sections`).
 */
/**
 * 🆕 Retire les pages redondantes :
 *   - page de rôle "checkout" (Paiement interne) quand l'offre est PAYANTE :
 *     le paiement passe par Stripe (Payment Link/Checkout), pas par une page
 *     interne du tunnel ;
 *   - toute page VIDE (0 section), artefact de génération.
 * Garde toujours au moins la page d'accueil.
 */
function pruneRedundantPages(funnel: Funnel, brief: FunnelBrief): void {
  if (!funnel.pages || funnel.pages.length <= 1) return;
  const paid = !isFreeOffer(brief.price);

  const kept = funnel.pages.filter((page) => {
    const isHome = page.isHome === true;
    if (isHome) return true;
    const role = String(page.role ?? "").toLowerCase();
    const isCheckout = role === "checkout" || role === "paiement";
    if (paid && isCheckout) return false; // paiement externalisé → redondant
    const sectionCount = Array.isArray(page.sections) ? page.sections.length : 0;
    if (sectionCount === 0) return false; // page vide → artefact
    return true;
  });

  // Filet de sécurité : ne jamais tout supprimer.
  funnel.pages = kept.length > 0 ? kept : funnel.pages;
}

/**
 * 🆕 GARANTIE DES PAGES REQUISES.
 *
 * `effectiveBlueprints` est la liste des pages qui DOIVENT figurer dans le
 * tunnel — elle encode déjà toutes les conditions (page de vente webinaire
 * seulement si `postWebinarOffer`, OTO/upsell/downsell seulement si cochés/prix
 * renseignés, page optionnelle seulement si sélectionnée…). Toute page de cette
 * liste, absente OU vide dans le tunnel final, est reconstruite depuis le
 * placeholder enrichi (copy conversion-first du rôle) et ré-insérée à sa
 * position d'origine (ordre du blueprint). On EXCLUT uniquement ce que
 * `pruneRedundantPages` retire volontairement (page « checkout » interne quand
 * l'offre est payante → paiement externalisé). Objectif : aucune page prévue ne
 * peut « disparaître » silencieusement (bug confirmation manquante).
 */
function ensureRequiredBlueprintPages(
  funnel: Funnel,
  effectiveBlueprints: PageBlueprint[],
  brief: FunnelBrief,
  homeRole: PageRole,
): void {
  const pages = funnel.pages;
  if (!pages || pages.length === 0) return;
  const paid = !isFreeOffer(brief.price);
  const isIntentionallyRemoved = (role: PageRole): boolean =>
    paid && role === "checkout"; // seule suppression volontaire de prune

  const order = effectiveBlueprints.map((b) => b.role);
  const hasNonEmptyPage = (role: PageRole): boolean =>
    pages.some(
      (p) =>
        p.role === role &&
        Array.isArray(p.sections) &&
        p.sections.length > 0,
    );

  const missing = effectiveBlueprints.filter(
    (bp) => !isIntentionallyRemoved(bp.role) && !hasNonEmptyPage(bp.role),
  );
  if (missing.length === 0) return;

  for (const bp of missing) {
    const isHome = bp.role === homeRole;
    const rebuilt = buildPlaceholderPage(bp, brief, isHome);
    const existingIdx = pages.findIndex((p) => p.role === bp.role);
    if (existingIdx >= 0) {
      // Page présente mais vide → on la re-remplit sur place.
      pages[existingIdx] = {
        ...pages[existingIdx],
        sections: rebuilt.sections,
      };
    } else {
      // Page absente → insertion à la bonne position selon l'ordre du blueprint.
      const targetOrder = order.indexOf(bp.role);
      let insertAt = pages.length;
      for (let i = 0; i < pages.length; i++) {
        const ord = order.indexOf(pages[i].role);
        if (ord !== -1 && ord > targetOrder) {
          insertAt = i;
          break;
        }
      }
      pages.splice(insertAt, 0, rebuilt);
    }
  }

  // Ré-insertion → on reconstruit la navigation (nextPageId + CTA « suivant »).
  funnel.pages = chainPagesNavigation(pages);
  console.warn(
    `[ensure-required-pages] Page(s) requise(s) reconstruite(s) : ${missing
      .map((b) => b.role)
      .join(", ")}.`,
  );
}

/**
 * 🆕 Régénère le COPY d'UNE seule page (toutes ses sections), sans toucher au
 * reste du tunnel. Réutilise EXACTEMENT le moteur des pages secondaires
 * (secondaryPagesPrompt + secondaryPagesSchema + parseSectionsArray + callAI),
 * donc respecte le provider IA configuré (OpenAI / Z.AI / OpenRouter /
 * Anthropic). Une INSTRUCTION libre optionnelle pilote le style (« ton plus
 * direct », « copy plus percutant »…). En cas d'échec IA → sections du
 * placeholder enrichi du rôle (fallback:true) plutôt qu'une page cassée.
 */
export async function regeneratePageSections(args: {
  brief: FunnelBrief;
  kind: FunnelKind;
  role: PageRole;
  slug?: string;
  name?: string;
  instruction?: string;
  homeContext?: { headline?: string; primaryCtaLabel?: string };
}): Promise<{ sections: FunnelSection[]; fallback: boolean }> {
  const { brief, instruction } = args;
  const normalizedKind = normalizeFunnelKind(args.kind) ?? "lead-magnet";
  const blueprint = getPageBlueprint(normalizedKind, args.role);
  const fallbackCta: CtaConfig = brief.primaryCta ?? {
    label: canonicalCtaLabel(normalizedKind, brief.language),
    mode: "anchor",
    anchorId: "lead-form",
    target: "_self",
  };

  const placeholderSections = (): FunnelSection[] =>
    blueprint ? buildPlaceholderPage(blueprint, brief, false).sections : [];

  const slug = args.slug ?? blueprint?.slug ?? String(args.role);
  const name = args.name ?? blueprint?.name ?? String(args.role);

  // Clé IA absente pour le provider courant → fallback direct (pas de crash).
  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const hasKey =
    provider === "anthropic" || provider === "claude"
      ? !!process.env.ANTHROPIC_API_KEY
      : !!process.env.OPENAI_API_KEY;
  if (!hasKey) return { sections: placeholderSections(), fallback: true };

  const coherence =
    `\n\nCOHÉRENCE : marque "${brief.brandName}", offre "${brief.offerName}".` +
    (args.homeContext?.headline
      ? ` Titre de la page principale : "${args.homeContext.headline}".`
      : "") +
    (args.homeContext?.primaryCtaLabel
      ? ` CTA principal du tunnel : "${args.homeContext.primaryCtaLabel}".`
      : "") +
    ` Cette page joue son rôle "${args.role}" et ne répète PAS les sections de la page principale.`;
  const instr =
    instruction && instruction.trim()
      ? `\n\nINSTRUCTION UTILISATEUR (à respecter en PRIORITÉ pour le style et le copy) : ${instruction.trim()}\n`
      : "";

  try {
    const promptText =
      secondaryPagesPrompt({
        brand: brief.brandName,
        offer: brief.offerName,
        funnelKind: normalizedKind,
        language: brief.language,
        pages: [{ role: args.role, slug, name }],
        videoUrl: brief.videoUrl,
        brief,
      }) +
      buildCtaInstruction(brief.language, brief) +
      copyDirectives(brief.language) +
      coherence +
      instr;

    const rawText = await callAI({
      systemMessage: SYSTEM_MESSAGE_FUNNEL,
      userPrompt: promptText,
      maxTokens: 3000,
    });

    const parsed = secondaryPagesSchema.safeParse(
      normalizeSecondaryPagesRawJson(JSON.parse(extractJsonPayload(rawText))),
    );
    if (!parsed.success) return { sections: placeholderSections(), fallback: true };

    const page =
      parsed.data.pages.find((p) => (p.role as PageRole) === args.role) ??
      parsed.data.pages[0];
    if (!page) return { sections: placeholderSections(), fallback: true };

    let sections = parseSectionsArray(page.sections, fallbackCta, brief);
    if (blueprint) {
      const filtered = filterSectionsByBlueprint(sections, blueprint);
      if (filtered.length > 0) sections = filtered;
    }
    if (sections.length === 0) return { sections: placeholderSections(), fallback: true };
    return { sections, fallback: false };
  } catch (e) {
    console.error("[regeneratePageSections] échec:", e);
    return { sections: placeholderSections(), fallback: true };
  }
}

function applyPaymentUrlToPricingCtas(funnel: Funnel, url: string): void {
  const patchSections = (sections?: Funnel["sections"]) => {
    sections?.forEach((sec) => {
      if (sec.type !== "offer" && sec.type !== "pricing") return;
      sec.items?.forEach((it) => {
        if (it.kind !== "pricing") return;
        const label =
          (it.data?.cta?.label as string | undefined) ?? "Commander maintenant";
        it.data.cta = {
          label,
          mode: "redirect",
          url,
          target: "_blank",
        };
      });
    });
  };
  patchSections(funnel.sections);
  funnel.pages?.forEach((p) => patchSections(p.sections));
}

/**
 * 🆕 Stripe Connect — pose le CHECKOUT INTERNE sur les boutons d'offre/pricing :
 * un CTA d'ancre `#ff-checkout`, intercepté par PublicFunnelRuntime → POST
 * /api/checkout → session Stripe sur le compte connecté du créateur. Aucun lien
 * de paiement manuel à créer : le bouton « achète » directement.
 */
function pageHasPaidOffer(sections?: Funnel["sections"]): boolean {
  if (!sections) return false;
  for (const sec of sections) {
    if (sec.type !== "offer" && sec.type !== "pricing") continue;
    for (const it of sec.items ?? []) {
      if (it.kind === "pricing" && !isFreeOffer(it.data?.price)) return true;
    }
  }
  return false;
}

/** 🆕 Vrai si AU MOINS UNE page du tunnel porte une offre payante — même si
 *  l'offre principale est gratuite (lead magnet + tripwire, webinaire + offre
 *  post-live, challenge + pitch final…). */
function funnelHasPaidOffer(funnel: Funnel): boolean {
  if (pageHasPaidOffer(funnel.sections)) return true;
  return (funnel.pages ?? []).some((p) => pageHasPaidOffer(p.sections));
}

function applyInternalCheckoutCtas(funnel: Funnel): void {
  // 1) Boutons des cards pricing/offer → #ff-checkout (sur toutes les pages).
  const patchOfferItems = (sections?: Funnel["sections"]) => {
    sections?.forEach((sec) => {
      if (sec.type !== "offer" && sec.type !== "pricing") return;
      sec.items?.forEach((it) => {
        if (it.kind !== "pricing") return;
        const label =
          (it.data?.cta?.label as string | undefined) ?? "Commander maintenant";
        it.data.cta = makeAnchorCta(label, "ff-checkout");
      });
    });
  };
  patchOfferItems(funnel.sections);
  funnel.pages?.forEach((p) => patchOfferItems(p.sections));

  // (suite ci-dessous)
  // 2) 🆕 Sur la page de VENTE (accueil/sales) avec offre payante : TOUS les CTA
  //    de section pointent aussi vers le checkout (le visiteur achète depuis
  //    n'importe quel bouton). On épargne les formulaires et les popups (capture
  //    de lead) qui ont un rôle distinct.
  const retargetSectionCtas = (sections?: Funnel["sections"]) => {
    sections?.forEach((sec) => {
      if (sec.type === "form") return;
      if (!sec.cta) return;
      if (sec.cta.mode === "popup") return;
      sec.cta = makeAnchorCta(sec.cta.label, "ff-checkout");
    });
  };
  if (pageHasPaidOffer(funnel.sections)) retargetSectionCtas(funnel.sections);
  // 🆕 Les pages d'OFFRE SECONDAIRE (tripwire/OTO, upsell, downsell) vendent
  // elles aussi : sans elles dans cette liste, leurs boutons de section
  // restaient branchés ailleurs que sur le checkout.
  const CHECKOUT_PAGE_ROLES: PageRole[] = ["sales", "oto", "upsell", "downsell"];
  funnel.pages?.forEach((p) => {
    if ((p.isHome || CHECKOUT_PAGE_ROLES.includes(p.role)) && pageHasPaidOffer(p.sections)) {
      retargetSectionCtas(p.sections);
    }
  });
}

/**
 * 🆕 Pages OTO (upsell/downsell) : ajoute un lien discret « Non merci » qui
 * DÉCLINE l'offre additionnelle et passe à l'étape suivante du tunnel. Le CTA
 * principal d'achat reste #ff-checkout (posé par applyInternalCheckoutCtas).
 * Le lien cible la page suivante via `pageId` (résolu en URL publique par les
 * renderers preview ET export).
 */
/**
 * 🆕 Applique les prix OTO saisis par l'utilisateur aux items pricing des pages
 * upsell/downsell — l'IA ne fixe plus le montant au hasard. N'agit que pour les
 * rôles dont un prix a été fourni.
 */
/**
 * 🆕 Force le prix du wizard (brief.price) sur les items pricing de la PAGE DE
 * VENTE (accueil/sales). L'IA met parfois « Sur devis » / un prix inventé, ce
 * qui casse le checkout (montant non payable). Le prix saisi par l'utilisateur
 * fait foi. N'agit pas si l'offre est gratuite.
 */
/**
 * 🆕 Écrit un prix (et éventuellement un prix d'ancrage barré) sur tous les
 * items pricing d'un jeu de sections.
 *
 * Brique unique partagée par l'offre principale ET les offres secondaires
 * (post-webinaire, clôture de challenge). Avant, chaque cas avait sa propre
 * boucle : le challenge a simplement été OUBLIÉ, et le prix saisi au wizard
 * n'atteignait jamais la page — c'est le prix inventé par l'IA qui subsistait.
 *
 * `anchorPrice` est purement cosmétique : il alimente `originalPrice`, jamais
 * `price`. Le montant encaissé reste celui résolu au checkout.
 */
function writePricingOn(
  sections: Funnel["sections"] | undefined,
  price: string,
  anchorPrice?: string,
): void {
  sections?.forEach((sec) => {
    if (sec.type !== "offer" && sec.type !== "pricing") return;
    sec.items?.forEach((it) => {
      if (it.kind !== "pricing") return;
      it.data.price = price;
      // Un ancrage vide EFFACE l'éventuel `originalPrice` inventé par l'IA :
      // laisser un prix barré que l'utilisateur n'a pas demandé serait une
      // affirmation commerciale fabriquée en son nom.
      const anchor = (anchorPrice ?? "").trim();
      if (anchor) it.data.originalPrice = anchor;
      else delete it.data.originalPrice;
    });
  });
}

function applyMainOfferPrice(funnel: Funnel, brief: FunnelBrief): void {
  if (isFreeOffer(brief.price)) return;
  const price = (brief.price ?? "").trim();
  if (!price) return;
  writePricingOn(funnel.sections, price, brief.anchorPrice);
  const homePage = funnel.pages?.find((p) => p.isHome);
  if (homePage && homePage.sections !== funnel.sections) {
    writePricingOn(homePage.sections, price, brief.anchorPrice);
  }
  // Les pages OTO sont gérées par applyOtoPrices (prix dédiés) → on ne touche
  // QUE l'accueil ici pour ne pas écraser un prix upsell/downsell.
}

/**
 * 🆕 N1 — Prix de l'offre SECONDAIRE, posé sur la page "sales".
 *
 * Couvre DEUX types de tunnel avec la même logique, via `secondaryOfferOf` :
 *   • webinaire/masterclass → offre vendue APRÈS la session ;
 *   • challenge → offre vendue à la CLÔTURE.
 *
 * Dans les deux cas, la page "sales" n'est PAS la page d'accueil (la home est
 * l'inscription), donc `applyMainOfferPrice` ne l'atteint jamais et son prix
 * resterait celui inventé par l'IA.
 *
 * Remplace l'ancien `applyWebinarSalesOffer`, qui sortait immédiatement dès que
 * le type n'était pas « webinar ». Une fonction jumelle pour le challenge aurait
 * divergé au premier correctif — c'est exactement ce qui s'était produit.
 */
function applySecondaryOfferPrice(funnel: Funnel, brief: FunnelBrief): void {
  const offer = secondaryOfferOf(brief);
  if (!offer) return;
  const price = offer.price.trim();
  if (!price || isFreeOffer(price)) return;
  const salesPage = funnel.pages?.find((p) => p.role === "sales");
  if (!salesPage) return;
  writePricingOn(salesPage.sections, price, offer.anchorPrice);
}

/**
 * 🆕 Offre SECONDAIRE du tunnel (celle vendue sur la page "sales" quand la page
 * d'accueil n'est pas une page de vente), ou null.
 *
 * Source de vérité UNIQUE pour : l'injection du prix, la porte « offre payante »
 * et le prix d'ancrage. Toute nouvelle règle sur ces offres doit passer par ici,
 * sinon on recrée l'asymétrie webinaire/challenge qu'on vient de corriger.
 */
function secondaryOfferOf(
  brief: FunnelBrief,
): { price: string; anchorPrice?: string } | null {
  const kind = normalizeFunnelKind(brief.funnelKind);
  if (kind === "webinar") {
    return {
      price: brief.postWebinarPrice ?? brief.price ?? "",
      anchorPrice: brief.postWebinarAnchorPrice,
    };
  }
  if (kind === "challenge") {
    return {
      // Pas de repli sur `brief.price` : pour un challenge, ce champ décrit le
      // CHALLENGE (souvent gratuit), pas l'offre de clôture. Le repli aurait
      // posé « Gratuit » sur une page de vente.
      price: brief.challengeOfferPrice ?? "",
      anchorPrice: brief.challengeOfferAnchorPrice,
    };
  }
  return null;
}

function applyOtoPrices(funnel: Funnel, brief: FunnelBrief): void {
  const map: Partial<Record<PageRole, string>> = {};
  if (brief.upsellPrice && brief.upsellPrice.trim())
    map.upsell = brief.upsellPrice.trim();
  if (brief.downsellPrice && brief.downsellPrice.trim())
    map.downsell = brief.downsellPrice.trim();
  // 🆕 Page OTO/tripwire générique (rôle "oto") : même mécanisme — le prix
  // saisi par l'utilisateur fait foi, sinon l'IA en invente un.
  if (brief.otoPrice && brief.otoPrice.trim())
    map.oto = brief.otoPrice.trim();
  if (Object.keys(map).length === 0) return;
  funnel.pages?.forEach((page) => {
    const price = map[page.role];
    if (!price) return;
    page.sections?.forEach((sec) => {
      if (sec.type !== "offer" && sec.type !== "pricing") return;
      sec.items?.forEach((it) => {
        if (it.kind === "pricing") it.data.price = price;
      });
    });
  });
}

/**
 * 🆕 LOT 10 — Applique l'order bump saisi au wizard (nom + prix + description)
 * sur la page "checkout" du funnel généré. Vide (nom ou prix manquant) → pas
 * d'order bump (comportement par défaut, rétro-compatible).
 */
function applyOrderBumpConfig(funnel: Funnel, brief: FunnelBrief): void {
  const name = (brief.orderBumpName ?? "").trim();
  const price = (brief.orderBumpPrice ?? "").trim();
  if (!name || !price) return;
  const checkoutPage = funnel.pages?.find((p) => p.role === "checkout");
  if (!checkoutPage) return;
  checkoutPage.orderBump = {
    enabled: true,
    name,
    price,
    description: (brief.orderBumpDescription ?? "").trim() || undefined,
  };
}

/**
 * 🆕 LOT 9 — Duplique la page-template "challenge-day" (générée UNE fois par
 * l'IA) en autant de pages "jour 1..N" que `brief.challengeDays` l'indique
 * (défaut 5). Chaque clone reçoit un slug/nom/dayIndex propre et son
 * eyebrow/titre "Jour 1" est relabellisé "Jour N". Rechaîne la séquence
 * Jour 1 → Jour 2 → … → Jour N → (page suivante d'origine, ex. le pitch
 * final). N'ajoute rien si le blueprint n'a pas de page "challenge-day"
 * (funnels non-challenge, comportement inchangé).
 */
function applyChallengeMultiDay(funnel: Funnel, brief: FunnelBrief): void {
  if (!funnel.pages) return;
  const dayIdx = funnel.pages.findIndex((p) => p.role === "challenge-day");
  if (dayIdx === -1) return;

  // Borne et défaut partagés (lib/funnels/challenge.ts) : le prompt annonce
  // EXACTEMENT cette durée dans le copywriting. Deux littéraux divergents ici
  // et là-bas faisaient mentir la landing sur le nombre de jours réel.
  const totalDays = resolveChallengeDays(brief.challengeDays);
  const templatePage = funnel.pages[dayIdx];

  // 🆕 N3-a — Titre propre à chaque jour, saisi au wizard.
  //
  // Sans lui, les jours 2..N sont des copies conformes : `relabelDay` ne
  // réécrit que si le texte contient littéralement « Jour 1 », donc un
  // challenge de 5 jours pouvait livrer 5 pages rigoureusement identiques.
  // Le titre saisi remplace le headline du hero — le corps reste cloné, ce qui
  // est assumé (la génération différenciée par jour coûterait N appels IA).
  const dayTitles = Array.isArray(brief.challengeDayTitles)
    ? brief.challengeDayTitles
    : [];
  const applyDayTitle = (page: FunnelPage, day: number): void => {
    const title = (dayTitles[day - 1] ?? "").trim();
    if (!title) return; // non renseigné → on garde le titre généré
    const hero = page.sections?.find((s) => s.type === "hero") ?? page.sections?.[0];
    if (hero) hero.headline = title;
  };

  const dayNumberPattern = /\b(Jour|Day|Día)\s*1\b/gi;
  const relabelDay = (text: string | undefined, day: number): string | undefined => {
    if (!text) return text;
    dayNumberPattern.lastIndex = 0;
    if (!dayNumberPattern.test(text)) return text;
    dayNumberPattern.lastIndex = 0;
    return text.replace(dayNumberPattern, (_m, word: string) => `${word} ${day}`);
  };

  templatePage.dayIndex = 1;
  templatePage.dayTotal = totalDays;
  templatePage.name = `Jour 1 sur ${totalDays}`;
  applyDayTitle(templatePage, 1);

  if (totalDays <= 1) return;

  const tailNextPageId = templatePage.nextPageId;
  const newDayPages: FunnelPage[] = [];
  for (let day = 2; day <= totalDays; day++) {
    const cloned: FunnelPage = structuredClone(templatePage);
    cloned.id = makePageId();
    cloned.slug = `jour-${day}`;
    cloned.name = `Jour ${day} sur ${totalDays}`;
    cloned.isHome = false;
    cloned.dayIndex = day;
    cloned.dayTotal = totalDays;
    cloned.nextPageId = undefined;
    cloned.sections = (cloned.sections ?? []).map((sec) => ({
      ...sec,
      id: `section-${makePageId()}`,
      eyebrow: relabelDay(sec.eyebrow, day),
      headline: relabelDay(sec.headline, day) ?? sec.headline,
      subheadline: relabelDay(sec.subheadline, day),
    }));
    // Titre du jour APRÈS le clonage des sections, sinon `relabelDay`
    // réécrirait le titre que l'utilisateur vient de poser.
    applyDayTitle(cloned, day);
    newDayPages.push(cloned);
  }

  // Insertion des clones juste après la page "Jour 1" d'origine.
  funnel.pages.splice(dayIdx + 1, 0, ...newDayPages);

  // Re-chaînage Jour 1 → Jour 2 → … → Jour N → cible d'origine (le pitch final).
  const allDayPages = [templatePage, ...newDayPages];
  for (let i = 0; i < allDayPages.length; i++) {
    allDayPages[i].nextPageId =
      i < allDayPages.length - 1 ? allDayPages[i + 1].id : tailNextPageId;
  }
}

/**
 * 🆕 R3 — Bloc « Diffusion par email » sur la page de confirmation d'un challenge.
 *
 * POURQUOI. Les pages « Jour N » ne sont pas listées et il n'existe aucun espace
 * membre : le participant reçoit son lien du jour PAR EMAIL, envoyé depuis
 * l'outil du créateur. Sans cette explication, il attend un accès qui ne
 * viendra jamais et écrit au support — ou abandonne.
 *
 * Idempotent : si une section explicative existe déjà (même identifiant), on ne
 * duplique pas. N'agit que pour le kind « challenge ».
 */
function applyChallengeEmailDeliveryNotice(funnel: Funnel, brief: FunnelBrief): void {
  if (normalizeFunnelKind(brief.funnelKind) !== "challenge") return;
  const confirmation = funnel.pages?.find((p) => p.role === "confirmation");
  if (!confirmation) return;

  const SECTION_ID = "challenge-email-delivery";
  if (confirmation.sections?.some((s) => s.id === SECTION_ID)) return;

  const days = resolveChallengeDays(brief.challengeDays);
  const lang = brief.language;

  const copy = {
    fr: {
      eyebrow: "Comment ça se passe",
      headline: "Ton lien du jour arrive par email",
      subheadline: `Chaque jour pendant ${days} jours, tu reçois un email avec le lien de ta séance. Pas d'espace à créer, pas de mot de passe à retenir.`,
      bullets: [
        "Vérifie ta boîte de réception dès demain matin",
        "Ajoute notre adresse à tes contacts pour ne rien manquer",
        "Regarde aussi dans les spams et l'onglet Promotions",
      ],
    },
    en: {
      eyebrow: "How it works",
      headline: "Your daily link arrives by email",
      subheadline: `Every day for ${days} days, you get an email with your session link. No account to create, no password to remember.`,
      bullets: [
        "Check your inbox tomorrow morning",
        "Add our address to your contacts so nothing gets lost",
        "Also check spam and the Promotions tab",
      ],
    },
    es: {
      eyebrow: "Cómo funciona",
      headline: "Tu enlace diario llega por email",
      subheadline: `Cada día durante ${days} días recibes un email con el enlace de tu sesión. Sin cuenta que crear, sin contraseña que recordar.`,
      bullets: [
        "Revisa tu bandeja de entrada mañana por la mañana",
        "Añade nuestra dirección a tus contactos para no perder nada",
        "Mira también en spam y en la pestaña Promociones",
      ],
    },
  }[lang];

  const notice: FunnelSection = {
    id: SECTION_ID,
    type: "process",
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    subheadline: copy.subheadline,
    bullets: copy.bullets,
    visible: true,
  };

  // Inséré en 2e position : juste après le hero de remerciement, avant les
  // rappels de programme. C'est l'information la plus utile à cet instant.
  confirmation.sections = confirmation.sections ?? [];
  confirmation.sections.splice(1, 0, notice);
}

/**
 * 🆕 LOT 7 — Pose l'URL d'embed calendrier (Calendly/Cal.com) saisie au wizard
 * sur la page "booking" (prise de RDV). Vide → rien (le formulaire de contact
 * classique reste le seul mécanisme de prise de RDV, comportement historique).
 */
function applyBookingCalendarEmbed(funnel: Funnel, brief: FunnelBrief): void {
  const url = (brief.calendarEmbedUrl ?? "").trim();
  if (!url) return;
  const bookingPage = funnel.pages?.find((p) => p.role === "booking");
  if (!bookingPage) return;
  bookingPage.calendarEmbedUrl = url;
}

/** 🆕 Renvoie le libellé de prix payant de la page d'accueil/sales (item
 * highlighted en priorité), ou null. */
function findHomePriceLabel(funnel: Funnel): string | null {
  const collect = (sections?: Funnel["sections"]): string | null => {
    if (!sections) return null;
    let firstPaid: string | null = null;
    for (const sec of sections) {
      if (sec.type !== "offer" && sec.type !== "pricing") continue;
      for (const it of sec.items ?? []) {
        if (it.kind !== "pricing" || isFreeOffer(it.data?.price)) continue;
        const p = (it.data.price ?? "").trim();
        if (!p) continue;
        if (it.data.highlighted) return p;
        if (!firstPaid) firstPaid = p;
      }
    }
    return firstPaid;
  };
  const homePage = funnel.pages?.find((p) => p.isHome);
  return collect(funnel.sections) ?? collect(homePage?.sections);
}

/** 🆕 Ajoute le prix au libellé du CTA FINAL de la page de vente (ex.
 * « Je commande maintenant — 97€ »), pour lever la dernière objection. */
function appendPriceToFinalCta(funnel: Funnel): void {
  const price = findHomePriceLabel(funnel);
  if (!price) return;
  const homePage = funnel.pages?.find((p) => p.isHome);
  const sections = (homePage?.sections ?? funnel.sections) ?? [];
  let target: FunnelSection | undefined;
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].type === "cta" && sections[i].cta?.label) {
      target = sections[i];
      break;
    }
  }
  if (!target) {
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].cta?.label) {
        target = sections[i];
        break;
      }
    }
  }
  if (!target?.cta?.label) return;
  if (target.cta.label.includes(price)) return;
  target.cta.label = `${target.cta.label} — ${price}`;
}

function applyUpsellDeclineLinks(funnel: Funnel, language: Language): void {
  const pages = funnel.pages ?? [];
  const label =
    language === "en"
      ? "No thanks, continue"
      : language === "es"
        ? "No gracias, continuar"
        : "Non merci, continuer";
  pages.forEach((page, idx) => {
    if (page.role !== "upsell" && page.role !== "downsell") return;
    if (!Array.isArray(page.sections) || page.sections.length === 0) return;
    // Cible du refus : nextPageId si défini, sinon page suivante dans l'ordre.
    let nextId = page.nextPageId;
    if (!nextId && idx < pages.length - 1) nextId = pages[idx + 1].id;
    if (!nextId) return; // dernière page → pas d'étape suivante, pas de lien.
    // On pose le lien sur la section offre/pricing (sinon la dernière section).
    const offer = page.sections.find(
      (s) => s.type === "offer" || s.type === "pricing",
    );
    const host = offer ?? page.sections[page.sections.length - 1];
    host.secondaryCta = {
      mode: "redirect",
      label,
      pageId: nextId,
      target: "_self",
    };
  });
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
  const ctaInstruction = buildCtaInstruction(brief.language, brief);
  const finalPrompt = basePrompt + templateInstruction + ctaInstruction;

  const rawText = await callAI({
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

  // ===== ÉTAPE 1 : Application du template =====
  const styledFunnel = applyTemplateToFunnel(template, aiFunnel, brief);

  // ===== ÉTAPE 2 : Enrichissement riche =====
  const enrichedSections = enrichSectionsWithDefaults(styledFunnel.sections, brief);

  // ===== ÉTAPE 3 : Pipeline médias =====
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

  let finalFunnel: Funnel = {
    ...styledFunnel,
    pages: [fakeHomePage],
    sections: fakeHomePage.sections,
    media: styledFunnel.media ?? aiFunnel.media,
    header: styledFunnel.header ?? deterministicHeader,
    meta: {
      ...(styledFunnel.meta ?? {}),
      templateId: template.id,
    },
  };

  // ===== ÉTAPE 5 : Harmonisation des CTA =====
  finalFunnel = harmonizeCTAsByFunnelKind(finalFunnel, brief);

  return finalFunnel;
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
      // 🆕 Rattachement au moteur de RDV natif : lu par harmonizeCTAsByFunnelKind
      // (étape 11) pour pointer les CTA vers /rdv/{slug}. Absent = comportement
      // historique.
      bookingSlug: brief.bookingSlug,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 ÉTAPE 4 — Génération de séquence email par IA.
// Service pur : prend l'input (type, contexte, nb d'emails, langue, contexte
// tunnel) et retourne des brouillons d'emails. Réutilise l'abstraction `callAI`
// (OPENAI_MODEL / AI_PROVIDER, jamais en dur). Pas d'accès base ici : la lecture
// du tunnel se fait dans la route API.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_MESSAGE_SEQUENCE =
  "You are an expert direct-response email copywriter. " +
  "You MUST respond with a single JSON object { \"emails\": [...] } that strictly matches the requested schema. " +
  "Do not wrap the JSON in markdown code fences. Do not add any prose before or after the JSON. " +
  "Write all copy in the requested language and tone. Never invent figures, results or promises that were not provided.";

const sequenceEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  delayDays: z.coerce.number().int().min(0).max(365).optional(),
});
const sequenceResponseSchema = z.object({
  emails: z.array(sequenceEmailSchema).min(1),
});

export async function generateEmailSequenceWithAI(
  input: SequenceGenerationInput,
): Promise<SequenceEmailDraft[]> {
  const userPrompt = sequenceGenerationPrompt(input);

  const raw = await callAI({
    systemMessage: SYSTEM_MESSAGE_SEQUENCE,
    userPrompt,
    maxTokens: 6000,
  });

  // Parsing tolérant : on isole l'objet JSON même si le modèle a ajouté du texte.
  let parsedJson: unknown;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    parsedJson = JSON.parse(slice);
  } catch (e) {
    throw new AiGenerationError(
      "invalid-json",
      "L'IA a renvoyé une réponse illisible. Réessayez la génération.",
      e instanceof Error ? e.message : String(e),
    );
  }

  const result = sequenceResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new AiGenerationError(
      "schema-mismatch",
      "La séquence générée est mal structurée. Réessayez la génération.",
      JSON.stringify(result.error.flatten().fieldErrors),
    );
  }

  // Normalisation : position 0-based, 1er email à J+0, délais croissants.
  return result.data.emails.map((e, idx) => ({
    position: idx,
    delayDays: idx === 0 ? 0 : typeof e.delayDays === "number" ? e.delayDays : idx * 2,
    subject: e.subject.trim(),
    body: e.body.trim(),
  }));
}
