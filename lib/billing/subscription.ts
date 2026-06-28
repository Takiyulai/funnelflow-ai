// lib/billing/subscription.ts
//
// Lecture serveur de l'abonnement d'un utilisateur (table public.profiles) et
// calcul de ses droits effectifs. Toutes les lectures passent par le client
// admin (service role) car le gating a lieu côté serveur.
//
// Interrupteur global : BILLING_ENFORCED.
//   - non défini / "false"  → gating DÉSACTIVÉ : tout utilisateur connecté a
//     accès, avec les limites du plan Agency (rien ne bloque). Idéal tant que
//     Stripe n'est pas branché / en phase de test.
//   - "true"                → gating ACTIF : seul un abonnement actif débloque
//     la plateforme, avec les limites du plan souscrit.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PLANS, isPlanId, type PlanId, type PlanLimits } from "@/lib/billing/plans";

export type SubscriptionStatus =
  | "inactive"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

export type ProfileRow = {
  user_id: string;
  plan: PlanId | null;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

export type Access = {
  /** Le gating est-il activé (BILLING_ENFORCED) ? */
  enforced: boolean;
  /** L'utilisateur peut-il utiliser la plateforme ? */
  hasAccess: boolean;
  /** Plan effectif (souscrit, ou Agency par défaut si gating off). */
  planId: PlanId | null;
  status: SubscriptionStatus;
  /** Limites effectives à appliquer (tout à 0/false si aucun accès). */
  limits: PlanLimits;
};

/** Limites « aucun accès » : tout verrouillé. */
const NO_ACCESS: PlanLimits = {
  funnels: 0,
  publishedFunnels: 0,
  urlImport: false,
  urlImportsPerMonth: 0,
  sectionRegeneration: false,
  aiFunnelGensPerMonth: 0,
  aiSequenceGensPerMonth: 0,
  aiCopyRegensPerMonth: 0,
  crm: false,
  maxLeads: 0,
  leadsExport: false,
  campaigns: false,
  monthlyEmailSends: 0,
  workflows: false,
  systemeExport: false,
  htmlExport: false,
  multiPlatform: false,
  clientWorkspaces: 0,
  customSendingDomain: false,
  customDomains: 0,
  paymentsInFunnels: false,
  platformFeePercent: 0,
  prioritySupport: false,
};

export function isBillingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === "true";
}

/** Un statut qui donne accès à la plateforme. */
export function statusGrantsAccess(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/** Lit la ligne profile d'un utilisateur (null si absente). */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[subscription] getProfile error", error);
    return null;
  }
  if (!data) return null;
  return {
    user_id: data.user_id as string,
    plan: isPlanId(data.plan) ? data.plan : null,
    status: (data.status as SubscriptionStatus) ?? "inactive",
    stripe_customer_id: (data.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id: (data.stripe_subscription_id as string | null) ?? null,
    current_period_end: (data.current_period_end as string | null) ?? null,
  };
}

/**
 * Calcule les droits effectifs d'un utilisateur. Ne lève jamais : en cas de
 * souci de lecture, renvoie « pas d'accès » (si gating actif) ou « accès
 * Agency » (si gating inactif).
 */
export async function getAccess(userId: string): Promise<Access> {
  const enforced = isBillingEnforced();

  if (!enforced) {
    return {
      enforced: false,
      hasAccess: true,
      planId: "agency",
      status: "active",
      limits: PLANS.agency.limits,
    };
  }

  const profile = await getProfile(userId);
  const status = profile?.status ?? "inactive";
  const granted = statusGrantsAccess(status);
  const planId = profile?.plan ?? null;

  if (granted && planId) {
    return {
      enforced: true,
      hasAccess: true,
      planId,
      status,
      limits: PLANS[planId].limits,
    };
  }

  // Statut actif mais plan manquant (cas limite) → on retombe sur Starter.
  if (granted && !planId) {
    return {
      enforced: true,
      hasAccess: true,
      planId: "starter",
      status,
      limits: PLANS.starter.limits,
    };
  }

  return {
    enforced: true,
    hasAccess: false,
    planId,
    status,
    limits: NO_ACCESS,
  };
}

/** Nombre de tunnels appartenant à l'utilisateur (miroir Supabase). */
export async function countUserFunnels(userId: string): Promise<number> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("funnels")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.error("[subscription] countUserFunnels error", error);
    return 0;
  }
  return count ?? 0;
}

/** True si l'utilisateur peut créer un tunnel de plus (quota du plan). */
export async function canCreateFunnel(
  access: Access,
  userId: string,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = access.limits.funnels;
  if (limit === Infinity) return { ok: true, used: 0, limit };
  const used = await countUserFunnels(userId);
  return { ok: used < limit, used, limit };
}
