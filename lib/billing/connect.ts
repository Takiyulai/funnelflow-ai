// lib/billing/connect.ts
//
// Service interne Stripe Connect (comptes EXPRESS + onboarding hébergé).
// Le créateur de tunnel ne configure jamais rien chez Stripe : AutoFunnel crée
// le compte connecté, génère le lien d'onboarding hébergé (Account Link) et
// synchronise le statut. Toutes les clés viennent de l'env (jamais en dur).
//
// Modèle retenu (validé) : compte EXPRESS, onboarding HÉBERGÉ, encaissement en
// DIRECT CHARGE (cf. étapes suivantes), sans commission par défaut.

import { createStripeClient } from "./stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ConnectStatus = "none" | "pending" | "active" | "restricted";

export type ConnectState = {
  accountId: string | null;
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  /** 🆕 Infos d'affichage (live, non stockées) pour rassurer l'utilisateur. */
  email: string | null;
  displayName: string | null;
};

const EMPTY_STATE: ConnectState = {
  accountId: null,
  status: "none",
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  country: null,
  email: null,
  displayName: null,
};

/**
 * Lit l'état Connect stocké dans profiles (sans appel Stripe).
 */
export async function getConnectState(userId: string): Promise<ConnectState> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select(
      "stripe_connect_account_id, connect_status, connect_charges_enabled, connect_payouts_enabled, connect_details_submitted, connect_country",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.stripe_connect_account_id) return EMPTY_STATE;
  return {
    accountId: data.stripe_connect_account_id as string,
    status: (data.connect_status as ConnectStatus) ?? "pending",
    chargesEnabled: Boolean(data.connect_charges_enabled),
    payoutsEnabled: Boolean(data.connect_payouts_enabled),
    detailsSubmitted: Boolean(data.connect_details_submitted),
    country: (data.connect_country as string | null) ?? null,
    email: null,
    displayName: null,
  };
}

/**
 * Retourne l'id du compte connecté du créateur, en le CRÉANT (Express) si absent.
 * Stocke l'id + le statut "pending" dans profiles.
 */
export async function getOrCreateConnectAccount(
  userId: string,
  email?: string | null,
): Promise<string> {
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("user_id", userId)
    .maybeSingle();

  const existing = profile?.stripe_connect_account_id as string | null | undefined;
  if (existing) return existing;

  const stripe = createStripeClient();
  // Compte EXPRESS : Stripe gère l'onboarding et le dashboard du créateur.
  // On laisse Stripe collecter le pays pendant l'onboarding (on ne le force pas).
  const account = await stripe.accounts.create({
    type: "express",
    email: email ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { funnelflow_user_id: userId },
  });

  await admin
    .from("profiles")
    .update({
      stripe_connect_account_id: account.id,
      connect_status: "pending",
      connect_country: account.country ?? null,
    })
    .eq("user_id", userId);

  return account.id;
}

/**
 * Crée un Account Link d'onboarding HÉBERGÉ (redirection vers Stripe puis retour).
 */
export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const stripe = createStripeClient();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return link.url;
}

/**
 * Récupère l'état réel du compte chez Stripe et le synchronise dans profiles.
 * Détermine le statut : active (charges OK), restricted (bloqué), sinon pending.
 */
export async function syncConnectStatus(userId: string): Promise<ConnectState> {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_connect_account_id, connect_onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();

  const accountId = profile?.stripe_connect_account_id as string | null | undefined;
  if (!accountId) return EMPTY_STATE;

  const stripe = createStripeClient();
  const acct = await stripe.accounts.retrieve(accountId);

  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);
  const detailsSubmitted = Boolean(acct.details_submitted);
  const disabledReason = acct.requirements?.disabled_reason ?? null;

  let status: ConnectStatus;
  if (chargesEnabled && detailsSubmitted) status = "active";
  else if (disabledReason && detailsSubmitted) status = "restricted";
  else status = "pending";

  const update: Record<string, unknown> = {
    connect_status: status,
    connect_charges_enabled: chargesEnabled,
    connect_payouts_enabled: payoutsEnabled,
    connect_details_submitted: detailsSubmitted,
    connect_country: acct.country ?? null,
  };
  // Date d'onboarding : posée une seule fois, quand le compte devient actif.
  if (status === "active" && !profile?.connect_onboarded_at) {
    update.connect_onboarded_at = new Date().toISOString();
  }

  await admin.from("profiles").update(update).eq("user_id", userId);

  // Nom d'affichage (live) : entreprise, sinon individu, sinon email.
  const indName = acct.individual
    ? [acct.individual.first_name, acct.individual.last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
    : "";
  const displayName =
    acct.business_profile?.name ||
    acct.company?.name ||
    (indName || "") ||
    acct.email ||
    null;

  return {
    accountId,
    status,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    country: acct.country ?? null,
    email: acct.email ?? null,
    displayName,
  };
}

/**
 * 🆕 Déconnecte le compte Stripe Connect côté AutoFunnel : on OUBLIE la
 * référence du compte sur le profil (les paiements sont désactivés jusqu'à une
 * nouvelle connexion). On ne supprime pas le compte chez Stripe (un compte
 * Express ne se révoque pas comme un OAuth) ; une reconnexion recrée/reprend
 * l'onboarding via getOrCreateConnectAccount.
 */
export async function disconnectConnectAccount(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from("profiles")
    .update({
      stripe_connect_account_id: null,
      connect_status: "none",
      connect_charges_enabled: false,
      connect_payouts_enabled: false,
      connect_details_submitted: false,
      connect_onboarded_at: null,
    })
    .eq("user_id", userId);
}
