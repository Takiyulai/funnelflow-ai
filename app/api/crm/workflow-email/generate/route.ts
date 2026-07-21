// app/api/crm/workflow-email/generate/route.ts
// 🆕 Génère À VOLONTÉ le contenu (objet + corps) d'un email d'ACTION de workflow
// (action « Envoyer un email »). Réutilise l'infra de génération de séquence
// (generateEmailSequenceWithAI) avec un seul rôle → on prend le 1er email.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateEmailSequenceWithAI, AiGenerationError } from "@/lib/ai/generate";
import { getPublishedFunnelContext } from "@/lib/funnels/funnelContext";
import { getAccess } from "@/lib/billing/subscription";
import { consumeQuota } from "@/lib/billing/usage";
import { quotaExceededResponse } from "@/lib/billing/apiGuard";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { TunnelContext } from "@/lib/crm/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  /** Ce que l'email doit dire (thème / intention). Facultatif : défaut relance. */
  prompt: z.string().max(2000).optional().default(""),
  language: z.enum(["fr", "en", "es"]).default("fr"),
  /** Tunnel publié à rattacher (optionnel) pour contextualiser l'email. */
  funnelId: z.string().uuid().optional(),
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
    case "invalid-model":
      return 502;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Accès plan + anti-burst + quota mensuel de génération de copy.
  const access = await getAccess(user.id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { ok: false, error: "subscription_required", message: "Un abonnement actif est requis." },
      { status: 402 },
    );
  }
  const rl = await rateLimit(`wfemailgen:${user.id}`, 10, 60);
  if (!rl.ok) return tooManyRequests();
  const genQuota = await consumeQuota(
    user.id,
    "ai_copy_regen",
    access.limits.aiCopyRegensPerMonth,
  );
  if (!genQuota.ok) {
    return quotaExceededResponse(
      "Quota mensuel de générations IA atteint pour ton plan.",
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { prompt, language, funnelId } = parsed.data;

  let tunnel: TunnelContext | null = null;
  if (funnelId) {
    tunnel = await getPublishedFunnelContext(sb, user.id, funnelId);
  }

  // Contexte fourni à l'IA : l'intention de l'utilisateur (ou un défaut utile).
  const context =
    prompt.trim() ||
    "Email de relance court et engageant pour recontacter un contact et l'inciter à passer à l'action.";

  try {
    const emails = await generateEmailSequenceWithAI({
      roles: [{ id: "autre", label: "Email de workflow" }],
      context,
      language: tunnel?.language ?? language,
      tunnel,
    });
    const first = emails?.[0];
    if (!first) {
      return NextResponse.json(
        { ok: false, error: "empty-response", message: "Aucun email généré." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, subject: first.subject, content: first.body });
  } catch (error) {
    if (error instanceof AiGenerationError) {
      return NextResponse.json(
        { ok: false, error: "ai-generation-failed", reason: error.reason, message: error.message },
        { status: statusForReason(error.reason) },
      );
    }
    console.error("[workflow-email/generate] unexpected:", error);
    return NextResponse.json(
      { ok: false, error: "ai-generation-failed", reason: "unknown", message: "Erreur inattendue." },
      { status: 500 },
    );
  }
}
