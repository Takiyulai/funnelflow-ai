// app/api/admin/me/route.ts
//
// 🆕 « L'utilisateur courant est-il administrateur ? »
//
// Sert UNIQUEMENT à l'affichage : montrer ou non les commandes de modération
// dans la galerie. Ce n'est PAS un contrôle d'accès — chaque route
// d'administration refait la vérification côté serveur via `requireAdminApi`.
// Un utilisateur qui forcerait `isAdmin` à true dans son navigateur verrait des
// boutons qui répondent 403.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return NextResponse.json(
      { ok: true, isAdmin: isAdminEmail(user?.email) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // En cas d'échec, on répond « pas admin » : le pire scénario est de ne pas
    // afficher un bouton, jamais d'en afficher un à tort.
    return NextResponse.json({ ok: true, isAdmin: false });
  }
}
