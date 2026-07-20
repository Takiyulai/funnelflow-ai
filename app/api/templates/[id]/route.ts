// app/api/templates/[id]/route.ts
// 🆕 Contenu PUBLIC d'un modèle approuvé de la Galerie communautaire, pour en
// afficher un aperçu (miniature dans la carte + aperçu plein écran). On ne
// renvoie que le contenu déjà assaini (aucune donnée perso : géré au partage).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("shared_templates")
      .select("id, name, owner_name, funnel_kind, language, content, status")
      .eq("id", id)
      .maybeSingle();

    if (error || !data || data.status !== "approved") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        id: data.id,
        name: data.name,
        owner_name: data.owner_name,
        funnel_kind: data.funnel_kind,
        language: data.language,
        content: data.content,
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
