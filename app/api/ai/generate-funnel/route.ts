// app/api/ai/generate-funnel/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z, type ZodIssue } from "zod";
import {
  generateMultiPageFunnelWithAI,
  AiGenerationError,
} from "@/lib/ai/generate";
import type { FunnelSectionType } from "@/lib/funnels/types";
import { guardApiAccess, quotaExceededResponse } from "@/lib/billing/apiGuard";
import { canCreateFunnel } from "@/lib/billing/subscription";
import { consumeQuota } from "@/lib/billing/usage";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ensureBookingEventType } from "@/lib/booking/autoProvision";
import { usesNativeBookingEngine } from "@/lib/booking/mode";
// 🆕 Bornes de durée du challenge — source unique, partagée avec le wizard et
// le générateur. La route REJETTE hors bornes ; le générateur clampe en
// ceinture. Voir lib/funnels/challenge.ts.
import { MAX_CHALLENGE_DAYS, MIN_CHALLENGE_DAYS } from "@/lib/funnels/challenge";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 secondes pour la génération multi-pages

const ctaConfigSchema = z.object({
  label: z.string().min(1),
  mode: z.enum(["redirect", "anchor", "popup"]),
  url: z.string().optional(),
  target: z.enum(["_self", "_blank"]).optional(),
  anchorId: z.string().optional(),
  popupId: z.string().optional(),
  popupProvider: z.enum(["internal", "systeme"]).optional(),
  systemePopupId: z.string().optional(),
});

const copywritingPrefsSchema = z.object({
  tone: z.enum(["direct", "empathique", "storytelling", "expert", "amical", "premium"]).optional(),
  length: z.enum(["concise", "balanced", "detailed"]).optional(),
  exampleSentence: z.string().optional(),
  avoidWords: z.array(z.string()).optional(),
});

// ⚠️ Doit refléter EXACTEMENT le type FunnelSectionType de lib/funnels/types.ts
// "footer" retiré car non défini dans le type.
const FUNNEL_SECTION_TYPES = [
  "hero",
  "about",
  "problem",
  "solution",
  "benefits",
  "proof",
  "testimonials",
  "offer",
  "bonus",
  "guarantee",
  "pricing",
  "process",
  "program",
  "video",
  "faq",
  "cta",
  "form",
  "thank_you",
  "webinar",
  "qualification",
] as const satisfies readonly FunnelSectionType[];

const mediaItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "video"]),
  url: z.string(),
  description: z.string().optional(),
  sectionHint: z.enum(FUNNEL_SECTION_TYPES).optional(),
  alt: z.string().optional(),
  fileName: z.string().optional(),
});

