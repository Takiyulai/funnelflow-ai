// app/api/workflows/[id]/runs/route.ts
// 🆕 Historique d'exécution d'un workflow.
//
// Répond aux deux questions qu'on se pose quand une automatisation « ne marche
// pas » :
//   1. Est-elle seulement passée pour ce contact ?
//   2. Si oui, qu'a-t-elle fait, et quelle branche a-t-elle prise ?
//
// La seconde n'avait aucune réponse possible avant ce module :
// `workflow_pending_runs` est une file d'attente, pas un journal.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // 🔒 Le workflow appartient-il bien à l'appelant ? On ne se repose pas sur la
  // seule RLS : la lecture se fait via la clé service, qui la contourne.
  const { data: wf } = await admin
    .from("workflows")
    .select("id, user_id, name")
    .eq("id", id)
    .maybeSingle();

  if (!wf || wf.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || 30),
  );
  const leadId = url.searchParams.get("leadId");

  let query = admin
    .from("workflow_runs")
    .select(
      "id, lead_id, lead_email, trigger_event, status, steps, actions_total, actions_done, error, started_at, finished_at",
    )
    .eq("workflow_id", id)
    .order("started_at", { ascending: false })
    .limit(limit);

  // Chronologie d'UN contact précis — le cas d'usage du support.
  if (leadId) query = query.eq("lead_id", leadId);

  const { data, error } = await query;
  if (error) {
    // La table peut ne pas exister si la migration n'a pas été appliquée :
    // on le dit clairement plutôt que de renvoyer une liste vide trompeuse.
    console.error("[workflows/runs] lecture échouée :", error.message);
    return NextResponse.json(
      {
        ok: false,
        error: "history_unavailable",
        hint: "La migration db/workflow-runs-history.sql a-t-elle été appliquée ?",
        detail: error.message,
      },
      { status: 500 },
    );
  }

  const runs = data ?? [];

  // Compteurs utiles au diagnostic, calculés ici plutôt que dans l'interface.
  const summary = {
    total: runs.length,
    done: runs.filter((r) => r.status === "done").length,
    failed: runs.filter((r) => r.status === "failed").length,
    running: runs.filter((r) => r.status === "running").length,
  };

  return NextResponse.json(
    { ok: true, workflow: { id: wf.id, name: wf.name }, summary, runs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
