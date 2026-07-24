// app/api/admin/users/[id]/active/route.ts — POST : active/désactive un compte.
// 🆕 MODULE 4 — Action DESTRUCTIVE isolée dans sa propre route pour que la
// confirmation utilisateur côté UI (ConfirmDialog) soit sans ambiguïté sur ce
// qu'elle autorise. Désactiver bannit aussi le compte côté Supabase Auth
// (voir lib/admin/users.ts::setUserActive) — l'utilisateur ne peut plus se
// reconnecter tant qu'un admin ne le réactive pas explicitement.
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { setUserActive } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await params;

  if (id === auth.userId) {
    return NextResponse.json({ ok: false, error: "cannot_deactivate_self" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const active = body?.active;
  if (typeof active !== "boolean") {
    return NextResponse.json({ ok: false, error: "active_required" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    await setUserActive(admin, id, active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "toggle_failed" },
      { status: 500 },
    );
  }
}
