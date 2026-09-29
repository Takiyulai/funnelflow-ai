import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ShareRow = {
  id: string;
  owner_user_id: string;
  grantee_user_id: string;
  permission: "read_only";
  created_at: string;
};

type UserSummary = {
  id: string;
  email: string;
  full_name: string | null;
};

async function requireUser() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

export async function GET() {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb
    .from("crm_data_shares")
    .select("id,owner_user_id,grantee_user_id,permission,created_at")
    .or(`owner_user_id.eq.${user.id},grantee_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[crm/shares] lecture impossible", error);
    return NextResponse.json(
      { ok: false, message: "Le partage CRM est momentanément indisponible." },
      { status: 503 },
    );
  }

  const rows = (data ?? []) as ShareRow[];
  const userIds = [...new Set(rows.flatMap((row) => [row.owner_user_id, row.grantee_user_id]))];
  const admin = getSupabaseAdmin();
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("users").select("id,email,full_name").in("id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    console.error("[crm/shares] profils indisponibles", profilesError);
    return NextResponse.json(
      { ok: false, message: "Le partage CRM est momentanément indisponible." },
      { status: 503 },
    );
  }

  const byId = new Map(((profiles ?? []) as UserSummary[]).map((profile) => [profile.id, profile]));
  const serialize = (row: ShareRow) => ({
    id: row.id,
    permission: row.permission,
    createdAt: row.created_at,
    owner: byId.get(row.owner_user_id) ?? null,
    grantee: byId.get(row.grantee_user_id) ?? null,
  });

  return NextResponse.json({
    ok: true,
    granted: rows.filter((row) => row.owner_user_id === user.id).map(serialize),
    received: rows.filter((row) => row.grantee_user_id === user.id).map(serialize),
  });
}

export async function POST(request: NextRequest) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { ok: false, message: "Saisissez l’adresse email valide d’un utilisateur AutoFunnel AI." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: grantee, error: lookupError } = await admin
    .from("users")
    .select("id,email,is_active")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    console.error("[crm/shares] recherche destinataire impossible", lookupError);
    return NextResponse.json(
      { ok: false, message: "Le partage CRM est momentanément indisponible." },
      { status: 503 },
    );
  }
  if (!grantee || grantee.is_active === false || grantee.id === user.id) {
    return NextResponse.json(
      { ok: false, message: "Le destinataire doit être un autre compte AutoFunnel AI actif." },
      { status: 400 },
    );
  }

  const { error } = await sb.from("crm_data_shares").insert({
    owner_user_id: user.id,
    grantee_user_id: grantee.id,
    permission: "read_only",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, message: "Ce compte dispose déjà d’un accès en lecture." },
        { status: 409 },
      );
    }
    console.error("[crm/shares] création impossible", error);
    return NextResponse.json(
      { ok: false, message: "Impossible d’activer le partage pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const shareId = new URL(request.url).searchParams.get("id")?.trim();
  if (!shareId) {
    return NextResponse.json({ ok: false, error: "share_id_required" }, { status: 400 });
  }

  const { error } = await sb
    .from("crm_data_shares")
    .delete()
    .eq("id", shareId)
    .eq("owner_user_id", user.id);

  if (error) {
    console.error("[crm/shares] révocation impossible", error);
    return NextResponse.json(
      { ok: false, message: "Impossible de révoquer cet accès pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
