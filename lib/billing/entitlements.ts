import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isPlanId, type PlanId } from "@/lib/billing/plans";

export type BillingEntitlement = {
  userId: string;
  provider: "saspay";
  planId: PlanId;
  status: "active" | "expired" | "revoked";
  startsAt: string;
  expiresAt: string;
};

/**
 * Droit d'accès payé via la couche provider. Chariow n'est volontairement pas
 * déplacé : ses licences continuent à vivre dans user_licenses.
 */
export async function getActiveBillingEntitlement(
  userId: string,
): Promise<BillingEntitlement | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("billing_entitlements")
    .select("user_id, provider, plan_id, status, starts_at, expires_at")
    .eq("user_id", userId)
    .eq("provider", "saspay")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    // La migration peut ne pas encore être appliquée pendant le déploiement du
    // code. On conserve alors les parcours Stripe/CinetPay/Chariow existants.
    console.error("[billing] entitlement lookup failed", error.code ?? error.message);
    return null;
  }
  if (!data || !isPlanId(data.plan_id) || data.provider !== "saspay") return null;
  return {
    userId: data.user_id as string,
    provider: "saspay",
    planId: data.plan_id,
    status: data.status as BillingEntitlement["status"],
    startsAt: data.starts_at as string,
    expiresAt: data.expires_at as string,
  };
}