const briefSchema = z.object({
  // 🆕 Marque OPTIONNELLE : si vide, on retombe sur le nom de l'offre (cf. plus
  // bas). Ne doit jamais bloquer la génération.
  brandName: z.string().optional(),
  offerName: z.string().min(1),
  price: z.string().min(1),
  // 🆕 Prix d'ancrage (barré) de l'offre PRINCIPALE. ⚠️ Absent du schéma
  // jusqu'ici → zod le retirait SILENCIEUSEMENT du brief (même piège que
  // brandColors/authorName, cf. commentaires plus bas) : le champ « Prix barré »
  // du wizard n'a donc JAMAIS eu d'effet. Lu par applyMainOfferPrice
  // (lib/ai/generate.ts, writePricingOn → PricingPlanItem.originalPrice).
  anchorPrice: z.string().max(40).optional(),
  // 🆕 Offres OTO optionnelles (upsell/downsell) fixées par l'utilisateur.
  upsellPrice: z.string().max(40).optional(),
  downsellPrice: z.string().max(40).optional(),
  upsellOffer: z.string().max(300).optional(),
  downsellOffer: z.string().max(300).optional(),
  // 🆕 LOT 10 — Order bump (produit complémentaire, page de checkout).
  orderBumpName: z.string().max(200).optional(),
  orderBumpPrice: z.string().max(40).optional(),
  orderBumpDescription: z.string().max(300).optional(),
  // 🆕 LOT 7 — Embed d'un calendrier EXTERNE (Calendly / Cal.com).
  calendarEmbedUrl: z.string().max(500).optional(),
  // 🆕 Slug du type de RDV du moteur NATIF. Généralement absent de la requête
  // (provisionné côté serveur), mais accepté pour rattacher un tunnel à un
  // type de RDV existant. Sans cette entrée, zod le retirerait silencieusement
  // du brief avant qu'il n'atteigne le générateur — même piège que brandColors.
  bookingSlug: z.string().max(60).optional(),
  // 🆕 B3 — Mode de réservation. "external" ⇒ aucun appel au moteur natif.
  bookingMode: z.enum(["native", "external"]).optional(),
  // 🆕 B4 — Générer la page de confirmation du tunnel (défaut : true).
  bookingConfirmationPage: z.boolean().optional(),
  // 🆕 LOT 9 — Nombre de jours du challenge (génère jour-1..jour-N).
  // ⚠️ La borne haute était `30` alors que le wizard et le générateur
  // plafonnent à 14 : une requête à 20 jours passait la validation puis était
  // tronquée EN SILENCE. Elle est désormais rejetée franchement.
  challengeDays: z
    .number()
    .int()
    .min(MIN_CHALLENGE_DAYS)
    .max(MAX_CHALLENGE_DAYS)
    .optional(),
  // 🆕 N3-a — Titres des jours du challenge (index 0 = Jour 1). ⚠️ Absents du
  // schéma jusqu'ici → zod les retirait SILENCIEUSEMENT : applyChallengeMultiDay
  // recevait toujours `undefined`, applyDayTitle sortait immédiatement, et les
  // jours 2..N restaient des clones stricts du Jour 1. C'est LE défaut qui
  // rendait le challenge multi-jours inutilisable.
  // Longueur bornée à MAX_CHALLENGE_DAYS : le wizard tronque déjà le tableau à
  // la durée choisie, un dépassement signale un bug client qu'il vaut mieux
  // voir échouer que subir.
  challengeDayTitles: z
    .array(z.string().max(200))
    .max(MAX_CHALLENGE_DAYS)
    .optional(),
  // 🆕 Offre de la page OTO/tripwire générique ("oto"), cochable sur tous les
  // types de tunnel. Voir commentaire FunnelBrief (lib/funnels/types.ts).
  otoOfferName: z.string().max(200).optional(),
  otoPrice: z.string().max(40).optional(),
  otoPromise: z.string().max(300).optional(),
  // 🆕 LOT 4/5 — Webinaire : date+heure, urgence, lien externe, expiration
  // replay, mode Live/Evergreen. ⚠️ Absents du schéma jusqu'ici → zod les
  // retirait SILENCIEUSEMENT du brief avant qu'il n'atteigne
  // generateMultiPageFunnelWithAI (même piège que brandColors, cf. commentaire
  // plus bas) : le countdown webinaire n'était donc JAMAIS appliqué en
  // pratique. Corrigé ici.
  webinarDate: z.string().max(60).optional(),
  webinarUrgency: z.string().max(300).optional(),
  webinarExternalLink: z.string().max(500).optional(),
  replayExpiryHours: z.number().int().min(1).max(720).optional(),
  webinarMode: z.enum(["live", "evergreen"]).optional(),
  evergreenVideoUrl: z.string().max(500).optional(),
  evergreenOfferHours: z.number().int().min(1).max(720).optional(),
  // 🆕 Webinaire — offre vendue APRÈS le webinaire (distincte de offerName/
  // price/promise, qui désignent le webinaire lui-même pour ce kind). Voir
  // commentaire FunnelBrief (lib/funnels/types.ts).
  postWebinarOfferName: z.string().max(200).optional(),
  postWebinarPrice: z.string().max(40).optional(),
  postWebinarPromise: z.string().max(300).optional(),
  // 🆕 Prix barré de l'offre post-webinaire. Même piège que `anchorPrice`
  // ci-dessus : exposé par le wizard, absent du schéma, donc jamais reçu.
  // Lu par secondaryOfferOf → applySecondaryOfferPrice (lib/ai/generate.ts).
  postWebinarAnchorPrice: z.string().max(40).optional(),
  // 🆕 Challenge — offre vendue à la CLÔTURE du challenge (pitch final).
  // Symétrique des champs post-webinaire ci-dessus : sans `challengeOfferName`,
  // la page « Pitch final » n'est pas générée.
  challengeOfferName: z.string().max(200).optional(),
  challengeOfferPrice: z.string().max(40).optional(),
  challengeOfferPromise: z.string().max(300).optional(),
  // 🆕 Prix barré de l'offre de clôture. Même piège que les deux `anchorPrice`
  // ci-dessus : lu par secondaryOfferOf (lib/ai/generate.ts) et exposé par le
  // wizard, mais supprimé par ce schéma jusqu'ici.
  challengeOfferAnchorPrice: z.string().max(40).optional(),
  targetAudience: z.string().min(1),
  mainPain: z.string().min(1),
  promise: z.string().min(1),
  tone: z.string().min(1),
  funnelType: z.string().min(1),
  designStyle: z.string().min(1),
  language: z.enum(["fr", "en", "es"]),
  primaryCta: ctaConfigSchema.optional(),
  defaultImageMode: z.enum(["none", "upload", "ai-suggested"]).optional(),

  funnelKind: z
    .enum([
      // 6 nouveaux (Lot B1)
      "lead-magnet",
      "digital-product",
      "webinar",
      "booking",
      "coaching-high-ticket",
      "challenge",
      // Legacy (mappés automatiquement)
      "vsl",
      "formation",
      "service",
      "saas",
      "thank-you",
    ])
    .optional(),
  creationMode: z.enum(["guided", "free", "express"]).optional(),
  businessPrompt: z.string().optional(),
  pageCount: z.number().int().min(1).max(12).optional(),
  templateId: z.string().optional(),
  moodId: z
    .enum(["premium-calm", "modern-minimal", "energetic", "institutional-trust", "creative-warm"])
    .optional(),
  mainColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  // 🆕 Branding : couleurs de marque (1 à 4) + interrupteur. Sans ces deux
  // champs dans le schéma, zod les aurait silencieusement retirés du brief
  // avant qu'il n'atteigne generateMultiPageFunnelWithAI (étape 21).
  brandColorsEnabled: z.boolean().optional(),
  brandColors: z.array(z.string()).max(4).optional(),
  logoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  // 🆕 Sans cette entrée, authorName serait silencieusement retiré du brief
  // par ce schéma avant d'atteindre generateMultiPageFunnelWithAI (même piège
  // que brandColors/brandColorsEnabled ci-dessus — cf. mémoire projet).
  authorName: z.string().optional(),
  aboutText: z.string().optional(),
  // 🆕 Bénéfices/urgence/garantie saisis manuellement dans le wizard — sans
  // ces entrées, zod les retirerait silencieusement du brief (même piège que
  // brandColors/authorName ci-dessus).
  keyBenefits: z.array(z.string()).max(12).optional(),
  urgencyText: z.string().optional(),
  guaranteeTitle: z.string().optional(),
  guaranteeDescription: z.string().optional(),
  guaranteeDuration: z.string().optional(),
  // 🆕 Palier 1 paiement : lien de paiement externe de l'offre.
  paymentUrl: z.string().optional(),
  // 🆕 Canaux communautaires (WhatsApp/Telegram) affichés sur les pages de
  // succès. Sans ces entrées, zod les retirerait silencieusement du brief
  // (même piège que brandColors/authorName ci-dessus).
  communityWhatsappUrl: z.string().optional(),
  communityTelegramUrl: z.string().optional(),

  medias: z.array(mediaItemSchema).optional(),
  copywritingPrefs: copywritingPrefsSchema.optional(),
  // 🆕 LOT 3 — Rôles des pages OPTIONNELLES cochées dans l'aperçu du wizard.
  selectedOptionalPages: z
    .array(
      z.enum([
        "optin", "thankyou", "delivery",
        "sales", "checkout", "upsell", "downsell", "access",
        "registration", "confirmation", "replay", "live",
        "landing", "qualification", "booking", "case-studies", "application",
        "challenge-landing", "challenge-day",
        "oto", "vsl", "custom",
      ]),
    )
    .max(10)
    .optional(),
});

