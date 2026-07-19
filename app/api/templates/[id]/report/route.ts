/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/templates/[id]/report/route.ts
// 🆕 Signaler un modèle de la galerie. Au-delà d'un seuil de signalements, le
// modèle passe en « pending » (masqué du public) en attendant modération.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const REPORT_HIDE_THRESHOLD = 3;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const admin = getSupabaseAdmin();
  const { data: tpl } = await admin
    .from("shared_templates")
    .select("report_count")
    .eq("id", id)
    .maybeSingle();
  if (!tpl) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const next = (tpl.report_count ?? 0) + 1;
  const patch: any = { report_count: next };
  if (next >= REPORT_HIDE_THRESHOLD) patch.status = "pending";
  await admin.from("shared_templates").update(patch).eq("id", id);

  return NextResponse.json({ ok: true });
}
