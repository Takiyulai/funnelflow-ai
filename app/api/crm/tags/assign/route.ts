// app/api/crm/tags/assign/route.ts
// POST → ajoute/retire des tags à un ou plusieurs contacts (sélection + masse).
// Body : { contactIds: string[], tagIds: string[], action: "add" | "remove" }
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assignTagsToContacts, removeTagsFromContacts } from "@/lib/crm/tags";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const contactIds: string[] = Array.isArray(body?.contactIds) ? body.contactIds : [];
  const tagIds: string[] = Array.isArray(body?.tagIds) ? body.tagIds : [];
  const action: "add" | "remove" = body?.action === "remove" ? "remove" : "add";

  if (contactIds.length === 0 || tagIds.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_ids" }, { status: 400 });
  }

  try {
    if (action === "remove") {
      await removeTagsFromContacts(sb, user.id, contactIds, tagIds);
    } else {
      await assignTagsToContacts(sb, user.id, contactIds, tagIds);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "assign_failed" },
      { status: 500 },
    );
  }
}
