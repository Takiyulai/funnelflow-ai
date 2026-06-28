// app/api/crm/tags/assign/route.ts
// POST → ajoute/retire des tags à un ou plusieurs contacts (sélection + masse).
// Body : { contactIds: string[], tagIds: string[], action: "add" | "remove" }
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assignTagsToContacts, removeTagsFromContacts } from "@/lib/crm/tags";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runWorkflowsForEvent } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";

// 🆕 Exécute les workflows déclenchés par "tag.added". Best-effort : toute erreur
// est avalée pour ne jamais faire échouer l'assignation. Branché AU NIVEAU ROUTE
// (action utilisateur explicite) : l'action `add_tag` du moteur passe par le
// service `assignTagsToContacts`, pas par cette route → aucune boucle possible.
async function fireTagAddedWorkflows(
  userId: string,
  contactIds: string[],
  tagIds: string[],
): Promise<void> {
  // Garde latence : on n'exécute pas les workflows sur une assignation de masse.
  if (contactIds.length * tagIds.length > 50) return;
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("leads")
      .select("id, email, name")
      .eq("user_id", userId)
      .in("id", contactIds);
    const leads = (data ?? []) as Array<{ id: string; email: string; name: string | null }>;
    for (const lead of leads) {
      for (const tagId of tagIds) {
        await runWorkflowsForEvent(admin, userId, {
          event: "tag.added",
          lead: { id: lead.id, email: lead.email, name: lead.name },
          tagId,
        });
      }
    }
  } catch (e) {
    console.warn("[workflows] hook tag.added échoué (non bloquant):", e);
  }
}

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
      // 🆕 Déclencheur workflow "tag.added" (best-effort, non bloquant).
      await fireTagAddedWorkflows(user.id, contactIds, tagIds);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "assign_failed" },
      { status: 500 },
    );
  }
}
