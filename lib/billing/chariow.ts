// lib/billing/chariow.ts
//
// 🆕 Intégration Chariow — NIVEAU 1 : paywall par CLÉ DE LICENCE pour
// l'abonnement SaaS FunnelFlow/AutoFunnel (nous = vendeurs sur Chariow).
//
// Architecture (abstraction À CÔTÉ de CinetPay/Stripe, sans rien casser) :
//   - validateChariowLicense(key)  : appel API Chariow (source de vérité).
//   - getActiveChariowLicense(uid) : lit la table `user_licenses` (cache local
//     alimenté par /api/license/validate et le webhook Pulses).
//   - verifyChariowSignature(...)  : vérif HMAC des webhooks Pulses.
//
// ENV requis (serveur uniquement, JAMAIS committé) :
//   CHARIOW_API_KEY       — clé API Chariow sk_live_… (Authorization: Bearer …)
//   CHARIOW_WEBHOOK_TOKEN — token secret ajouté à l'URL du Pulse (?token=…),
//                           car les Pulses Chariow ne sont pas signés.
//   CHARIOW_LICENSE_PLAN  — plan accordé par une licence active (défaut "pro")

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isPlanId, type PlanId } from "@/lib/billing/plans";

const CHARIOW_API_BASE = "https://api.chariow.com/v1";

export type ChariowLicenseStatus = "active" | "expired" | "revoked" | "invalid";

export type ChariowLicenseCheck = {
  ok: boolean;
  status: ChariowLicenseStatus;
  /** Date d'expiration ISO si connue */
  expiresAt: string | null;
  /** Identifiant produit/offre Chariow si fourni */
  productId: string | null;
  /** Corps brut renvoyé par l'API (debug/journalisation) */
  raw?: unknown;
  error?: string;
  /**
   * 🆕 true si la licence Chariow est encore au statut `pending_activation`
   * (jamais activée) : ce N'EST PAS une licence invalide, il faut appeler
   * `activateChariowLicense()` (POST .../activate) pour la faire passer à
   * `active`. Sans cet appel, une licence toute fraîche remonte "invalid" à
   * tort côté validateChariowLicense (bug corrigé le 2026-07-03).
   */
  isPendingActivation?: boolean;
};

export type UserLicenseRow = {
  user_id: string;
  license_key: string;
  status: ChariowLicenseStatus;
  plan: PlanId;
  product_id: string | null;
  expires_at: string | null;
  last_checked_at: string | null;
};

/** Plan accordé par une licence Chariow active (configurable par env). */
export function chariowLicensePlan(): PlanId {
  const raw = process.env.CHARIOW_LICENSE_PLAN?.trim();
  return raw && isPlanId(raw) ? raw : "pro";
}

/**
 * Valide une clé de licence auprès de l'API Chariow.
 * GET https://api.chariow.com/v1/licenses/{key} (Bearer CHARIOW_API_KEY).
 * Normalise `is_active` / `is_expired` quels que soient les alias renvoyés.
 */
