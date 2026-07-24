// app/api/admin/users/route.ts — GET : liste paginée des utilisateurs.
// 🆕 MODULE 4 — Réservé aux admins (voir lib/admin/auth.ts).
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAdminUsers } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") ?? undefined;
  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const limit = Number(searchParams.get("limit") ?? "50") || 50;

  try {
    const admin = getSupabaseAdmin();
    const { users, total } = await listAdminUsers(admin, { search, offset, limit });
    return NextResponse.json({ ok: true, users, total });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 },
    );
  }
}
