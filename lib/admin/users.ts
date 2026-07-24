// lib/admin/users.ts
// 🆕 MODULE 4 — Accès aux données utilisateurs pour le dashboard admin.
// Utilise TOUJOURS le client service_role (getSupabaseAdmin) car il doit
// pouvoir lire/modifier TOUS les comptes, pas seulement celui de l'appelant —
// l'autorisation (est-ce un admin ?) a déjà été vérifiée en amont par
// `requireAdminPage`/`requireAdminApi` (lib/admin/auth.ts) AVANT d'appeler
// quoi que ce soit ici. Ne jamais appeler ces fonctions sans ce garde-fou.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  license_status: string | null;
  license_expires_at: string | null;
};

export type AdminUserDetail = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    plan: string;
    language: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  };
  license: {
    license_key: string;
    status: string;
    plan: string;
    expires_at: string | null;
    last_checked_at: string | null;
  } | null;
  profile: {
    status: string;
    current_period_end: string | null;
    payment_provider: string;
    cinetpay_status: string;
  } | null;
};

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export async function listAdminUsers(
  admin: SupabaseClient,
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ users: AdminUserRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
  const offset = opts.offset ?? 0;

  let query = admin
    .from("users")
    .select("id, email, full_name, plan, is_active, last_login_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const search = opts.search?.trim();
  if (search) {
    const safe = search.replace(/[%,]/g, "");
    query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Omit<AdminUserRow, "license_status" | "license_expires_at">[];
  const ids = rows.map((u) => u.id);

  const licenseByUser = new Map<string, { status: string; expires_at: string | null }>();
  if (ids.length > 0) {
    const { data: licenses } = await admin
      .from("user_licenses")
      .select("user_id, status, expires_at")
      .in("user_id", ids);
    for (const l of (licenses ?? []) as { user_id: string; status: string; expires_at: string | null }[]) {
      licenseByUser.set(l.user_id, { status: l.status, expires_at: l.expires_at });
    }
  }

  return {
    users: rows.map((u) => ({
      ...u,
      license_status: licenseByUser.get(u.id)?.status ?? null,
      license_expires_at: licenseByUser.get(u.id)?.expires_at ?? null,
    })),
    total: count ?? rows.length,
  };
}

export async function getAdminUserDetail(
  admin: SupabaseClient,
  id: string,
): Promise<AdminUserDetail | null> {
  const { data: user, error } = await admin
    .from("users")
    .select(
      "id, email, full_name, avatar_url, plan, language, is_active, last_login_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!user) return null;

  const { data: license } = await admin
    .from("user_licenses")
    .select("license_key, status, plan, expires_at, last_checked_at")
    .eq("user_id", id)
    .maybeSingle();

  const { data: profile } = await admin
    .from("profiles")
    .select("status, current_period_end, payment_provider, cinetpay_status")
    .eq("user_id", id)
    .maybeSingle();

  return {
    user: user as AdminUserDetail["user"],
    license: (license as AdminUserDetail["license"]) ?? null,
    profile: (profile as AdminUserDetail["profile"]) ?? null,
  };
}

export type AdminUserPatch = {
  plan?: string;
  license_status?: "active" | "expired" | "revoked" | "invalid";
  license_expires_at?: string | null;
};

/** Édition NON destructive (plan + statut de licence). Pour désactiver un
 *  compte, utiliser `setUserActive` (action séparée, avec confirmation
 *  requise côté UI car elle bloque réellement la connexion). */
export async function updateAdminUser(
  admin: SupabaseClient,
  id: string,
  patch: AdminUserPatch,
): Promise<void> {
  if (patch.plan !== undefined) {
    const { error } = await admin.from("users").update({ plan: patch.plan }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (patch.license_status !== undefined || patch.license_expires_at !== undefined) {
    // user_licenses.user_id est clé primaire → au plus une ligne par utilisateur.
    const { data: existing } = await admin
      .from("user_licenses")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();

    const licensePatch: Record<string, unknown> = {};
    if (patch.license_status !== undefined) licensePatch.status = patch.license_status;
    if (patch.license_expires_at !== undefined) licensePatch.expires_at = patch.license_expires_at;

    if (existing) {
      const { error } = await admin.from("user_licenses").update(licensePatch).eq("user_id", id);
      if (error) throw new Error(error.message);
    } else {
      // Aucune licence existante (ex. compte jamais passé par CinetPay) : on en
      // crée une manuellement — nécessite une license_key unique.
      const { error } = await admin.from("user_licenses").insert({
        user_id: id,
        license_key: `manual_${id}`,
        status: patch.license_status ?? "active",
        plan: patch.plan ?? "starter",
        expires_at: patch.license_expires_at ?? null,
      });
      if (error) throw new Error(error.message);
    }
  }
}

/**
 * Active/désactive un compte : met à jour `users.is_active` ET bannit/débannit
 * le compte côté Supabase Auth (sans le bannissement Auth, l'utilisateur
 * pourrait continuer à obtenir des sessions valides malgré is_active=false).
 * Action DESTRUCTIVE — la confirmation utilisateur doit être faite côté UI
 * avant l'appel.
 */
export async function setUserActive(admin: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await admin.from("users").update({ is_active: active }).eq("id", id);
  if (error) throw new Error(error.message);

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h", // ~100 ans ≈ permanent tant que non réactivé
  });
  if (authError) throw new Error(authError.message);
}