function statusForReason(reason: string): number {
  switch (reason) {
    case "missing-key":
    case "invalid-key":
      return 503;
    case "insufficient-quota":
      return 402;
    case "rate-limit":
      return 429;
    case "network-error":
      return 504;
    case "empty-response":
    case "invalid-json":
    case "schema-mismatch":
      return 502;
    default:
      return 500;
  }
}

type UserValidationError = {
  field: string;
  reason: string;
};

const FIELD_LABELS: Record<string, string> = {
  brandName: "nom de la marque",
  offerName: "nom de l'offre",
  price: "prix",
  anchorPrice: "prix barré",
  targetAudience: "audience cible",
  mainPain: "problème principal",
  promise: "promesse",
  tone: "ton rédactionnel",
  funnelType: "type de tunnel",
  funnelKind: "format du tunnel",
  designStyle: "style visuel",
  language: "langue",
  primaryCta: "bouton principal",
  label: "texte du bouton",
  mode: "mode du bouton",
  url: "lien",
  target: "destination du lien",
  medias: "médias",
  sections: "sections de la page",
  type: "type de section",
  headline: "titre",
  subheadline: "sous-titre",
  body: "texte principal",
  bullets: "liste à puces",
  items: "éléments de la section",
  kind: "type d'élément",
  question: "question de FAQ",
  answer: "réponse de FAQ",
  quote: "citation d'avis",
  authorName: "nom de l'auteur de l'avis",
  authorRole: "rôle de l'auteur de l'avis",
  avatarUrl: "avatar de l'avis",
  rating: "note d'avis",
  features: "caractéristiques de l'offre",
  image: "image",
  video: "vidéo",
  provider: "fournisseur vidéo",
  visible: "visibilité de la section",
  design: "paramètres visuels",
  seo: "référencement",
  emails: "emails",
  thankYouPage: "page de remerciement",
};

