// app/api/ai/regenerate-section/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import type { FunnelSection, CtaConfig } from "@/lib/funnels/types";
import { regenerateSectionPrompt } from "@/lib/ai/prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Schémas
// ─────────────────────────────────────────────────────────────────────────────
const ctaConfigSchema = z.object({
  label: z.string().min(1),
  mode: z.enum(["redirect", "anchor", "popup"]),
  url: z.string().optional(),
  target: z.enum(["_self", "_blank"]).optional(),
  anchorId: z.string().optional(),
  popupId: z.string().optional(),
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
});

const sectionSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  eyebrow: z.string().optional(),
  headline: z.string(),
  subheadline: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  cta: z
    .union([z.string(), ctaConfigSchema])
    .optional(),
});

const inputSchema = z.object({
  brief: briefSchema,
  section: sectionSchema,
  instruction: z.string().max(500).optional(),
});

const aiOutputSchema = z.object({
  type: z.string(),
  eyebrow: z.string().optional(),
  headline: z.string(),
  subheadline: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  cta: ctaConfigSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
}

function normalizeCta(raw: unknown, fallback?: CtaConfig): CtaConfig | undefined {
  if (!raw) return fallback;
  if (typeof raw === "string") {
    return {
      label: raw,
      mode: fallback?.mode ?? "anchor",
      anchorId: fallback?.anchorId ?? "lead-form",
      target: fallback?.target ?? "_self",
    };
  }
  return raw as CtaConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback déterministe si OpenAI n'est pas disponible
// On retourne la section quasiment inchangée, en signalant l'absence de clé
// ─────────────────────────────────────────────────────────────────────────────
function fallbackSection(input: z.infer<typeof inputSchema>): FunnelSection {
  const { section } = input;
  return {
    id: section.id ?? `${section.type}-regen`,
    type: section.type as FunnelSection["type"],
    eyebrow: section.eyebrow,
    headline: section.headline,
    subheadline: section.subheadline,
    body: section.body,
    bullets: section.bullets,
    cta: normalizeCta(section.cta),
    visible: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { brief, section, instruction } = parsed.data;

  // Pas de clé OpenAI : on renvoie un fallback propre sans planter
  if (!process.env.OPENAI_API_KEY) {
    const regenerated = fallbackSection(parsed.data);
    return NextResponse.json({ section: regenerated, fallback: true });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = regenerateSectionPrompt({
      brief,
      section: {
        type: section.type as FunnelSection["type"],
        headline: section.headline,
        subheadline: section.subheadline,
        body: section.body,
        bullets: section.bullets,
        cta: typeof section.cta === "object" ? section.cta : undefined,
      },
      instruction,
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "text" } },
    });

    const aiRaw = stripJsonFences(response.output_text);
    const aiJson = JSON.parse(aiRaw);
    const aiParsed = aiOutputSchema.safeParse(aiJson);

    if (!aiParsed.success) {
      console.warn("regenerate-section: AI output schema mismatch, using fallback");
      const regenerated = fallbackSection(parsed.data);
      return NextResponse.json({ section: regenerated, fallback: true });
    }

    const fallbackCta = brief.primaryCta;
    const regenerated: FunnelSection = {
      id: section.id ?? `${section.type}-regen`,
      type: aiParsed.data.type as FunnelSection["type"],
      eyebrow: aiParsed.data.eyebrow,
      headline: aiParsed.data.headline,
      subheadline: aiParsed.data.subheadline,
      body: aiParsed.data.body,
      bullets: aiParsed.data.bullets,
      cta: normalizeCta(aiParsed.data.cta, fallbackCta),
      visible: true,
    };

    return NextResponse.json({ section: regenerated, fallback: false });
  } catch (error) {
    console.error("regenerate-section route failed", error);
    const regenerated = fallbackSection(parsed.data);
    return NextResponse.json({ section: regenerated, fallback: true });
  }
}
