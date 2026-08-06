// app/api/ai/generate-funnel/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
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
  challengeDays: z.number().int().min(1).max(30).optional(),
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
  // 🆕 Challenge — offre vendue à la CLÔTURE du challenge (pitch final).
  // Symétrique des champs post-webinaire ci-dessus : sans `challengeOfferName`,
  // la page « Pitch final » n'est pas générée.
  challengeOfferName: z.string().max(200).optional(),
  challengeOfferPrice: z.string().max(40).optional(),
  challengeOfferPromise: z.string().max(300).optional(),
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
    return NextResponse.json(
      {
        error: "invalid-brief",
        message: "Le brief envoyé est incomplet ou invalide",
        details: parsed.error.flatten().fieldErrors,
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
      return NextResponse.json(
        {
          error: "ai-generation-failed",
          reason: error.reason,
          message: error.message,
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
        message:
          "Une erreur inattendue est survenue pendant la génération. Réessayez dans un instant",
      },
      { status: 500 },
    );
  }
}
