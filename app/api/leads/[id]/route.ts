import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  status: z.enum(["nouveau", "contacte", "qualifie", "client", "perdu"]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  // 1. Validation
  let payload: z.infer<typeof patchSchema>;
  try {
    const body = await request.json();
    payload = patchSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "validation", details: err.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // 2. Auth (RLS appliquera la sécurité : le lead doit appartenir à l'utilisateur)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 3. Update
  const { data, error } = await supabase
    .from("leads")
    .update({ status: payload.status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("[api/leads/:id PATCH] error", error);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead: data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) {
    console.error("[api/leads/:id DELETE] error", error);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
