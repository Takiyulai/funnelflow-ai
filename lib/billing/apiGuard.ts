// lib/billing/apiGuard.ts
//
// Garde réutilisable pour les routes API qui consomment le produit : exige un
// utilisateur connecté + un abonnement actif (si BILLING_ENFORCED). Renvoie
// soit { ok:true, userId, access }, soit { ok:false, response } prêt à
// retourner.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccess, type Access } from "@/lib/billing/subscription";
import type { BooleanFeature } from "@/lib/billing/plans";

export type GuardResult =
  | { ok: true; userId: string; access: Access }
  | { ok: false; response: NextResponse };

export async function guardApiAccess(): Promise<GuardResult> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  const access = await getAccess(user.id);
  if (!access.hasAccess) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "subscription_required",
          message: "Un abonnement actif est requis pour cette action.",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, userId: user.id, access };
}

/** Réponse standard quand une fonctionnalité n'est pas incluse dans le plan. */
export function featureBlockedResponse(feature: BooleanFeature): NextResponse {
  const labels: Partial<Record<BooleanFeature, string>> = {
    urlImport: "L'import / clonage par URL",
    sectionRegeneration: "La régénération IA de section",
    campaigns: "Les campagnes email",
    workflows: "Les automatisations",
  };
  const label = labels[feature] ?? "Cette fonctionnalité";
  return NextResponse.json(
    {
      ok: false,
      error: "feature_not_in_plan",
      feature,
      message: `${label} n'est pas incluse dans ton plan actuel. Passe à un plan supérieur.`,
    },
    { status: 403 },
  );
}
