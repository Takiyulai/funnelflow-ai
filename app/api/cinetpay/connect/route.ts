// app/api/cinetpay/connect/route.ts
// Connecte le compte CinetPay du créateur (saisie apikey + site_id + devise).
// Valide les clés auprès de CinetPay avant de les stocker.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  connectCinetpay,
  getCinetpayState,
  CINETPAY_CURRENCIES,
} from "@/lib/billing/cinetpay";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  apikey: z.string().min(6).max(200),
  siteId: z.string().min(2).max(60),
  currency: z.enum(CINETPAY_CURRENCIES),
});

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const result = await connectCinetpay(
    user.id,
    payload.apikey.trim(),
    payload.siteId.trim(),
    payload.currency,
  );
  if (!result.ok) {
    const message =
      result.reason === "apikey"
        ? "L'apikey CinetPay est invalide."
        : result.reason === "site_id"
          ? "Le site_id CinetPay est invalide."
          : "Impossible de joindre CinetPay. Réessayez.";
    return NextResponse.json(
      { ok: false, error: result.reason, message },
      { status: 400 },
    );
  }

  const state = await getCinetpayState(user.id);
  return NextResponse.json({ ok: true, state }, { status: 200 });
}
