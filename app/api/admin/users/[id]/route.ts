// app/api/admin/users/[id]/route.ts — GET (détail), PATCH (édition plan/statut).
// 🆕 MODULE 4 — Réservé aux admins (voir lib/admin/auth.ts). Ne gère PAS la
// désactivation (action distincte, volontairement séparée — voir
// app/api/admin/users/[id]/active/route.ts — car destructive et nécessitant
// une confirmation dédiée côté UI).
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getAdminUserDetail,
  updateAdminUser,
  deleteAdminUser,
  type AdminUserPatch,
} from "@/lib/admin/users";
import { isPlanId } from "@/lib/billing/plans";

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
  if (typeof body.plan === "string" && body.plan.trim()) {
    // 🆕 Le plan est validé contre la source de vérité (lib/billing/plans.ts).
    // Avant, c'était du texte libre : une faute de frappe (« Pro », « pr »)
    // était acceptée en base puis ne correspondait à aucune entrée de PLANS —
    // l'utilisateur se retrouvait silencieusement sans quotas.
    const plan = body.plan.trim().toLowerCase();
    if (!isPlanId(plan)) {
      return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
    }
    patch.plan = plan;
  }
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

/**
 * 🆕 DELETE — suppression DÉFINITIVE d'un compte.
 *
 * 🔒 Trois garde-fous, dans cet ordre :
 *   1. l'appelant est admin (requireAdminApi) ;
 *   2. il ne peut pas se supprimer lui-même — un admin qui efface son propre
 *      compte ferme la porte de l'administration derrière lui ;
 *   3. le corps de la requête doit contenir l'email EXACT du compte visé.
 *      La confirmation par saisie n'est pas qu'un artifice d'interface : elle
 *      est revérifiée ici, sinon un appel direct à l'API contournerait la
 *      boîte de dialogue.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await params;

  if (id === auth.userId) {
    return NextResponse.json({ ok: false, error: "cannot_delete_self" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const confirmEmail =
    typeof body?.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";

  try {
    const admin = getSupabaseAdmin();
    const detail = await getAdminUserDetail(admin, id);
    if (!detail) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    if (!confirmEmail || confirmEmail !== detail.user.email.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 400 });
    }

    await deleteAdminUser(admin, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 },
    );
  }
}
