// app/api/crm/lists/assign/route.ts
// 🆕 Ajout / retrait en lot de contacts dans une ou plusieurs listes.
// Calqué sur /api/crm/tags/assign : même contrat ({ contactIds, listIds, action }).
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addContactsToLists, removeContactsFromLists } from "@/lib/crm/lists";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const contactIds = Array.isArray(body?.contactIds)
    ? (body.contactIds as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const listIds = Array.isArray(body?.listIds)
    ? (body.listIds as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  if (contactIds.length === 0 || listIds.length === 0) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const action = body?.action === "remove" ? "remove" : "add";

  try {
    // La RLS garantit qu'on ne touche que les lignes de l'appelant : un id de
    // contact ou de liste appartenant à un autre compte est simplement ignoré
    // par Postgres, il n'y a rien à revérifier ici.
    if (action === "remove") {
      await removeContactsFromLists(sb, user.id, contactIds, listIds);
    } else {
      await addContactsToLists(sb, user.id, contactIds, listIds);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "assign_failed" },
      { status: 500 },
    );
  }
}
