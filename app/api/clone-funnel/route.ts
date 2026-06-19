// app/api/clone-funnel/route.ts
/**
 * Route API du clonage de funnels.
 *
 * Entrée : { url, language, funnelId }
 * Sortie : { success: true, funnel, stats } ou { success: false, error, code }
 *
 * IMPORTANT : Cette route ne sauvegarde RIEN côté serveur. Elle retourne
 * juste le Funnel construit. Le client (CloneFunnelModal) appelle ensuite
 * createFunnelFromAi() pour le persister en localStorage + IndexedDB.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { cloneFunnelFromUrl } from "@/lib/clone/pipeline";
import { CloneFetchError } from "@/lib/clone/fetcher";
import type { CloneErrorCode } from "@/lib/clone/types";
import { guardApiAccess } from "@/lib/billing/apiGuard";
import { canCreateFunnel } from "@/lib/billing/subscription";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel : autoriser 60s (ScrapingBee peut prendre 25-30s)

const requestSchema = z.object({
  url: z.string().url().min(1).max(2048),
  language: z.enum(["fr", "en", "es"]),
  funnelId: z.string().min(1).max(64),
});

export async function POST(request: Request) {
  // Garde abonnement + fonctionnalité "import URL" (Pro/Agency) + quota tunnels.
  const guard = await guardApiAccess();
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: "Un abonnement actif est requis pour cloner un tunnel." },
      { status: 402 },
    );
  }
  if (!guard.access.limits.urlImport) {
    return NextResponse.json(
      {
        success: false,
        error:
          "L'import / clonage par URL n'est pas inclus dans ton plan. Passe au plan Pro ou Agency pour l'activer.",
      },
      { status: 403 },
    );
  }
  const quota = await canCreateFunnel(guard.access, guard.userId);
  if (!quota.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Tu as atteint la limite de ${quota.limit} tunnels de ton plan. Passe à un plan supérieur pour en cloner davantage.`,
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid-url", "Corps de requête JSON invalide", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return errorResponse(
      "invalid-url",
      `Paramètres invalides : ${firstIssue?.path.join(".")} - ${firstIssue?.message}`,
      400
    );
  }

  const { url, language, funnelId } = parsed.data;

  try {
    const { funnel, stats } = await cloneFunnelFromUrl(url, language, funnelId);

    console.log(
      `[api/clone-funnel] ✅ Cloned ${url} → funnel "${funnel.funnelName}" in ${stats.durationMs}ms`
    );

    return NextResponse.json({
      success: true,
      funnel,
      stats,
    });
  } catch (err) {
    if (err instanceof CloneFetchError) {
      const status = mapCodeToStatus(err.code);
      console.error(
        `[api/clone-funnel] ❌ CloneFetchError (${err.code}): ${err.message}`
      );
      return errorResponse(err.code, err.message, status);
    }

    console.error(`[api/clone-funnel] ❌ Unexpected error :`, err);
    return errorResponse(
      "internal",
      (err as Error)?.message || "Erreur interne",
      500
    );
  }
}

function errorResponse(code: CloneErrorCode, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  );
}

function mapCodeToStatus(code: CloneErrorCode): number {
  switch (code) {
    case "invalid-url":
    case "page-too-small":
    case "parsing-failed":
      return 400;
    case "scrapingbee-missing-key":
    case "scrapingbee-quota":
      return 503;
    case "scraping-blocked":
    case "scraping-timeout":
      return 502;
    case "supabase-error":
    case "media-upload-failed":
    case "internal":
    default:
      return 500;
  }
}
