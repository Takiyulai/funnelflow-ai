// app/api/templates/[id]/like/route.ts
// 🆕 Like/unlike d'un modèle de la Galerie communautaire (toggle, 1 par
// utilisateur). Le compteur `like_count` sert, avec `usage_count`, à mettre en
// avant les modèles les plus appréciés. Réservé aux utilisateurs connectés.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

  // Le modèle existe-t-il ?
  const { data: tpl } = await admin
    .from("shared_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!tpl) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Toggle : déjà liké → on retire ; sinon → on ajoute.
  const { data: existing } = await admin
    .from("template_likes")
    .select("template_id")
    .eq("template_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await admin
      .from("template_likes")
      .delete()
      .eq("template_id", id)
      .eq("user_id", user.id);
    liked = false;
  } else {
    await admin
      .from("template_likes")
      .insert({ template_id: id, user_id: user.id });
    liked = true;
  }

  // Recompte fiable (évite toute dérive du compteur).
  const { count } = await admin
    .from("template_likes")
    .select("template_id", { count: "exact", head: true })
    .eq("template_id", id);
  const likeCount = count ?? 0;

  await admin.from("shared_templates").update({ like_count: likeCount }).eq("id", id);

  return NextResponse.json({ ok: true, liked, like_count: likeCount });
}
