// app/api/auth/stamp-login/route.ts
// 🆕 MODULE 4 — Enregistre `users.last_login_at` pour l'utilisateur de la
// session en cours. Appelé côté client depuis le montage du tableau de bord
// (voir app/(app)/dashboard/page.tsx) plutôt que depuis le flux de connexion
// lui-même : la connexion se fait en client pur via
// `supabase.auth.signInWithPassword` (components/auth/AuthForm.tsx), qui ne
// passe par aucune route serveur à nous — le premier chargement du dashboard
// après connexion est donc le point d'accroche le plus simple et le plus
// fiable, sans toucher au flux d'auth existant.
//
// Throttlé à une écriture par fenêtre de 5 minutes pour éviter de marteler la
// base à chaque navigation interne (le dashboard peut être revisité souvent).
//
// ⚠️ RAPPEL PRODUIT : cette date de dernière connexion est visible dans le
// dashboard admin (/admin) — la politique de confidentialité (app/privacy)
// doit mentionner ce suivi.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const THROTTLE_MS = 5 * 60 * 1000;

export async function POST() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from("users")
      .select("last_login_at")
      .eq("id", user.id)
      .maybeSingle();

    const last = row?.last_login_at ? new Date(row.last_login_at).getTime() : 0;
    if (Date.now() - last < THROTTLE_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { error } = await admin
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Non bloquant pour l'utilisateur : une erreur ici ne doit jamais casser
    // le chargement du dashboard.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "stamp_failed" },
      { status: 500 },
    );
  }
}
