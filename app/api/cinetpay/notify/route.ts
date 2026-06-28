// app/api/cinetpay/notify/route.ts
//
// notify_url de CinetPay. CinetPay NE transmet PAS le statut dans la notif : on
// RE-VÉRIFIE le paiement via l'API (/payment/check) avec les clés du créateur,
// puis on marque la commande payée (même table orders, mêmes stats dashboard).
// On répond toujours 200 pour éviter les re-tentatives inutiles.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getCinetpayCredentials,
  checkCinetpayPayment,
} from "@/lib/billing/cinetpay";
import {
  markOrderPaidByCinetpayTransaction,
  promoteContactToClient,
} from "@/lib/billing/orders";

export const dynamic = "force-dynamic";

async function extractTransactionId(req: Request): Promise<string> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      return String(j.transaction_id || j.cpm_trans_id || "");
    }
    const form = await req.formData();
    return String(form.get("cpm_trans_id") || form.get("transaction_id") || "");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const txnId = await extractTransactionId(req);
  if (!txnId) return NextResponse.json({ ok: true }, { status: 200 });

  const admin = getSupabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("cinetpay_transaction_id", txnId)
    .maybeSingle();
  if (!order || order.status === "paid") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const creds = await getCinetpayCredentials(order.user_id as string);
  if (!creds) return NextResponse.json({ ok: true }, { status: 200 });

  const check = await checkCinetpayPayment(creds.apikey, creds.siteId, txnId);
  if (check.paid) {
    const marked = await markOrderPaidByCinetpayTransaction(txnId, null);
    if (marked?.email) {
      try {
        await promoteContactToClient({
          userId: marked.userId,
          funnelId: marked.funnelId,
          email: marked.email,
          amount: marked.amount,
          currency: marked.currency,
        });
      } catch (e) {
        console.warn("[cinetpay/notify] promoteContactToClient échoué", e);
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// CinetPay teste parfois l'URL en GET.
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