const TYPE_LABELS: Record<string, string> = {
  string: "texte",
  number: "nombre",
  integer: "nombre entier",
  boolean: "valeur oui/non",
  array: "liste",
  object: "objet structuré",
  date: "date",
  null: "valeur vide",
  undefined: "champ absent",
  unknown: "valeur inconnue",
};

const GENERATION_SYSTEM_USER_MESSAGE =
  "Une erreur technique est survenue pendant la génération. Réessaie dans un instant.";

function fieldLabel(path: Array<string | number>, source: "brief" | "generated"): string {
  const leaf = [...path].reverse().find((part): part is string => typeof part === "string");
  const base = (leaf && FIELD_LABELS[leaf]) ||
    (source === "brief" ? "champ du brief" : "champ de la page");

  if (source !== "generated") return base;

  const sectionPos = path.indexOf("sections");
  const sectionIndex = sectionPos >= 0 ? path[sectionPos + 1] : undefined;
  const itemsPos = path.indexOf("items");
  const itemIndex = itemsPos >= 0 ? path[itemsPos + 1] : undefined;
  const location: string[] = [];
  if (typeof sectionIndex === "number") location.push(`section ${sectionIndex + 1}`);
  if (typeof itemIndex === "number") location.push(`élément ${itemIndex + 1}`);

  return location.length > 0 ? `${base} (${location.join(", ")})` : base;
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "format attendu";
}

