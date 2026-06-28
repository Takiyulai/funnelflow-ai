// app/api/cinetpay/disconnect/route.ts
// Déconnecte le compte CinetPay du créateur (oublie les clés, repasse en Stripe).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectCinetpay, getCinetpayState } from "@/lib/billing/cinetpay";

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
    await disconnectCinetpay(user.id);
    const state = await getCinetpayState(user.id);
    return NextResponse.json({ ok: true, state }, { status: 200 });
  } catch (e) {
    console.error("[api/cinetpay/disconnect] error", e);
    return NextResponse.json({ ok: false, error: "disconnect_failed" }, { status: 500 });
  }
}
