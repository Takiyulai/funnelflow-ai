// lib/billing/cinetpay.ts
//
// 🆕 Encaissement vendeur via CinetPay (alternative à Stripe Connect pour
// l'Afrique). Modèle « clés propres » : chaque créateur connecte SON apikey +
// site_id CinetPay (panel marchand). On initialise le paiement avec ses clés →
// l'argent va directement sur SON compte CinetPay. Aucun payout à gérer.
//
// Doc : https://docs.cinetpay.com/api/1.0-en/checkout/initialisation
//  - init   : POST https://api-checkout.cinetpay.com/v2/payment  → data.payment_url
//  - check  : POST https://api-checkout.cinetpay.com/v2/payment/check → data.status
//  - devise : celle du compte CinetPay (XOF/XAF/CDF/GNF/USD), pas EUR.

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const API_BASE = "https://api-checkout.cinetpay.com/v2";
const UA = "AutoFunnel/1.0";

export const CINETPAY_CURRENCIES = ["XOF", "XAF", "CDF", "GNF", "USD"] as const;
export type CinetpayCurrency = (typeof CINETPAY_CURRENCIES)[number];

export function isValidCinetpayCurrency(c: string): c is CinetpayCurrency {
  return (CINETPAY_CURRENCIES as readonly string[]).includes(c.toUpperCase());
}

export type CinetpayState = {
  provider: "stripe" | "cinetpay";
  status: "none" | "active";
  siteId: string | null;
  currency: string | null;
  connected: boolean;
};

// ─── Chiffrement de l'apikey (AES-256-GCM) si CINETPAY_ENC_KEY est défini ────
// L'apikey CinetPay est un SECRET. En prod, définir CINETPAY_ENC_KEY (hex 64 ou
// passphrase). Sans clé (dev), repli en clair — à éviter en production.
function encKey(): Buffer | null {
  const raw = process.env.CINETPAY_ENC_KEY;
  if (!raw) return null;
  return /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.createHash("sha256").update(raw).digest();
}
function encryptSecret(plain: string): string {
  const key = encKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc:v1:" + Buffer.concat([iv, tag, enc]).toString("base64");
}
function decryptSecret(stored: string): string {
  if (!stored.startsWith("enc:v1:")) return stored;
  const key = encKey();
  if (!key) throw new Error("CINETPAY_ENC_KEY manquante pour déchiffrer");
  const buf = Buffer.from(stored.slice("enc:v1:".length), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

// ─── État (sans secret) ──────────────────────────────────────────────────────
export async function getCinetpayState(userId: string): Promise<CinetpayState> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("payment_provider, cinetpay_site_id, cinetpay_currency, cinetpay_status")
    .eq("user_id", userId)
    .maybeSingle();
  const status = (data?.cinetpay_status as "none" | "active") ?? "none";
  return {
    provider: (data?.payment_provider as "stripe" | "cinetpay") ?? "stripe",
    status,
    siteId: (data?.cinetpay_site_id as string | null) ?? null,
    currency: (data?.cinetpay_currency as string | null) ?? null,
    connected: status === "active",
  };
}

/** Credentials DÉCHIFFRÉS — usage SERVEUR uniquement (checkout/notify). */
export async function getCinetpayCredentials(
  userId: string,
): Promise<{ apikey: string; siteId: string; currency: string } | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("cinetpay_apikey, cinetpay_site_id, cinetpay_currency, cinetpay_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    !data ||
    data.cinetpay_status !== "active" ||
    !data.cinetpay_apikey ||
    !data.cinetpay_site_id
  ) {
    return null;
  }
  try {
    return {
      apikey: decryptSecret(data.cinetpay_apikey as string),
      siteId: data.cinetpay_site_id as string,
      currency: (data.cinetpay_currency as string) || "XOF",
    };
  } catch {
    return null;
  }
}