function issueReason(issue: ZodIssue, field: string): string {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") return `${field} est obligatoire`;
      return `${field} doit être au format ${typeLabel(issue.expected)}, mais la valeur reçue est au format ${typeLabel(issue.received)}`;
    case "invalid_enum_value":
      return `${field} contient une valeur non reconnue`;
    case "invalid_string":
      if (issue.validation === "email") return `${field} doit être une adresse e-mail valide`;
      if (issue.validation === "url") return `${field} doit être un lien valide`;
      if (issue.validation === "uuid") return `${field} contient un identifiant invalide`;
      return `${field} contient un texte invalide`;
    case "too_small":
      if (issue.type === "string") return `${field} doit contenir au moins ${issue.minimum} caractère(s)`;
      if (issue.type === "array") return `${field} doit contenir au moins ${issue.minimum} élément(s)`;
      return `${field} doit être supérieur ou égal à ${issue.minimum}`;
    case "too_big":
      if (issue.type === "string") return `${field} ne peut pas dépasser ${issue.maximum} caractère(s)`;
      if (issue.type === "array") return `${field} ne peut pas dépasser ${issue.maximum} élément(s)`;
      return `${field} doit être inférieur ou égal à ${issue.maximum}`;
    case "invalid_union":
      return `${field} n'a pas le format attendu`;
    case "unrecognized_keys":
      return `${field} contient une information non reconnue`;
    default:
      return `${field} n'est pas valide`;
  }
}

function userValidationPayload(
  issues: ZodIssue[],
  source: "brief" | "generated",
): { userMessage: string; fieldErrors: UserValidationError[] } {
  const unique = new Map<string, UserValidationError>();
  for (const issue of issues) {
    const field = fieldLabel(issue.path, source);
    const reason = issueReason(issue, field);
    unique.set(`${field}:${reason}`, { field, reason });
    if (unique.size >= 3) break;
  }

  const fieldErrors = [...unique.values()];
  const reasons = fieldErrors.map((error) => error.reason);
  const prefix = source === "brief"
    ? "Certaines informations du brief sont invalides"
    : "La page générée contient un ou plusieurs champs invalides";
  const action = source === "brief"
    ? "Corrige ces informations puis relance la génération."
    : "Relance la génération.";
  const detail = reasons.length > 0 ? ` : ${reasons.join(" ; ")}.` : ".";

  return {
    userMessage: `${prefix}${detail} ${action}`,
    fieldErrors,
  };
}

