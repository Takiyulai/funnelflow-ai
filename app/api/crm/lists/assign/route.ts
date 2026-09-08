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
    ? [...new Set((body.contactIds as unknown[]).filter((v): v is string => typeof v === "string"))]
    : [];
  const listIds = Array.isArray(body?.listIds)
    ? [...new Set((body.listIds as unknown[]).filter((v): v is string => typeof v === "string"))]
    : [];

  if (contactIds.length === 0 || listIds.length === 0) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  if (contactIds.length > 500 || listIds.length > 50 || contactIds.length * listIds.length > 5000) {
    return NextResponse.json({ ok: false, error: "too_many_ids" }, { status: 400 });
  }

  const action = body?.action === "remove" ? "remove" : "add";

  try {
    // La RLS de la table de liaison filtre son `user_id`, mais ne prouve pas à
    // elle seule la propriété des deux clés étrangères. On valide donc les
    // contacts ET les listes avant toute création de liaison.
    const [contactsResult, listsResult] = await Promise.all([
      sb.from("leads").select("id").eq("user_id", user.id).in("id", contactIds),
      sb.from("crm_lists").select("id").eq("user_id", user.id).in("id", listIds),
    ]);
    if (contactsResult.error || listsResult.error) throw new Error("ownership_check_failed");
    if (
      (contactsResult.data ?? []).length !== contactIds.length ||
      (listsResult.data ?? []).length !== listIds.length
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

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
