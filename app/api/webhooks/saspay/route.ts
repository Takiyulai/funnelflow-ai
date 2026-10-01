import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { processSasPayWebhook } from "@/lib/payments/saspayBilling";
import { verifySasPayWebhook } from "@/lib/payments/providers/saspay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = verifySasPayWebhook({
      rawBody,
      signature: request.headers.get("x-webhook-signature"),
      timestamp: request.headers.get("x-webhook-timestamp"),
      eventHeader: request.headers.get("x-webhook-event"),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_webhook";
    console.warn("[saspay] webhook rejected", { code });
    return NextResponse.json({ ok: false, error: "invalid_webhook" }, { status: 401 });
  }

  try {
    const result = await processSasPayWebhook(event, rawBody);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":", 1)[0] : "processing_failed";
    console.error("[saspay] webhook processing failed", { code, event: event.event });
    Sentry.captureException(error, {
      tags: { area: "payment-saspay-webhook", event: event.event },
    });
    // 5xx volontaire : SasPay pourra rejouer l'événement selon sa politique
    // documentée. Aucun secret ni payload brut n'est renvoyé.
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}