export async function validateChariowLicense(
  licenseKey: string,
): Promise<ChariowLicenseCheck> {
  const apiKey = process.env.CHARIOW_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: "invalid",
      expiresAt: null,
      productId: null,
      error: "missing_api_key",
    };
  }
  const key = licenseKey.trim();
  if (!key) {
    return { ok: false, status: "invalid", expiresAt: null, productId: null, error: "empty_key" };
  }

  try {
    const res = await fetch(`${CHARIOW_API_BASE}/licenses/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      return { ok: false, status: "invalid", expiresAt: null, productId: null, error: "not_found" };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "invalid",
        expiresAt: null,
        productId: null,
        error: `api_${res.status}`,
      };
    }

    const body = (await res.json()) as Record<string, unknown>;
    // L'API peut envelopper la licence dans { data: {...} } ou { license: {...} }.
    const lic = (body.data ?? body.license ?? body) as Record<string, unknown>;

    const isActive = lic.is_active === true || lic.active === true || lic.status === "active";
    const isExpired = lic.is_expired === true || lic.expired === true || lic.status === "expired";
    const isRevoked = lic.is_revoked === true || lic.revoked === true || lic.status === "revoked";
    // 🆕 Statut Chariow explicite avant toute activation (cf. doc licenses/get-license) :
    // une licence toute fraîche n'est PAS "invalid", elle attend juste sa 1ère activation.
    const isPendingActivation = lic.status === "pending_activation";

    const expiresAt =
      (typeof lic.expires_at === "string" && lic.expires_at) ||
      (typeof lic.expiry_date === "string" && lic.expiry_date) ||
      null;
    const productId =
      (typeof lic.product_id === "string" && lic.product_id) ||
      (typeof lic.product === "string" && lic.product) ||
      (lic.product && typeof lic.product === "object" && "id" in lic.product
        ? String((lic.product as { id: unknown }).id)
        : null);

    let status: ChariowLicenseStatus = "invalid";
    if (isRevoked) status = "revoked";
    else if (isExpired) status = "expired";
    else if (isActive) status = "active";

    return {
      ok: status === "active",
      status,
      expiresAt,
      productId,
      raw: body,
      isPendingActivation,
    };
  } catch (e) {
    return {
      ok: false,
      status: "invalid",
      expiresAt: null,
      productId: null,
      error: e instanceof Error ? e.message : "network_error",
    };
  }
}

/**
 * 🆕 Active une licence Chariow sur "1ère activation" — POST
 * https://api.chariow.com/v1/licenses/{key}/activate (Bearer CHARIOW_API_KEY).
 * À appeler quand `validateChariowLicense()` renvoie `isPendingActivation:
 * true` (licence jamais activée). `deviceIdentifier` (ex. l'user_id AutoFunnel)
 * est optionnel mais recommandé pour l'historique d'activations côté Chariow.
 * Le statut renvoyé reste dans les 4 valeurs stockables en base
 * (active/expired/revoked/invalid) — jamais "pending_activation" en sortie.
 */
export async function activateChariowLicense(
  licenseKey: string,
  deviceIdentifier?: string,
): Promise<ChariowLicenseCheck> {
  const apiKey = process.env.CHARIOW_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: "invalid",
      expiresAt: null,
      productId: null,
      error: "missing_api_key",
    };
  }
  const key = licenseKey.trim();
  if (!key) {
    return { ok: false, status: "invalid", expiresAt: null, productId: null, error: "empty_key" };
  }

  try {
    const res = await fetch(`${CHARIOW_API_BASE}/licenses/${encodeURIComponent(key)}/activate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(deviceIdentifier ? { device_identifier: deviceIdentifier } : {}),
      cache: "no-store",
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 404) {
      return { ok: false, status: "invalid", expiresAt: null, productId: null, error: "not_found", raw: body };
    }
    if (!res.ok) {
      // 400 : "License has been revoked" / "License has expired" /
      // "Activation limit reached" (messages exacts documentés par Chariow).
      const message = typeof body.message === "string" ? body.message : "";
      let status: ChariowLicenseStatus = "invalid";
      let error = message || `api_${res.status}`;
      if (/revoked/i.test(message)) status = "revoked";
      else if (/expired/i.test(message)) status = "expired";
      else if (/limit/i.test(message)) error = "limit_reached";
      return { ok: false, status, expiresAt: null, productId: null, error, raw: body };
    }

    const lic = (body.data ?? body) as Record<string, unknown>;
    const isActive = lic.is_active === true || lic.status === "active";
    const expiresAt = typeof lic.expires_at === "string" ? lic.expires_at : null;
    const productId =
      (typeof lic.product_id === "string" && lic.product_id) ||
      (lic.product && typeof lic.product === "object" && "id" in lic.product
        ? String((lic.product as { id: unknown }).id)
        : null);

    return {
      ok: isActive,
      status: isActive ? "active" : "invalid",
      expiresAt,
      productId,
      raw: body,
    };
  } catch (e) {
    return {
      ok: false,
      status: "invalid",
      expiresAt: null,
      productId: null,
      error: e instanceof Error ? e.message : "network_error",
    };
  }
}

/** Upsert (service role) d'une licence utilisateur dans `user_licenses`. */
export async function upsertUserLicense(input: {
  userId: string;
  licenseKey: string;
  status: ChariowLicenseStatus;
  expiresAt?: string | null;
  productId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("user_licenses").upsert(
    {
      user_id: input.userId,
      license_key: input.licenseKey.trim(),
      status: input.status,
      plan: chariowLicensePlan(),
      product_id: input.productId ?? null,
      expires_at: input.expiresAt ?? null,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[chariow] upsertUserLicense error", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Licence Chariow ACTIVE d'un utilisateur (lecture locale `user_licenses`).
 * Une licence expirée côté date est considérée inactive même si status=active
 * (filet de sécurité si le webhook d'expiration n'est pas passé).
 */
export async function getActiveChariowLicense(
  userId: string,
): Promise<UserLicenseRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("user_licenses")
    .select("user_id, license_key, status, plan, product_id, expires_at, last_checked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[chariow] getActiveChariowLicense error", error);
    return null;
  }
  if (!data || data.status !== "active") return null;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) {
    return null;
  }
  return {
    user_id: data.user_id as string,
    license_key: data.license_key as string,
    status: data.status as ChariowLicenseStatus,
    plan: isPlanId(data.plan) ? (data.plan as PlanId) : chariowLicensePlan(),
    product_id: (data.product_id as string | null) ?? null,
    expires_at: (data.expires_at as string | null) ?? null,
    last_checked_at: (data.last_checked_at as string | null) ?? null,
  };
}

/** Marque expirée/révoquée une licence par sa clé (webhook Pulses). */
export async function markLicenseByKey(
  licenseKey: string,
  status: Extract<ChariowLicenseStatus, "expired" | "revoked" | "active">,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("user_licenses")
    .update({ status, last_checked_at: new Date().toISOString() })
    .eq("license_key", licenseKey.trim());
  if (error) console.error("[chariow] markLicenseByKey error", error);
}
