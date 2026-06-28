// app/api/crm/sequences/generate/route.ts
// 🆕 ÉTAPE 4 — Génère une séquence email par IA, alignée sur un tunnel publié
// quand il est rattaché. Service réutilisable (appelable plus tard par n8n).
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
  type: z.enum(["bienvenue", "nurturing", "relance", "lancement", "reengagement", "autre"]),
  context: z.string().max(4000).optional().default(""),
  emailCount: z.coerce.number().int().min(1).max(10).default(3),
  language: z.enum(["fr", "en", "es"]).default("fr"),
  /** Tunnel publié à rattacher (optionnel : saisie manuelle possible sans). */
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

  // 🆕 Accès plan + anti-burst + quota mensuel de générations de séquence.
  const access = await getAccess(user.id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { ok: false, error: "subscription_required", message: "Un abonnement actif est requis." },
      { status: 402 },
    );
  }
  const rl = await rateLimit(`seqgen:${user.id}`, 6, 60);
  if (!rl.ok) return tooManyRequests();
  const genQuota = await consumeQuota(
    user.id,
    "ai_sequence_gen",
    access.limits.aiSequenceGensPerMonth,
  );
  if (!genQuota.ok) {
    return quotaExceededResponse(
      "Quota mensuel de générations de séquences IA atteint pour ton plan.",
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
      {
        ok: false,
        error: "invalid_input",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const { type, context, emailCount, language, funnelId } = parsed.data;

  // Contexte tunnel (publié uniquement). Si un funnelId est fourni mais le
  // tunnel n'est pas publié/introuvable → on le signale clairement.
  let tunnel: TunnelContext | null = null;
  if (funnelId) {
    tunnel = await getPublishedFunnelContext(sb, user.id, funnelId);
    if (!tunnel) {
      return NextResponse.json(
        {
          ok: false,
          error: "funnel_not_published",
          message:
            "Ce tunnel est introuvable ou pas encore publié. Publie-le, ou génère sans tunnel rattaché.",
        },
        { status: 400 },
      );
    }
  }

  try {
    const emails = await generateEmailSequenceWithAI({
      type,
      context,
      emailCount,
      // La langue du tunnel prime si un tunnel est rattaché.
      language: tunnel?.language ?? language,
      tunnel,
    });

    return NextResponse.json({
      ok: true,
      emails,
      tunnel: tunnel ? { id: tunnel.funnelId, name: tunnel.name, url: tunnel.url } : null,
    });
  } catch (error) {
    if (error instanceof AiGenerationError) {
      return NextResponse.json(
        { ok: false, error: "ai-generation-failed", reason: error.reason, message: error.message },
        { status: statusForReason(error.reason) },
      );
    }
    console.error("[sequences/generate] unexpected:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "ai-generation-failed",
        reason: "unknown",
        message: "Une erreur inattendue est survenue pendant la génération.",
      },
      { status: 500 },
    );
  }
}
