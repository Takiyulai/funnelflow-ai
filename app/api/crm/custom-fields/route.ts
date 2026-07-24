// app/api/crm/custom-fields/route.ts — GET (liste) + POST (création).
// 🆕 MODULE 3 — Registre des champs personnalisés des leads.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCustomFieldDefs, createCustomFieldDef } from "@/lib/crm/customFields";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const fields = await listCustomFieldDefs(sb, user.id);
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ ok: false, error: "label_required" }, { status: 400 });
  }
  try {
    const field = await createCustomFieldDef(sb, user.id, body.label);
    return NextResponse.json({ ok: true, field }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
