// app/api/templates/likes/route.ts
// 🆕 Ids des modèles que l'utilisateur courant a likés (pour afficher l'état
// « cœur rempli » dans la galerie). Renvoie une liste vide si non connecté.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, likedIds: [] });
  }

  // RLS : l'utilisateur ne voit que ses propres likes.
  const { data } = await sb
    .from("template_likes")
    .select("template_id")
    .eq("user_id", user.id);

  const likedIds = (data ?? []).map((r: { template_id: string }) => r.template_id);
  return NextResponse.json({ ok: true, likedIds });
}
