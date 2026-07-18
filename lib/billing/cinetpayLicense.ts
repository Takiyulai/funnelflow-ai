// lib/billing/cinetpayLicense.ts
//
// 🆕 Intégration CinetPay — abonnement SaaS AutoFunnel AI (Mobile Money,
// Bénin, XOF). DISTINCT de lib/billing/cinetpay.ts (qui gère l'encaissement
// des VENDEURS/créateurs pour LEURS propres clients via l'API Checkout v2 —
// clés propres par utilisateur). Ici, c'est AutoFunnel elle-même qui encaisse
// son propre abonnement via le compte marchand CinetPay de la plateforme
// (clés d'environnement globales, jamais par utilisateur).
//
// API utilisée (v1, distincte de l'API Checkout v2) :
//   - POST {CINETPAY_BASE_URL}/v1/oauth/login   → access_token (± 5 min)
//   - POST {CINETPAY_BASE_URL}/v1/payment       → payment_url + notify_token
//   - GET  {CINETPAY_BASE_URL}/v1/payment/{merchant_transaction_id}
//                                                → statut canonique (re-check)
//
// ENV requis (serveur uniquement, JAMAIS committé) :
//   CINETPAY_API_KEY      — identifiant marchand plateforme
//   CINETPAY_API_PASSWORD — mot de passe API marchand plateforme
//   CINETPAY_BASE_URL     — https://api.cinetpay.net (sandbox) ou
//                            https://api.cinetpay.co (prod). Jamais en dur.
//
// CinetPay ne propose pas d'abonnement récurrent natif : chaque paiement
// réussi active/renouvelle une licence de 30 jours dans `user_licenses`
// (même table que Chariow — cf. lib/billing/chariow.ts). Passé les 30 jours,
// l'utilisateur doit repayer manuellement (pas de prélèvement automatique).

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPlan, isPlanId, type PlanId } from "@/lib/billing/plans";

function baseUrl(): string {
  const raw = process.env.CINETPAY_BASE_URL?.trim();
  // Pas de repli en dur sur sandbox/prod : une config manquante doit échouer
  // explicitement plutôt que d'encaisser silencieusement au mauvais endroit.
  if (!raw) throw new Error("CINETPAY_BASE_URL manquant");
  return raw.replace(/\/+$/, "");
}

// ─── OAuth : cache mémoire du token (± 5 min, par process) ──────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const apiKey = process.env.CINETPAY_API_KEY?.trim();
  const apiPassword = process.env.CINETPAY_API_PASSWORD?.trim();
  if (!apiKey || !apiPassword) {
    throw new Error("CINETPAY_API_KEY / CINETPAY_API_PASSWORD manquants");
  }

  // 🆕 CONFIRMÉ par test curl réel (IP whitelistée) : le corps attendu est
  // du JSON (pas x-www-form-urlencoded comme initialement supposé), et la
  // réponse renvoie access_token/token_type/expires_in À LA RACINE :
  //   {"code":200,"status":"OK","access_token":"...","token_type":"bearer","expires_in":86400}
  const res = await fetch(`${baseUrl()}/v1/oauth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, api_password: apiPassword }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const nested = (data.data ?? {}) as Record<string, unknown>;
  const token =
    (typeof data.access_token === "string" && data.access_token) ||
    (typeof nested.access_token === "string" && nested.access_token) ||
    (typeof data.token === "string" && data.token) ||
    (typeof nested.token === "string" && nested.token) ||
    null;
  if (!res.ok || !token) {
    throw new Error(
      `CinetPay oauth/login échec (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  cachedToken = { token, expiresAt: Date.now() + 5 * 60 * 1000 };
  return token;
}

// ─── merchant_transaction_id : court (≤30 car.), unique, non devinable ─────
function generateMerchantTransactionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `af${ts}${rand}`.slice(0, 30);
}

export type InitCinetpaySubscriptionInput = {
  userId: string;
  planId: PlanId;
  email: string;
  firstName?: string;
  lastName?: string;
  /** Origine (protocole+host) du site, pour construire success_url/failed_url. */
  origin: string;
};

export type InitCinetpaySubscriptionResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string };

