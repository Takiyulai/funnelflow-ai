// app/api/connect/disconnect/route.ts
//
// Déconnecte le compte Stripe Connect du créateur (oublie la référence côté
// AutoFunnel). Les paiements sont désactivés jusqu'à une nouvelle connexion.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectConnectAccount, getConnectState } from "@/lib/billing/connect";

export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await disconnectConnectAccount(user.id);
    const state = await getConnectState(user.id);
    return NextResponse.json({ ok: true, state }, { status: 200 });
  } catch (e) {
    console.error("[api/connect/disconnect] error", e);
    return NextResponse.json(
      { ok: false, error: "disconnect_failed" },
      { status: 500 },
    );
  }
}
