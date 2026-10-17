// app/api/crm/lists/assign/route.ts
// 🆕 Ajout / retrait en lot de contacts dans une ou plusieurs listes.
// Calqué sur /api/crm/tags/assign : même contrat ({ contactIds, listIds, action }).
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addContactsToLists, removeContactsFromLists } from "@/lib/crm/lists";
import { runWorkflowsForEvent } from "@/lib/workflows/engine";

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
      // Repère les inscriptions réellement nouvelles avant l'upsert
      // idempotent. Une réassignation identique ne doit pas redéclencher les
      // automatisations « Contact inscrit à une liste ».
      const { data: existingLinks, error: existingError } = await sb
        .from("crm_contact_lists")
        .select("contact_id, list_id")
        .eq("user_id", user.id)
        .in("contact_id", contactIds)
        .in("list_id", listIds);
      if (existingError) throw new Error(existingError.message);
      const existing = new Set(
        (existingLinks ?? []).map((row) => `${row.contact_id}:${row.list_id}`),
      );
      await addContactsToLists(sb, user.id, contactIds, listIds);

      try {
        const admin = getSupabaseAdmin();
        const { data: leads } = await admin
          .from("leads")
          .select("id, email, name")
          .eq("user_id", user.id)
          .in("id", contactIds);
        const leadById = new Map((leads ?? []).map((lead) => [lead.id as string, lead]));
        const events = contactIds.flatMap((contactId) =>
          listIds
            .filter((listId) => !existing.has(`${contactId}:${listId}`))
            .map((listId) => ({ contactId, listId })),
        );

        // Concurrence bornée : les imports en lot ne doivent pas ouvrir des
        // centaines de requêtes Supabase simultanées.
        for (let i = 0; i < events.length; i += 10) {
          await Promise.all(
            events.slice(i, i + 10).map(async ({ contactId, listId }) => {
              const lead = leadById.get(contactId);
              if (!lead) return;
              await runWorkflowsForEvent(admin, user.id, {
                event: "list.subscribed",
                lead: {
                  id: lead.id as string,
                  email: lead.email as string,
                  name: lead.name as string | null,
                },
                listId,
              });
            }),
          );
        }
      } catch (workflowError) {
        console.warn("[crm/lists/assign] workflow non bloquant :", workflowError);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "assign_failed" },
      { status: 500 },
    );
  }
}
