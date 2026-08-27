// app/api/crm/lists/route.ts — GET (liste + compteurs) + POST (création).
// 🆕 Listes de contacts : voir lib/crm/lists.ts pour la distinction avec les tags.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listContactLists, createContactList } from "@/lib/crm/lists";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const lists = await listContactLists(sb, user.id);
    return NextResponse.json({ ok: true, lists });
  } catch (e) {
    console.error("[api/crm/lists] lecture des listes échouée", e);
    return NextResponse.json(
      { ok: false, error: "read_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  try {
    const list = await createContactList(sb, user.id, {
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      // Une liste créée depuis l'interface est toujours « manuel » : seul
      // l'import a le droit de se déclarer d'origine « import ».
      origin: "manuel",
      sourceLabel: typeof body.sourceLabel === "string" ? body.sourceLabel : null,
      color: typeof body.color === "string" ? body.color : undefined,
    });
    return NextResponse.json({ ok: true, list }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create_failed";
    // 23505 = index unique sur lower(name) → nom déjà pris.
    const conflict = message.includes("23505") || message.includes("duplicate");
    if (!conflict) console.error("[api/crm/lists] création de liste échouée", e);
    return NextResponse.json(
      { ok: false, error: conflict ? "list_already_exists" : "create_failed" },
      { status: conflict ? 409 : 500 },
    );
  }
}
