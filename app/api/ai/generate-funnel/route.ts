// app/api/ai/generate-funnel/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateFunnelWithAI } from "@/lib/ai/generate";

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
    .enum(["vsl", "lead-magnet", "webinar", "formation", "service", "digital-product", "booking", "saas", "thank-you"])
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
        error: "Invalid brief",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const funnel = await generateFunnelWithAI(parsed.data);
    return NextResponse.json({ funnel });
  } catch (error) {
    console.error("generate-funnel route failed", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
