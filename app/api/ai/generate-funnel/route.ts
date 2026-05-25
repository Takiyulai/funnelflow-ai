// app/api/ai/generate-funnel/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateMultiPageFunnelWithAI,
  AiGenerationError,
} from "@/lib/ai/generate";
import type { FunnelSectionType } from "@/lib/funnels/types";

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
  brandName: z.string().min(1),
  offerName: z.string().min(1),
  price: z.string().min(1),
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
  creationMode: z.enum(["guided", "free"]).optional(),
  templateId: z.string().optional(),
  moodId: z
  .enum(["premium-calm", "modern-minimal", "energetic", "institutional-trust", "creative-warm"])
  .optional(),  mainColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  aboutText: z.string().optional(),

  medias: z.array(mediaItemSchema).optional(),
  copywritingPrefs: copywritingPrefsSchema.optional(),
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

  const startTime = Date.now();
  console.info(`[generate-funnel] START generation for brand="${parsed.data.brandName}" offer="${parsed.data.offerName}"`);

  try {
    const funnel = await generateMultiPageFunnelWithAI(parsed.data);

    const duration = Date.now() - startTime;
    console.info(`[generate-funnel] SUCCESS in ${duration}ms. Pages: ${funnel.pages?.length ?? 1}`);

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
        `[generate-funnel] AI failure after ${duration}ms reason=${error.reason} details=${error.details ?? "none"}`
      );
      return NextResponse.json(
        {
          error: "ai-generation-failed",
          reason: error.reason,
          message: error.message,
        },
        { status: statusForReason(error.reason) }
      );
    }

    console.error(`[generate-funnel] UNEXPECTED error after ${duration}ms:`, error);
    return NextResponse.json(
      {
        error: "ai-generation-failed",
        reason: "unknown",
        message:
          "Une erreur inattendue est survenue pendant la génération. Réessayez dans un instant",
      },
      { status: 500 }
    );
  }
}
