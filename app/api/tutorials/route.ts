import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/auth";
import { tutorialFromRow } from "@/lib/tutorials";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb
    .from("tutorials")
    .select("id,title,description,video_url,thumbnail_url,sort_order,is_published,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[tutorials] list failed", error);
    return NextResponse.json({ ok: false, message: "Les tutoriels sont momentanément indisponibles." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, tutorials: (data ?? []).map((row) => tutorialFromRow(row)) });
}

export async function POST(request: NextRequest) {
  const adminGuard = await requireAdminApi();
  if (!adminGuard.ok) return adminGuard.res;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const thumbnailUrl = typeof body.thumbnailUrl === "string" && body.thumbnailUrl.trim() ? body.thumbnailUrl.trim() : null;
  if (title.length < 2 || title.length > 160 || !/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ ok: false, error: "invalid_input", message: "Titre ou URL vidéo invalide." }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("tutorials").insert({
    title,
    description: description.slice(0, 1200),
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    sort_order: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    is_published: body.isPublished !== false,
    created_by: adminGuard.userId,
  }).select("id,title,description,video_url,thumbnail_url,sort_order,is_published,created_at").single();
  if (error) {
    console.error("[tutorials] create failed", error);
    return NextResponse.json({ ok: false, message: "Création impossible." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tutorial: tutorialFromRow(data) }, { status: 201 });
}