// ─── Validation des clés (distingue auth KO de « transaction introuvable ») ──
export async function validateCinetpayKeys(
  apikey: string,
  siteId: string,
): Promise<{ ok: boolean; reason?: "apikey" | "site_id" | "network" }> {
  try {
    const res = await fetch(`${API_BASE}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        apikey,
        site_id: siteId,
        transaction_id: "ff-validate-" + Date.now(),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: string | number;
      message?: string;
    };
    const code = String(json?.code ?? "");
    const msg = String(json?.message ?? "");
    if (code === "609" || /AUTH_NOT_FOUND/i.test(msg)) return { ok: false, reason: "apikey" };
    if (code === "613" || /SITE_ID/i.test(msg)) return { ok: false, reason: "site_id" };
    // Tout autre retour (ex. transaction inexistante) = clés valides.
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// ─── Connexion / déconnexion ─────────────────────────────────────────────────
export async function connectCinetpay(
  userId: string,
  apikey: string,
  siteId: string,
  currency: string,
): Promise<{ ok: boolean; reason?: "apikey" | "site_id" | "network" }> {
  const valid = await validateCinetpayKeys(apikey, siteId);
  if (!valid.ok) return valid;
  const cur = currency.toUpperCase();
  const admin = getSupabaseAdmin();
  await admin
    .from("profiles")
    .update({
      payment_provider: "cinetpay",
      cinetpay_apikey: encryptSecret(apikey),
      cinetpay_site_id: siteId,
      cinetpay_currency: isValidCinetpayCurrency(cur) ? cur : "XOF",
      cinetpay_status: "active",
    })
    .eq("user_id", userId);
  return { ok: true };
}

export async function disconnectCinetpay(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from("profiles")
    .update({
      cinetpay_apikey: null,
      cinetpay_site_id: null,
      cinetpay_status: "none",
      payment_provider: "stripe",
    })
    .eq("user_id", userId);
}

// ─── Init paiement ───────────────────────────────────────────────────────────
function sanitizeDesc(s: string): string {
  return (s || "Paiement").replace(/[#/$_&]/g, " ").trim().slice(0, 180);
}

export async function initCinetpayPayment(params: {
  apikey: string;
  siteId: string;
  currency: string;
  transactionId: string;
  amount: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  customer?: { name?: string; surname?: string; email?: string; phone?: string };
  metadata?: string;
}): Promise<{ ok: boolean; paymentUrl?: string; error?: string }> {
  // amount entier, multiple de 5 (sauf USD).
  let amount = Math.round(params.amount);
  if (params.currency.toUpperCase() !== "USD") amount = Math.round(amount / 5) * 5;
  if (amount < 5) amount = 5;

  const body = {
    apikey: params.apikey,
    site_id: params.siteId,
    transaction_id: params.transactionId,
    amount,
    currency: params.currency.toUpperCase(),
    description: sanitizeDesc(params.description),
    notify_url: params.notifyUrl,
    return_url: params.returnUrl,
    channels: "ALL",
    lang: "fr",
    metadata: params.metadata ?? "",
    customer_name: params.customer?.name || "Client",
    customer_surname: params.customer?.surname || "",
    customer_email: params.customer?.email || "",
    customer_phone_number: params.customer?.phone || "",
  };

  try {
    const res = await fetch(`${API_BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: string | number;
      message?: string;
      description?: string;
      data?: { payment_url?: string };
    };
    if (String(json?.code) === "201" && json?.data?.payment_url) {
      return { ok: true, paymentUrl: json.data.payment_url };
    }
    return { ok: false, error: json?.description || json?.message || "init_failed" };
  } catch {
    return { ok: false, error: "network" };
  }
}

// ─── Vérification statut ─────────────────────────────────────────────────────
export async function checkCinetpayPayment(
  apikey: string,
  siteId: string,
  transactionId: string,
): Promise<{ paid: boolean; status: string; amount?: number; currency?: string }> {
  try {
    const res = await fetch(`${API_BASE}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ apikey, site_id: siteId, transaction_id: transactionId }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: string;
      data?: { status?: string; amount?: number; currency?: string };
    };
    const status = String(json?.data?.status ?? json?.message ?? "UNKNOWN");
    return {
      paid: status === "ACCEPTED",
      status,
      amount: json?.data?.amount,
      currency: json?.data?.currency,
    };
  } catch {
    return { paid: false, status: "ERROR" };
  }
}
