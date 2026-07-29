// app/api/admin/users/[id]/reset-password/route.ts
// 🆕 Envoie à l'utilisateur le mail de réinitialisation de son mot de passe.
//
// 🔒 L'admin ne choisit PAS le mot de passe et ne le voit jamais : on déclenche
// exactement le même flux que le « mot de passe oublié » de la page de
// connexion, et seul le titulaire de la boîte mail peut aller au bout. Un
// endpoint qui permettrait de DÉFINIR un mot de passe donnerait à
// l'administrateur le moyen de se connecter à la place de ses clients.
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminUserDetail, sendPasswordResetEmail } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await params;

  try {
    const admin = getSupabaseAdmin();
    // On repart de l'email EN BASE, jamais d'un email fourni dans la requête :
    // sinon l'endpoint permettrait d'envoyer un lien de réinitialisation vers
    // une adresse arbitraire.
    const detail = await getAdminUserDetail(admin, id);
    if (!detail) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    await sendPasswordResetEmail(admin, detail.user.email);
    return NextResponse.json({ ok: true, email: detail.user.email });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "reset_failed" },
      { status: 500 },
    );
  }
}
