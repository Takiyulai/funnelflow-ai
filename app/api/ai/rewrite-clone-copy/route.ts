// app/api/ai/rewrite-clone-copy/route.ts
//
// 🆕 Réécriture par prompt du copy d'une page CLONÉE, sans toucher au squelette,
// au layout, aux couleurs, aux médias ni aux URL de redirection.
//
// Le client envoie des EMPLACEMENTS DE TEXTE déjà projetés (`CopyItem[]`), pas
// du HTML : la collecte a besoin du DOM et se fait donc dans le navigateur, ce
// qui évite d'instancier jsdom ici et fait que le HTML capturé ne transite
// jamais. La réponse est un `RawHtmlPatch` réduit, à fusionner côté client dans
// `section.rawHtmlPatches`.

import { NextResponse } from "next/server";
import { z } from "zod";
import { AiGenerationError } from "@/lib/ai/generate";
import { rewriteCloneCopy } from "@/lib/ai/clone-copy";
import type { CopyItem } from "@/lib/clone/copy-rewrite";
import {
  guardApiAccess,
  featureBlockedResponse,
  quotaExceededResponse,
} from "@/lib/billing/apiGuard";
import { consumeQuota } from "@/lib/billing/usage";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Plafond d'emplacements par appel. Une page clonée en porte couramment 150 à
 * 200 ; au-delà de 400, le découpage produirait trop d'appels modèle pour une
 * seule action utilisateur.
 */
const MAX_ITEMS = 400;

const itemSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(["text", "link-label"]),
  text: z.string().min(1).max(2000),
  subKind: z.enum(["title", "subtitle", "paragraph", "short"]),
  tag: z.string().min(1).max(20),
});

const inputSchema = z.object({
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  instruction: z.string().max(800).optional(),
  language: z.enum(["fr", "en", "es"]).default("fr"),
});

export async function POST(request: Request) {
  // Même garde que les autres régénérations de copy : abonnement, droit à la
  // fonctionnalité, anti-burst, puis quota mensuel.
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  if (!guard.access.limits.sectionRegeneration) {
    return featureBlockedResponse("sectionRegeneration");
  }
  // Plus strict que la régénération de page : un appel déclenche plusieurs
  // requêtes modèle (une par lot).
  const rl = await rateLimit(`clonecopy:${guard.userId}`, 4, 60);
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
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation",
        message:
          "Emplacements de texte invalides. Recharge la page et réessaie.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await rewriteCloneCopy(parsed.data.items as CopyItem[], {
      instruction: parsed.data.instruction,
      language: parsed.data.language,
    });

    if (result.fatal) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_rewrite",
          message:
            "L'IA n'a produit aucune réécriture exploitable. Reformule ta consigne et réessaie.",
          stats: result.stats,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      patch: result.patch,
      stats: result.stats,
    });
  } catch (e) {
    if (e instanceof AiGenerationError) {
      const status =
        e.reason === "missing-key" || e.reason === "invalid-key"
          ? 503
          : e.reason === "insufficient-quota"
            ? 402
            : e.reason === "rate-limit"
              ? 429
              : 502;
      return NextResponse.json(
        { ok: false, error: e.reason, message: e.message },
        { status },
      );
    }
    console.error("[rewrite-clone-copy]", e);
    return NextResponse.json(
      { ok: false, error: "unknown", message: "Réécriture impossible." },
      { status: 500 },
    );
  }
}
