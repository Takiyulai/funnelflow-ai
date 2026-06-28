// lib/billing/usage.ts
//
// 🆕 Chantier 2.2 — compteurs d'usage MENSUELS par utilisateur (quotas de plan).
// S'appuie sur la table `usage_counters` + la RPC atomique `consume_usage`
// (incrémente uniquement si le quota n'est pas dépassé). Toujours côté serveur
// (client admin / service_role).

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type UsageMetric =
  | "ai_funnel_gen"
  | "ai_sequence_gen"
  | "ai_copy_regen"
  | "url_import"
  | "email_send";

export type ConsumeResult = { ok: boolean; used: number; limit: number };

/** Période courante au format 'YYYY-MM' (quota mensuel, basé UTC). */
export function currentPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Infinity → -1 (illimité côté RPC) ; sinon entier. */
function toRpcLimit(limit: number): number {
  return limit === Infinity ? -1 : Math.max(0, Math.floor(limit));
}

/**
 * Consomme `amount` unités du quota `metric` pour l'utilisateur. ATOMIQUE :
 * n'incrémente que si le quota n'est pas dépassé. Retourne { ok, used, limit }.
 * - limit Infinity → toujours ok (compté pour info).
 * - En cas d'erreur infra → fail-OPEN (on n'empêche pas l'action), loggé.
 */
export async function consumeQuota(
  userId: string,
  metric: UsageMetric,
  limit: number,
  amount = 1,
): Promise<ConsumeResult> {
  if (limit <= 0 && limit !== Infinity) {
    return { ok: false, used: 0, limit }; // quota nul = fonctionnalité non incluse
  }
  const admin = getSupabaseAdmin();
  try {
    const { data, error } = await admin.rpc("consume_usage", {
      p_user: userId,
      p_metric: metric,
      p_period: currentPeriod(),
      p_limit: toRpcLimit(limit),
      p_amount: amount,
    });
    if (error) {
      console.error("[usage] consume_usage RPC error (fail-open)", error);
      return { ok: true, used: 0, limit };
    }
    const newCount = Number(data);
    if (newCount === -1) return { ok: false, used: limit, limit };
    return { ok: true, used: newCount, limit };
  } catch (e) {
    console.error("[usage] consumeQuota exception (fail-open)", e);
    return { ok: true, used: 0, limit };
  }
}

/** Lecture seule de l'usage courant d'une métrique (pour affichage/pré-check). */
export async function getUsage(userId: string, metric: UsageMetric): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("metric", metric)
    .eq("period", currentPeriod())
    .maybeSingle();
  return (data?.count as number | undefined) ?? 0;
}
