// app/api/ai/regenerate-section/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import type { FunnelSection, CtaConfig, FunnelBrief } from "@/lib/funnels/types";
import { regenerateSectionPrompt } from "@/lib/ai/prompts";
import { callAI, SYSTEM_MESSAGE_FUNNEL } from "@/lib/ai/generate";
import { guardApiAccess, featureBlockedResponse, quotaExceededResponse } from "@/lib/billing/apiGuard";
import { consumeQuota } from "@/lib/billing/usage";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

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
  // 🆕 Brief OPTIONNEL et partiel : la régénération par prompt depuis l'éditeur
  // n'a pas le brief complet — on dérive un contexte minimal du tunnel + section.
  brief: briefSchema.partial().optional(),
  section: sectionSchema,
  // Le prompt libre de l'utilisateur (« rends ça plus percutant », « raccourcis »…).
  instruction: z.string().max(800).optional(),
  language: z.enum(["fr", "en", "es"]).optional(),
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
  // Garde abonnement + fonctionnalité "régénération de section" (Pro/Agency).
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  if (!guard.access.limits.sectionRegeneration) {
    return featureBlockedResponse("sectionRegeneration");
  }
  // Anti-burst (par utilisateur) puis quota mensuel de plan.
  const rl = await rateLimit(`copyregen:${guard.userId}`, 15, 60);
  if (!rl.ok) return tooManyRequests();
  const quota = await consumeQuota(
    guard.userId,
    "ai_copy_regen",
    guard.access.limits.aiCopyRegensPerMonth,
  );
  if (!quota.ok) {
    return quotaExceededResponse(
      "Quota mensuel de régénérations IA atteint pour ton plan.",
    );
  }

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

  const { brief: briefIn, section, instruction, language: langIn } = parsed.data;

  // 🆕 Brief complet reconstruit avec des replis neutres : le moteur de prompt
  // attend un FunnelBrief, mais la régénération par prompt n'en a qu'un fragment.
  const lang = (briefIn?.language ?? langIn ?? "fr") as FunnelBrief["language"];
  const brief: FunnelBrief = {
    brandName: briefIn?.brandName || "",
    offerName: briefIn?.offerName || section.headline || "",
    price: briefIn?.price || "",
    targetAudience: briefIn?.targetAudience || "",
    mainPain: briefIn?.mainPain || "",
    promise: briefIn?.promise || "",
    tone: briefIn?.tone || "",
    funnelType: briefIn?.funnelType || "",
    designStyle: briefIn?.designStyle || "",
    language: lang,
    primaryCta: briefIn?.primaryCta,
    defaultImageMode: briefIn?.defaultImageMode,
  };

  // Pas de clé IA configurée pour le provider courant : fallback propre sans
  // planter. Provider-aware (Anthropic utilise ANTHROPIC_API_KEY ; OpenAI /
  // Z.AI / OpenRouter utilisent OPENAI_API_KEY).
  const aiProvider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const hasAiKey =
    aiProvider === "anthropic" || aiProvider === "claude"
      ? !!process.env.ANTHROPIC_API_KEY
      : !!process.env.OPENAI_API_KEY;
  if (!hasAiKey) {
    const regenerated = fallbackSection(parsed.data);
    return NextResponse.json({ section: regenerated, fallback: true });
  }

  try {
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

    // 🆕 On passe par le MÊME helper que la génération de tunnel (callAI) :
    // il respecte AI_PROVIDER / OPENAI_BASE_URL / OPENAI_MODEL (OpenAI, Z.AI,
    // OpenRouter, Anthropic…). L'ancien appel `client.responses.create` en dur
    // échouait dès que le provider n'était pas l'OpenAI natif → fallback
    // systématique (« Régénération IA indisponible… »).
    const rawText = await callAI({
      systemMessage: SYSTEM_MESSAGE_FUNNEL,
      userPrompt: prompt,
      maxTokens: 1500,
    });

    const aiRaw = stripJsonFences(rawText);
    const aiJson = JSON.parse(aiRaw);
    // 🆕 Robustesse : le modèle peut répondre soit la section à plat
    // ({ type, headline... }), soit enveloppée ({ section: {...} }). On gère les
    // deux pour éviter un faux « fallback » (texte inchangé) systématique.
    const aiCandidate =
      aiJson && typeof aiJson === "object" && "section" in aiJson
        ? (aiJson as { section: unknown }).section
        : aiJson;
    const aiParsed = aiOutputSchema.safeParse(aiCandidate);

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
