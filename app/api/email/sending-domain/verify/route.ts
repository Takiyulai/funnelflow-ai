// app/api/email/sending-domain/verify/route.ts
// 🆕 Relance la vérification DNS chez Resend et rafraîchit l'état local.
//
// Appelé par le bouton « Vérifier maintenant ». La propagation DNS prend de
// quelques minutes à plusieurs heures selon le registrar : l'utilisateur
// rejoue simplement cette action jusqu'à ce que le statut passe au vert.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/billing/subscription";
import { refreshSendingDomain, SendingDomainError } from "@/lib/email/sendingDomain";

export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const access = await getAccess(user.id);
  if (!access.limits.customSendingDomain) {
    return NextResponse.json(
      {
        ok: false,
        error: "plan_required",
        message: "Le domaine d'envoi personnalisé est inclus à partir du plan Pro.",
      },
      { status: 403 },
    );
  }

  try {
    const state = await refreshSendingDomain(user.id);
    return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SendingDomainError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: 400 });
    }
    console.error("[sending-domain/verify]", e);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}
