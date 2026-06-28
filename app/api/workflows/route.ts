// app/api/workflows/route.ts — GET (liste) + POST (création).
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listWorkflows, createWorkflow } from "@/lib/workflows/repository";
import { parseWorkflowInput } from "@/lib/workflows/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const workflows = await listWorkflows(sb, user.id);
    return NextResponse.json({ ok: true, workflows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    const input = parseWorkflowInput(body);
    const workflow = await createWorkflow(sb, user.id, input);
    return NextResponse.json({ ok: true, workflow }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "validation", details: e.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
