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
import { getActiveChariowLicense } from "@/lib/billing/chariow";
import { isInternalTestAccount } from "@/lib/billing/internalTestAccounts";

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
  pageTimeTracking: false,
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
  customCode: false,
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
 * 🆕 VAGUE CUSTOM-CODE — Plan réellement SOUSCRIT (profil actif, sinon licence
 * Chariow active), indépendamment de BILLING_ENFORCED. À utiliser pour les
 * fonctionnalités sensibles qui doivent rester réservées à un plan précis MÊME
 * quand le gating global est désactivé (ex. injection de code personnalisé :
 * getAccess() retomberait sur « Agency pour tous » en phase de test, ce qui
 * ouvrirait l'injection de script à n'importe quel compte).
 */
export async function getSubscribedPlanId(userId: string): Promise<PlanId | null> {
  try {
    // Les comptes de test internes doivent aussi accéder aux fonctionnalités
    // sensibles (ex. custom code), qui utilisent le plan réellement autorisé
    // plutôt que les limites générales de getAccess().
    if (await isInternalTestAccount(userId)) return "agency";

    const profile = await getProfile(userId);
    if (profile?.plan && statusGrantsAccess(profile.status)) return profile.plan;
    const license = await getActiveChariowLicense(userId);
    if (license && isPlanId(license.plan)) return license.plan;
    return null;
  } catch (e) {
    console.error("[subscription] getSubscribedPlanId error", e);
    return null; // prudent : en cas de doute, pas de privilège
  }
}

/**
 * Calcule les droits effectifs d'un utilisateur. Ne lève jamais : en cas de
 * souci de lecture, renvoie « pas d'accès » (si gating actif) ou « accès
 * Agency » (si gating inactif).
 */
export async function getAccess(
  userId: string,
  authenticatedEmail?: string | null,
): Promise<Access> {
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

  // Bypass durable réservé aux comptes de test identifiés côté serveur. Il est
  // indépendant du plan Stripe stocké dans profiles, qui peut être resynchronisé
  // par webhook sans retirer les droits nécessaires aux tests internes.
  if (await isInternalTestAccount(userId, authenticatedEmail)) {
    return {
      enforced: true,
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

  // 🆕 Chariow Niveau 1 : pas d'abonnement Stripe/CinetPay actif → une licence
  // Chariow ACTIVE débloque la plateforme (plan mappé par la licence).
  // Abstraction À CÔTÉ de l'existant : ne modifie rien quand il n'y a pas de
  // licence, et l'abonnement classique reste prioritaire ci-dessus.
  try {
    const license = await getActiveChariowLicense(userId);
    if (license) {
      return {
        enforced: true,
        hasAccess: true,
        planId: license.plan,
        status: "active",
        limits: PLANS[license.plan].limits,
      };
    }
  } catch (e) {
    console.error("[subscription] chariow license check failed", e);
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
