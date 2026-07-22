// app/api/account/delete/route.ts
//
// 🆕 RGPD (audit #2) — Droit à l'effacement : suppression DÉFINITIVE du compte
// de l'utilisateur connecté et de TOUTES ses données. Action irréversible,
// déclenchée UNIQUEMENT par l'utilisateur lui-même (auth requise) avec une
// confirmation explicite. Best-effort table par table : on continue même si
// une suppression échoue, puis on supprime le compte auth en dernier.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Tables possédées par l'utilisateur, clé = user_id (ordre sans importance :
// on utilise le service role, RLS contournée, et les FK gèrent le reste).
const USER_TABLES = [
  "email_events",
  "crm_email_sends",
  "crm_contact_tags",
  "crm_sequence_emails",
  "crm_sequences",
  "sequence_emails",
  "email_sequences",
  "crm_campaigns",
  "crm_segments",
  "crm_tags",
  "scheduled_emails",
  "workflow_pending_runs",
  "workflow_steps",
  "workflows",
  "funnel_visits",
  "section_images",
  "funnel_sections",
  "leads",
  "funnels",
  "orders",
  "exports",
  "brand_assets",
  "cinetpay_license_transactions",
  "user_licenses",
  "usage_counters",
  "templates",
] as const;

/** Supprime les médias Storage de l'utilisateur (best-effort). */
async function deleteUserStorage(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const buckets = ["cloned-funnels-media"];
  for (const bucket of buckets) {
    try {
      const { data } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      // Les fichiers sont sous <userId>/<funnelId>/<file> : on liste récursivement
      // les sous-dossiers puis on supprime les fichiers trouvés.
      const paths: string[] = [];
      for (const entry of data ?? []) {
        const sub = await admin.storage.from(bucket).list(`${userId}/${entry.name}`, { limit: 1000 });
        for (const f of sub.data ?? []) paths.push(`${userId}/${entry.name}/${f.name}`);
      }
      if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
    } catch (e) {
      console.warn(`[account/delete] storage ${bucket} nettoyage échoué`, e);
    }
  }
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Confirmation explicite obligatoire (anti-suppression accidentelle/CSRF).
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "SUPPRIMER") {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: 'Renvoie { "confirm": "SUPPRIMER" }.' },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const userId = user.id;
  const errors: string[] = [];

  // 1) Données possédées (par user_id).
  for (const table of USER_TABLES) {
    try {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) errors.push(`${table}: ${error.message}`);
    } catch (e) {
      errors.push(`${table}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  // 2) Cas particuliers (clé différente de user_id).
  try {
    await admin.from("template_likes").delete().eq("user_id", userId);
  } catch (e) {
    errors.push(`template_likes: ${e instanceof Error ? e.message : "unknown"}`);
  }
  try {
    await admin.from("shared_templates").delete().eq("owner_id", userId);
  } catch (e) {
    errors.push(`shared_templates: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // 3) Médias Storage.
  await deleteUserStorage(admin, userId);

  // 4) Profil.
  try {
    await admin.from("profiles").delete().eq("user_id", userId);
  } catch (e) {
    errors.push(`profiles: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // 5) Compte d'authentification (EN DERNIER — irréversible).
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[account/delete] deleteUser échoué", error);
      return NextResponse.json(
        { ok: false, error: "auth_delete_failed", message: error.message, dataErrors: errors },
        { status: 500 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "auth_delete_failed", message: e instanceof Error ? e.message : "unknown", dataErrors: errors },
      { status: 500 },
    );
  }

  // Déconnexion best-effort (le compte n'existe plus).
  try {
    await sb.auth.signOut();
  } catch {
    /* non bloquant */
  }

  return NextResponse.json({ ok: true, deleted: true, dataErrors: errors.length ? errors : undefined });
}
