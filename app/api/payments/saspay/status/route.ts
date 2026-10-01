import { NextResponse } from "next/server";
import { z } from "zod";
import { getSasPayPaymentStatusForUser } from "@/lib/payments/saspayBilling";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paymentIdSchema = z.string().uuid();

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rawPaymentId = new URL(request.url).searchParams.get("paymentId");
  const parsed = paymentIdSchema.safeParse(rawPaymentId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payment" }, { status: 400 });
  }

  try {
    const payment = await getSasPayPaymentStatusForUser(parsed.data, user.id);
    if (!payment) {
      return NextResponse.json({ ok: false, error: "payment_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...payment });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":", 1)[0] : "status_failed";
    console.error("[saspay] status reconciliation failed", {
      code,
      paymentId: parsed.data,
      userId: user.id,
    });
    return NextResponse.json({ ok: false, error: "status_unavailable" }, { status: 502 });
  }
}
