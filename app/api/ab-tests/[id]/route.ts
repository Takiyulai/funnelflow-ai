// app/api/ab-tests/[id]/route.ts
// 🆕 MODULE 3 — Un test A/B : consultation, pilotage (pause / reprise / arrêt,
// répartition du trafic, édition de la variante) et suppression.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAbTest, updateAbTest, deleteAbTest, type AbTestStatus } from "@/lib/ab/tests";
import type { FunnelSection } from "@/lib/funnels/types";

export const dynamic = "force-dynamic";

const VALID_STATUS: AbTestStatus[] = ["running", "paused", "finished"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const test = await getAbTest(sb, user.id, id);
  if (!test) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, test }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  if (body.status !== undefined && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  try {
    const test = await updateAbTest(sb, user.id, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      status: body.status as AbTestStatus | undefined,
      trafficSplit: typeof body.trafficSplit === "number" ? body.trafficSplit : undefined,
      variantB: Array.isArray(body.variantB) ? (body.variantB as FunnelSection[]) : undefined,
    });
    return NextResponse.json({ ok: true, test });
  } catch (e) {
    const message = e instanceof Error ? e.message : "update_failed";
    if (message === "test_already_running") {
      return NextResponse.json(
        {
          ok: false,
          error: message,
          message: "Un autre test tourne déjà sur cette page.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    // Les événements partent en cascade avec le test : on supprime un test ET
    // ses mesures, jamais des mesures orphelines.
    await deleteAbTest(sb, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 },
    );
  }
}
