// app/api/admin/templates/[id]/route.ts
//
// 🆕 Suppression d'un modèle partagé de la Galerie communautaire, réservée aux
// administrateurs.
//
// POURQUOI CETTE ROUTE EXISTE. La galerie est alimentée par les utilisateurs :
// un modèle inapproprié, en double, cassé ou signalé n'avait aucun moyen d'en
// sortir. Le seul recours était une intervention en base — donc, en pratique,
// rien.
//
// 🔒 `requireAdminApi()` lit la session Supabase CÔTÉ SERVEUR et la confronte à
// l'allowlist ADMIN_EMAILS. Aucun rôle transmis par le client n'est pris en
// compte : un utilisateur normal qui appelle cette route reçoit un 403, que
// l'interface lui ait montré un bouton ou non.

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    // On lit d'abord pour pouvoir répondre 404 sur un identifiant inconnu
    // plutôt qu'un 200 trompeur — un DELETE sur une ligne absente réussit
    // silencieusement côté SQL.
    const { data: existing, error: readError } = await admin
      .from("shared_templates")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("[admin/templates] lecture", readError);
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const { error } = await admin.from("shared_templates").delete().eq("id", id);
    if (error) {
      console.error("[admin/templates] suppression", error);
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }

    // Trace volontaire : une suppression de contenu communautaire doit être
    // rattachable à un administrateur.
    console.log(
      `[admin/templates] "${existing.name}" (${id}) supprimé par ${guard.email}`,
    );

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin/templates]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
