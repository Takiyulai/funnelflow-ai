// app/api/cinetpay/status/route.ts
// Renvoie l'état CinetPay du créateur (sans secret).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCinetpayState } from "@/lib/billing/cinetpay";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const state = await getCinetpayState(user.id);
  return NextResponse.json({ ok: true, state }, { status: 200 });
}
