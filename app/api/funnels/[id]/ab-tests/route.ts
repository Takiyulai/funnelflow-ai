// app/api/funnels/[id]/ab-tests/route.ts
// 🆕 MODULE 3 — Tests A/B d'un tunnel : liste (avec résultats) et création.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAbTests, createAbTest } from "@/lib/ab/tests";
import type { FunnelSection } from "@/lib/funnels/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const tests = await listAbTests(sb, user.id, id);
    return NextResponse.json({ ok: true, tests }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "read_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.pageId !== "string" || !body.pageId) {
    return NextResponse.json({ ok: false, error: "page_required" }, { status: 400 });
  }

  // 🔒 Le tunnel doit appartenir à l'appelant. La RLS le garantirait à
  // l'insertion, mais un contrôle explicite donne un 404 lisible plutôt qu'une
  // erreur de contrainte incompréhensible.
  const { data: funnel } = await sb
    .from("funnels")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!funnel) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  try {
    const test = await createAbTest(sb, user.id, {
      funnelId: id,
      pageId: body.pageId,
      name: typeof body.name === "string" ? body.name : "Test A/B",
      variantB: (body.variantB ?? []) as FunnelSection[],
      trafficSplit: typeof body.trafficSplit === "number" ? body.trafficSplit : 50,
    });
    return NextResponse.json({ ok: true, test }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create_failed";
    if (message === "test_already_running") {
      return NextResponse.json(
        {
          ok: false,
          error: message,
          message: "Un test tourne déjà sur cette page. Terminez-le avant d'en lancer un autre.",
        },
        { status: 409 },
      );
    }
    if (message === "variant_b_required") {
      return NextResponse.json(
        { ok: false, error: message, message: "La variante B ne peut pas être vide." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
