import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { tutorialFromRow } from "@/lib/tutorials";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 160);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 1200);
  if (typeof body.videoUrl === "string" && /^https?:\/\//i.test(body.videoUrl)) patch.video_url = body.videoUrl.trim();
  if (body.thumbnailUrl === null || typeof body.thumbnailUrl === "string") patch.thumbnail_url = body.thumbnailUrl?.trim() || null;
  if (typeof body.sortOrder === "number") patch.sort_order = Math.trunc(body.sortOrder);
  if (typeof body.isPublished === "boolean") patch.is_published = body.isPublished;

  const { data, error } = await getSupabaseAdmin().from("tutorials").update(patch).eq("id", id)
    .select("id,title,description,video_url,thumbnail_url,sort_order,is_published,created_at").single();
  if (error) {
    console.error("[tutorials] update failed", error);
    return NextResponse.json({ ok: false, message: "Mise à jour impossible." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tutorial: tutorialFromRow(data) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const { error } = await getSupabaseAdmin().from("tutorials").delete().eq("id", id);
  if (error) {
    console.error("[tutorials] delete failed", error);
    return NextResponse.json({ ok: false, message: "Suppression impossible." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
