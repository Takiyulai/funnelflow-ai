// app/api/connect/status/route.ts
//
// Renvoie l'état Connect du créateur. Par défaut, SYNCHRONISE avec Stripe
// (retrieve account) puis met à jour profiles — utile au retour d'onboarding.
// ?cached=1 → lecture rapide depuis profiles sans appel Stripe.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnectState, syncConnectStatus } from "@/lib/billing/connect";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cached = new URL(req.url).searchParams.get("cached") === "1";

  try {
    const state = cached
      ? await getConnectState(user.id)
      : process.env.STRIPE_SECRET_KEY
        ? await syncConnectStatus(user.id)
        : await getConnectState(user.id);
    return NextResponse.json({ ok: true, state }, { status: 200 });
  } catch (e) {
    console.error("[api/connect/status] error", e);
    // On retombe sur l'état stocké pour ne pas casser l'UI si Stripe est indispo.
    const state = await getConnectState(user.id);
    return NextResponse.json({ ok: true, state, degraded: true }, { status: 200 });
  }
}
