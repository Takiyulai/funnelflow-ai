// app/api/templates/gallery/route.ts
// 🆕 Liste PUBLIQUE des modèles approuvés de la Galerie communautaire.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("shared_templates")
      .select(
        "id, owner_name, name, description, funnel_kind, language, thumbnail_url, usage_count, like_count, featured, created_at",
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, templates: [] });
    }

    // 🆕 Mise en avant : les modèles À LA UNE d'abord, puis un score de
    // popularité = likes + utilisations (les plus aimés ET utilisés remontent),
    // puis les plus récents. On trie en mémoire pour combiner likes + usages.
    type Row = {
      usage_count?: number | null;
      like_count?: number | null;
      featured?: boolean | null;
      created_at?: string | null;
    };
    const score = (r: Row) => (r.like_count ?? 0) + (r.usage_count ?? 0);
    const templates = (data ?? [])
      .slice()
      .sort((a: Row, b: Row) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        const s = score(b) - score(a);
        if (s !== 0) return s;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      })
      .slice(0, 60);

    return NextResponse.json(
      { ok: true, templates },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ ok: false, templates: [] });
  }
}