/**
 * Initialise un paiement CinetPay pour l'abonnement AutoFunnel (Point 2).
 * Écrit une ligne `cinetpay_license_transactions` (pending) AVANT l'appel
 * API pour garantir qu'une notification webhook, même très rapide, retrouve
 * toujours sa ligne (le notify_token y est ajouté juste après, une fois connu).
 */
export async function initCinetpaySubscriptionPayment(
  input: InitCinetpaySubscriptionInput,
): Promise<InitCinetpaySubscriptionResult> {
  const plan = getPlan(input.planId);
  const merchantTransactionId = generateMerchantTransactionId();
  const admin = getSupabaseAdmin();

  const { error: insertError } = await admin
    .from("cinetpay_license_transactions")
    .insert({
      merchant_transaction_id: merchantTransactionId,
      user_id: input.userId,
      plan_id: input.planId,
      amount_xof: plan.priceXof,
      status: "pending",
    });
  if (insertError) {
    console.error("[cinetpay] insert transaction error", insertError);
    return { ok: false, error: "db_error" };
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`${baseUrl()}/v1/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currency: "XOF",
        amount: plan.priceXof,
        merchant_transaction_id: merchantTransactionId,
        lang: "fr",
        designation: `Abonnement AutoFunnel AI — ${plan.name}`,
        client_email: input.email,
        client_first_name: input.firstName || "Client",
        client_last_name: input.lastName || "AutoFunnel",
        success_url: `${input.origin}/abonnement/success`,
        failed_url: `${input.origin}/abonnement?cinetpay=failed`,
        notify_url: `${input.origin}/api/webhooks/cinetpay`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const nested = (data.data ?? {}) as Record<string, unknown>;
    const paymentUrl =
      (typeof data.payment_url === "string" && data.payment_url) ||
      (typeof nested.payment_url === "string" && nested.payment_url) ||
      null;
    const notifyToken =
      (typeof data.notify_token === "string" && data.notify_token) ||
      (typeof nested.notify_token === "string" && nested.notify_token) ||
      null;

    if (!res.ok || !paymentUrl) {
      await admin
        .from("cinetpay_license_transactions")
        .update({ status: "failed" })
        .eq("merchant_transaction_id", merchantTransactionId);
      console.error("[cinetpay] POST /v1/payment échec", res.status, data);
      return { ok: false, error: "payment_init_failed" };
    }

    // Stocke le notify_token dès qu'il est connu, AVANT de renvoyer l'URL au
    // client — indispensable pour que la vérification webhook (Point 4) ait
    // toujours une valeur à comparer, même si la notification arrive très vite.
    if (notifyToken) {
      await admin
        .from("cinetpay_license_transactions")
        .update({ notify_token: notifyToken })
        .eq("merchant_transaction_id", merchantTransactionId);
    }

    return { ok: true, paymentUrl };
  } catch (e) {
    console.error("[cinetpay] initCinetpaySubscriptionPayment error", e);
    await admin
      .from("cinetpay_license_transactions")
      .update({ status: "failed" })
      .eq("merchant_transaction_id", merchantTransactionId);
    return { ok: false, error: "network_error" };
  }
}

export type CinetpayStatusCheck = {
  ok: boolean;
  /** true UNIQUEMENT si CinetPay confirme le succès (code 100 / status SUCCESS). */
  success: boolean;
  cinetpayTransactionId: string | null;
  raw?: unknown;
  error?: string;
};

/**
 * Re-vérifie le statut CANONIQUE d'un paiement auprès de CinetPay
 * (GET /v1/payment/{merchant_transaction_id}) — Point 4b. NE JAMAIS activer
 * une licence sur la seule foi du payload reçu par le webhook : ce re-check
 * est la seule source de vérité.
 */
export async function checkCinetpayPaymentStatus(
  merchantTransactionId: string,
): Promise<CinetpayStatusCheck> {
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `${baseUrl()}/v1/payment/${encodeURIComponent(merchantTransactionId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const nested = (data.data ?? {}) as Record<string, unknown>;

    const code = String(data.code ?? nested.code ?? "");
    const status = String(data.status ?? nested.status ?? "").toUpperCase();
    const cinetpayTransactionId =
      (typeof data.transaction_id === "string" && data.transaction_id) ||
      (typeof nested.transaction_id === "string" && nested.transaction_id) ||
      (typeof data.cpm_trans_id === "string" && data.cpm_trans_id) ||
      (typeof nested.cpm_trans_id === "string" && nested.cpm_trans_id) ||
      null;

    // 🔒 Condition stricte demandée : code 100 ET status SUCCESS. Toute autre
    // combinaison (PENDING, FAILED, code différent…) = pas d'activation.
    const success = code === "100" && status === "SUCCESS";

    if (!res.ok) {
      return { ok: false, success: false, cinetpayTransactionId, raw: data, error: `http_${res.status}` };
    }
    return { ok: true, success, cinetpayTransactionId, raw: data };
  } catch (e) {
    console.error("[cinetpay] checkCinetpayPaymentStatus error", e);
    return { ok: false, success: false, cinetpayTransactionId: null, error: "network_error" };
  }
}

/**
 * Active/renouvelle la licence de 30 jours dans `user_licenses` (Point 5).
 * Réutilise volontairement la MÊME table que Chariow (lib/billing/chariow.ts)
 * — `getActiveChariowLicense()` / `getAccess()` la lisent déjà de façon
 * générique (aucun champ propre à Chariow), donc AUCUNE modification de
 * lib/billing/subscription.ts n'est nécessaire pour que l'accès se débloque.
 */
export async function activateCinetpaySubscriptionLicense(input: {
  userId: string;
  planId: PlanId;
  merchantTransactionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPlanId(input.planId)) return { ok: false, error: "invalid_plan" };
  const admin = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("user_licenses").upsert(
    {
      user_id: input.userId,
      license_key: `cinetpay-${input.merchantTransactionId}`,
      status: "active",
      plan: input.planId,
      product_id: "cinetpay",
      expires_at: expiresAt,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[cinetpay] activateCinetpaySubscriptionLicense error", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type CinetpayTransactionRow = {
  merchant_transaction_id: string;
  user_id: string;
  plan_id: PlanId;
  amount_xof: number;
  status: "pending" | "success" | "failed";
  cinetpay_transaction_id: string | null;
  notify_token: string | null;
};

/** Lit une ligne `cinetpay_license_transactions` par merchant_transaction_id. */
export async function getCinetpayTransaction(
  merchantTransactionId: string,
): Promise<CinetpayTransactionRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("cinetpay_license_transactions")
    .select(
      "merchant_transaction_id, user_id, plan_id, amount_xof, status, cinetpay_transaction_id, notify_token",
    )
    .eq("merchant_transaction_id", merchantTransactionId)
    .maybeSingle();
  if (error) {
    console.error("[cinetpay] getCinetpayTransaction error", error);
    return null;
  }
  if (!data) return null;
  return {
    merchant_transaction_id: data.merchant_transaction_id as string,
    user_id: data.user_id as string,
    plan_id: (isPlanId(data.plan_id) ? data.plan_id : "starter") as PlanId,
    amount_xof: data.amount_xof as number,
    status: data.status as CinetpayTransactionRow["status"],
    cinetpay_transaction_id: (data.cinetpay_transaction_id as string | null) ?? null,
    notify_token: (data.notify_token as string | null) ?? null,
  };
}

/** Marque une transaction 'success' (idempotent — n'écrit rien si déjà success). */
export async function markCinetpayTransactionSuccess(
  merchantTransactionId: string,
  cinetpayTransactionId: string | null,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("cinetpay_license_transactions")
    .update({
      status: "success",
      cinetpay_transaction_id: cinetpayTransactionId,
    })
    .eq("merchant_transaction_id", merchantTransactionId)
    .neq("status", "success"); // idempotence : no-op si déjà marquée success
  if (error) {
    console.error("[cinetpay] markCinetpayTransactionSuccess error", error);
  }
}

export async function markCinetpayTransactionFailed(
  merchantTransactionId: string,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("cinetpay_license_transactions")
    .update({ status: "failed" })
    .eq("merchant_transaction_id", merchantTransactionId)
    .eq("status", "pending"); // ne jamais écraser un statut success déjà acquis
  if (error) {
    console.error("[cinetpay] markCinetpayTransactionFailed error", error);
  }
}
