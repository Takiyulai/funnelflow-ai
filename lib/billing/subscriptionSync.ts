// lib/billing/subscriptionSync.ts
//
// Écritures serveur (service role) qui répercutent l'état d'un abonnement
// Stripe dans la table public.profiles. Appelé exclusivement depuis le webhook.

import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PLANS, isPlanId, type PlanId } from "@/lib/billing/plans";
import type { SubscriptionStatus } from "@/lib/billing/subscription";

/** Retrouve le plan à partir d'un price_id Stripe (reverse lookup via env). */
function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of Object.keys(PLANS) as PlanId[]) {
    const envVal = process.env[PLANS[id].envPriceKey];
    if (envVal && envVal.trim() === priceId) return id;
  }
  return null;
}

/** Mappe un statut d'abonnement Stripe vers notre statut interne. */
function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // incomplete, paused…
      return "inactive";
  }
}

/** Répercute un objet Subscription Stripe dans profiles (idempotent). */
export async function syncSubscriptionToProfile(sub: Stripe.Subscription): Promise<void> {
  const admin = getSupabaseAdmin();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const metaUserId = (sub.metadata?.userId as string | undefined) ?? null;
  const metaPlan = sub.metadata?.plan;
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const plan: PlanId | null = isPlanId(metaPlan) ? metaPlan : planFromPriceId(priceId);
  const status = mapStatus(sub.status);
  const periodEnd =
    typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

  const base: Record<string, unknown> = {
    status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };
  if (plan) base.plan = plan;

  // Localiser la ligne : userId (metadata) prioritaire, sinon le customer Stripe.
  if (metaUserId) {
    await admin
      .from("profiles")
      .upsert({ user_id: metaUserId, ...base }, { onConflict: "user_id" });
    return;
  }
  await admin.from("profiles").update(base).eq("stripe_customer_id", customerId);
}

/** Passe le profil rattaché à un customer en past_due (échec de paiement). */
export async function markPastDueByCustomer(customerId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from("profiles")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
}
