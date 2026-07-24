// app/api/admin/users/[id]/route.ts — GET (détail), PATCH (édition plan/statut).
// 🆕 MODULE 4 — Réservé aux admins (voir lib/admin/auth.ts). Ne gère PAS la
// désactivation (action distincte, volontairement séparée — voir
// app/api/admin/users/[id]/active/route.ts — car destructive et nécessitant
// une confirmation dédiée côté UI).
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminUserDetail, updateAdminUser, type AdminUserPatch } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

const VALID_LICENSE_STATUSES = ["active", "expired", "revoked", "invalid"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await params;

  try {
    const admin = getSupabaseAdmin();
    const detail = await getAdminUserDetail(admin, id);
    if (!detail) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "detail_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const patch: AdminUserPatch = {};
  if (typeof body.plan === "string" && body.plan.trim()) patch.plan = body.plan.trim();
  if (body.license_status !== undefined) {
    if (!VALID_LICENSE_STATUSES.includes(body.license_status)) {
      return NextResponse.json({ ok: false, error: "invalid_license_status" }, { status: 400 });
    }
    patch.license_status = body.license_status;
  }
  if (body.license_expires_at !== undefined) {
    patch.license_expires_at =
      typeof body.license_expires_at === "string" && body.license_expires_at ? body.license_expires_at : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    await updateAdminUser(admin, id, patch);
    const detail = await getAdminUserDetail(admin, id);
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update_failed" },
      { status: 500 },
    );
  }
}
