// app/api/ai/generate-funnel/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateFunnelWithAI, AiGenerationError } from "@/lib/ai/generate";

export const dynamic = "force-dynamic";

const ctaConfigSchema = z.object({
  label: z.string().min(1),
  mode: z.enum(["redirect", "anchor", "popup"]),
  url: z.string().optional(),
  target: z.enum(["_self", "_blank"]).optional(),
  anchorId: z.string().optional(),
  popupId: z.string().optional(),
});

const briefSchema = z.object({
  // Champs historiques
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

  // Nouveaux champs optionnels
  funnelKind: z
    .enum([
      "vsl",
      "lead-magnet",
      "webinar",
      "formation",
      "service",
      "digital-product",
      "booking",
      "saas",
      "thank-you",
    ])
    .optional(),
  creationMode: z.enum(["guided", "free"]).optional(),
  templateId: z.string().optional(),
  moodId: z
    .enum(["premium-calm", "energetic", "institutional-trust", "creative-warm"])
    .optional(),
  mainColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  aboutText: z.string().optional(),
});

// Mappe AiErrorReason vers un statut HTTP cohérent
function statusForReason(reason: string): number {
  switch (reason) {
    case "missing-key":
    case "invalid-key":
      return 503; // service indisponible côté config
    case "insufficient-quota":
      return 402; // payment required
    case "rate-limit":
      return 429;
    case "network-error":
      return 504;
    case "empty-response":
    case "invalid-json":
    case "schema-mismatch":
      return 502; // upstream a renvoyé du contenu inutilisable
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
    return NextResponse.json(
      {
        error: "invalid-brief",
        message: "Le brief envoyé est incomplet ou invalide",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const funnel = await generateFunnelWithAI(parsed.data);
    return NextResponse.json({ funnel });
  } catch (error) {
    if (error instanceof AiGenerationError) {
      console.warn(
        `[generate-funnel] AI error reason=${error.reason} details=${error.details ?? "none"}`
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

    console.error("[generate-funnel] unexpected error", error);
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
