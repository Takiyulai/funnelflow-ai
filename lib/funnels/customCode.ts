// lib/funnels/customCode.ts
// 🆕 VAGUE CUSTOM-CODE — Résolution CÔTÉ SERVEUR du code personnalisé d'un
// tunnel publié. C'EST ICI que la sécurité s'applique (pas dans l'UI) :
//
//   1. Kill switch global : env CUSTOM_CODE_DISABLED="true" → aucun code
//      injecté, sur aucun tunnel, sans redéploiement de code.
//   2. Plan : seul un propriétaire dont le plan RÉELLEMENT SOUSCRIT est
//      Agency (profil actif OU licence Chariow active) voit son code injecté.
//      On utilise getSubscribedPlanId (PAS getAccess) : quand BILLING_ENFORCED
//      est désactivé, getAccess donne « Agency à tout le monde », ce qui
//      ouvrirait l'injection de script à n'importe quel compte.
//   3. Taille : chaque zone est plafonnée (MAX_CUSTOM_CODE_LEN). Au-delà,
//      la zone est ignorée (pas tronquée : un script coupé = comportement
//      imprévisible).
//
// Un utilisateur non-Agency qui écrirait `customCode` directement dans son
// json_content (la sauvegarde est côté client) n'obtiendra JAMAIS d'injection :
// cette fonction est le seul chemin vers le rendu public.

import type { Funnel } from "@/lib/funnels/types";
import { MAX_CUSTOM_CODE_LEN } from "@/lib/funnels/types";
import { getSubscribedPlanId } from "@/lib/billing/subscription";
import { PLANS } from "@/lib/billing/plans";

export type ResolvedCustomCode = { head: string | null; body: string | null };

function cleanZone(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (!s || s.length > MAX_CUSTOM_CODE_LEN) return null;
  return s;
}

/**
 * Retourne le code injectable pour un tunnel publié, ou null si rien ne doit
 * être injecté. Best-effort : toute erreur → null (jamais bloquant pour la
 * page publique, et prudent : pas de code en cas de doute).
 */
export async function resolvePublicCustomCode(
  funnel: Funnel,
  ownerId: string,
): Promise<ResolvedCustomCode | null> {
  try {
    if (process.env.CUSTOM_CODE_DISABLED === "true") return null;

    const head = cleanZone(funnel.customCode?.head);
    const body = cleanZone(funnel.customCode?.body);
    if (!head && !body) return null;

    // Vérification serveur du plan du PROPRIÉTAIRE (exigence n°1) : le plan
    // souscrit doit avoir customCode (Agency uniquement).
    const planId = await getSubscribedPlanId(ownerId);
    if (!planId || !PLANS[planId].limits.customCode) return null;

    return { head, body };
  } catch (e) {
    console.warn("[customCode] résolution échouée → aucun code injecté:", e);
    return null;
  }
}
