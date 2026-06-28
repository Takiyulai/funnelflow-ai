// app/api/workflows/[id]/route.ts — GET (détail) + PUT (mise à jour) + DELETE.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from "@/lib/workflows/repository";
import { parseWorkflowInput } from "@/lib/workflows/validate";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
  try {
    const workflow = await getWorkflow(sb, id);
    if (!workflow) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, workflow });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "get_failed" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
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
  // RLS : getWorkflow ne renvoie que les workflows du propriétaire.
  const existing = await getWorkflow(sb, id).catch(() => null);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  try {
    const input = parseWorkflowInput(body);
    const workflow = await updateWorkflow(sb, id, input);
    return NextResponse.json({ ok: true, workflow });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "validation", details: e.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update_failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
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
  try {
    await deleteWorkflow(sb, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 },
    );
  }
}