export async function POST(request: Request) {
  // Garde abonnement + quota de tunnels du plan.
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  const quota = await canCreateFunnel(guard.access, guard.userId);
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: "funnel_quota_reached",
        message: `Tu as atteint la limite de ${quota.limit} tunnels de ton plan. Passe à un plan supérieur pour en créer davantage.`,
        used: quota.used,
        limit: quota.limit,
      },
      { status: 403 },
    );
  }
  // 🆕 Anti-burst + quota MENSUEL de générations IA de tunnel.
  const rl = await rateLimit(`funnelgen:${guard.userId}`, 8, 60);
  if (!rl.ok) return tooManyRequests();
  const genQuota = await consumeQuota(
    guard.userId,
    "ai_funnel_gen",
    guard.access.limits.aiFunnelGensPerMonth,
  );
  if (!genQuota.ok) {
    return quotaExceededResponse(
      "Quota mensuel de générations IA de tunnel atteint pour ton plan.",
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[generate-funnel] validation failed:", parsed.error.format());
    const validation = userValidationPayload(parsed.error.issues, "brief");
    return NextResponse.json(
      {
        error: "invalid-brief",
        reason: "invalid-brief",
        message: validation.userMessage,
        userMessage: validation.userMessage,
        fieldErrors: validation.fieldErrors,
      },
      { status: 400 }
    );
  }

  // 🆕 Marque vide → repli sur le nom de l'offre (jamais bloquant).
  const data = {
    ...parsed.data,
    brandName:
      (parsed.data.brandName ?? "").trim() ||
      parsed.data.offerName.trim() ||
      "Mon offre",
  };

  const startTime = Date.now();
  console.info(
    `[generate-funnel] START generation for brand="${data.brandName}" offer="${data.offerName}"`,
  );

  try {
    // 🆕 MOTEUR DE RDV NATIF — provisionnement AVANT génération.
    //
    // Le slug doit exister au moment où `harmonizeCTAsByFunnelKind` construit
    // les CTA, sinon la page de vente pointerait dans le vide. Un tunnel
    // « booking » sans calendrier rattaché n'a aucun intérêt : c'est justement
    // ce qui produisait une page de réservation décorative, incapable de
    // réserver quoi que ce soit.
    //
    // Best-effort : en cas d'échec, `bookingSlug` reste absent et la génération
    // retombe intégralement sur le comportement historique.
    // ⚠️ MODE EXTERNE : `usesNativeBookingEngine` renvoie false, donc AUCUNE
    // écriture dans `booking_event_types`, aucun `funnel_id`, aucune
    // dépendance au moteur natif. C'est ce qui permet au tunnel de rester
    // fonctionnel une fois exporté vers Systeme.io.
    let bookingSlug = data.bookingSlug;
    if (!bookingSlug && usesNativeBookingEngine(data)) {
      bookingSlug =
        (await ensureBookingEventType({
          userId: guard.userId,
          offerName: data.offerName,
          language: data.language,
        })) ?? undefined;
    }

    const funnel = await generateMultiPageFunnelWithAI({ ...data, bookingSlug });

    const duration = Date.now() - startTime;
    console.info(
      `[generate-funnel] SUCCESS in ${duration}ms. Pages: ${funnel.pages?.length ?? 1}`,
    );

    return NextResponse.json({
      funnel,
      pagesGenerated: funnel.pages?.length ?? 1,
      schemaVersion: funnel.meta?.schemaVersion ?? 1,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[generate-funnel] FAILED after ${duration}ms:`, error);

    if (error instanceof AiGenerationError) {
      console.warn(
        `[generate-funnel] AI failure after ${duration}ms reason=${error.reason} details=${error.details ?? "none"}`,
      );
      // 🆕 Instrumentation ciblée : seuls les échecs qui trahissent un VRAI
      // problème (clé invalide, réseau, réponse IA non conforme…) partent
      // vers Sentry. Le quota/rate-limit sont un comportement attendu du
      // produit, pas une panne — les y ajouter noierait les vraies alertes.
      if (error.reason !== "insufficient-quota" && error.reason !== "rate-limit") {
        Sentry.captureException(error, {
          tags: { area: "ai-generate-funnel", reason: error.reason },
          extra: { durationMs: duration },
        });
      }
      if (error.reason === "schema-mismatch") {
        const validation = userValidationPayload(error.validationIssues ?? [], "generated");
        return NextResponse.json(
          {
            error: "ai-generation-failed",
            reason: error.reason,
            message: validation.userMessage,
            userMessage: validation.userMessage,
            fieldErrors: validation.fieldErrors,
          },
          { status: statusForReason(error.reason) },
        );
      }

      return NextResponse.json(
        {
          error: "ai-generation-failed",
          reason: error.reason,
          message: GENERATION_SYSTEM_USER_MESSAGE,
        },
        { status: statusForReason(error.reason) },
      );
    }

    console.error(`[generate-funnel] UNEXPECTED error after ${duration}ms:`, error);
    Sentry.captureException(error, {
      tags: { area: "ai-generate-funnel", reason: "unknown" },
      extra: { durationMs: duration },
    });
    return NextResponse.json(
      {
        error: "ai-generation-failed",
        reason: "unknown",
        message: GENERATION_SYSTEM_USER_MESSAGE,
      },
      { status: 500 },
    );
  }
}
