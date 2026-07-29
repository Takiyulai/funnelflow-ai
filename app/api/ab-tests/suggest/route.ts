// app/api/ab-tests/suggest/route.ts
//
// 🆕 MODULE 3 — Propose des alternatives pour UN SEUL champ de la variante B.
//
// POURQUOI UN CHAMP À LA FOIS, ET PAS TOUTE LA SECTION. C'est la règle qui
// donne sa valeur à un test A/B : si l'IA reformule l'accroche ET le
// sous-titre ET le bouton, on apprend que « B convertit mieux » sans savoir
// pourquoi — donc rien de réutilisable sur le tunnel suivant. La route
// n'accepte donc qu'un champ, et renvoie trois formulations parmi lesquelles
// choisir.
//
// Réutilise exactement les mêmes garde-fous que la régénération de section :
// contrôle de plan, anti-rafale, et quota mensuel `ai_copy_regen`.

import { NextResponse } from "next/server";
import { z } from "zod";
import { callAI, SYSTEM_MESSAGE_FUNNEL } from "@/lib/ai/generate";
import {
  guardApiAccess,
  featureBlockedResponse,
  quotaExceededResponse,
} from "@/lib/billing/apiGuard";
import { consumeQuota } from "@/lib/billing/usage";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  eyebrow: "sur-titre (court libellé au-dessus du titre)",
  headline: "titre principal",
  subheadline: "sous-titre",
  ctaLabel: "libellé du bouton d'action",
};

const inputSchema = z.object({
  field: z.enum(["eyebrow", "headline", "subheadline", "ctaLabel"]),
  current: z.string().max(600),
  /** Contexte facultatif pour orienter le ton (offre, audience). */
  offerName: z.string().max(200).optional(),
  targetAudience: z.string().max(300).optional(),
  language: z.enum(["fr", "en", "es"]).optional(),
});

function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
}

export async function POST(request: Request) {
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  if (!guard.access.limits.sectionRegeneration) {
    return featureBlockedResponse("sectionRegeneration");
  }

  const rl = await rateLimit(`absuggest:${guard.userId}`, 15, 60);
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

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const { field, current, offerName, targetAudience, language } = parsed.data;
  const lang = language ?? "fr";

  // Pas de clé IA → on le DIT, on n'invente pas de suggestions. Renvoyer des
  // variantes bidon serait pire que ne rien renvoyer : l'utilisateur lancerait
  // un test sur du texte qu'il n'a pas choisi.
  const aiProvider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const hasAiKey =
    aiProvider === "anthropic" || aiProvider === "claude"
      ? !!process.env.ANTHROPIC_API_KEY
      : !!process.env.OPENAI_API_KEY;
  if (!hasAiKey) {
    return NextResponse.json({
      ok: true,
      suggestions: [],
      unavailable: true,
      message: "Assistance IA indisponible : aucune clé configurée côté serveur.",
    });
  }

  const langName = lang === "en" ? "anglais" : lang === "es" ? "espagnol" : "français";

  const prompt = [
    `Tu proposes des variantes de copywriting pour un test A/B.`,
    `Champ à reformuler : ${FIELD_LABELS[field]}.`,
    `Texte actuel : "${current}"`,
    offerName ? `Offre : ${offerName}` : "",
    targetAudience ? `Audience : ${targetAudience}` : "",
    ``,
    `Donne EXACTEMENT 3 alternatives en ${langName}, nettement différentes du`,
    `texte actuel dans l'angle (bénéfice, curiosité, urgence, preuve…), mais de`,
    `longueur comparable. Pas de guillemets, pas de numérotation.`,
    field === "ctaLabel"
      ? `Un libellé de bouton fait 2 à 5 mots maximum.`
      : ``,
    ``,
    `Réponds UNIQUEMENT en JSON : {"suggestions":["...","...","..."]}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await callAI({
      systemMessage: SYSTEM_MESSAGE_FUNNEL,
      userPrompt: prompt,
      maxTokens: 500,
    });

    const json = JSON.parse(stripJsonFences(raw)) as { suggestions?: unknown };
    const suggestions = Array.isArray(json.suggestions)
      ? json.suggestions
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 3)
      : [];

    return NextResponse.json({ ok: true, suggestions, unavailable: false });
  } catch (e) {
    console.error("[ab/suggest] appel IA échoué :", e);
    // Erreur de génération (crédits épuisés, modèle indisponible) : on est
    // explicite plutôt que de laisser croire à un champ sans idée.
    return NextResponse.json({
      ok: true,
      suggestions: [],
      unavailable: true,
      message:
        "L'IA n'a pas répondu. Vérifie tes crédits chez ton fournisseur, ou écris l'alternative toi-même.",
    });
  }
}
