// app/api/admin/is-admin/route.ts
// 🆕 Permet à un composant CLIENT (Sidebar) de savoir s'il doit afficher le
// raccourci « Administration » — sans jamais faire la vérification côté
// client. Le check réel (allowlist ADMIN_EMAILS) est fait ici, côté serveur,
// à partir de la session ; le client ne fait qu'afficher/masquer un lien en
// fonction de la réponse. Aucune donnée sensible n'est renvoyée (juste un
// booléen pour l'utilisateur de la session en cours) — et de toute façon la
// route /admin elle-même revérifie indépendamment via requireAdminPage.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return NextResponse.json({ ok: true, isAdmin: isAdminEmail(user?.email) });
}
