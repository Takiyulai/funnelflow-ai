import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Period changes only fetch aggregates, never the funnel's pages or media. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  if (![7, 30, 90].includes(days)) {
    return NextResponse.json({ ok: false, message: "Période invalide." }, { status: 400 });
  }
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { data: funnel, error } = await sb.from("funnels").select("id")
      .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const result = await sb.rpc("funnel_stats_v1", { p_funnel_id: id, p_since: since })
      .abortSignal(request.signal);
    if (result.error || !result.data) throw result.error ?? new Error("empty_stats");
    return NextResponse.json({ ok: true, stats: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[funnel-stats] lecture échouée :", error);
    return NextResponse.json({ ok: false, message: "Statistiques indisponibles. Réessaie dans un instant." },
      { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
