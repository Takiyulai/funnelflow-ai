// app/api/webhooks/cinetpay/route.ts
//
// 🆕 CinetPay — notification de paiement pour l'abonnement AutoFunnel AI
// (Point 4, CRITIQUE). Active/renouvelle la licence de 30 jours UNIQUEMENT
// si toutes ces conditions sont réunies :
//   (a) le notify_token reçu correspond à celui stocké à l'initialisation
//       (lib/billing/cinetpayLicense.ts → initCinetpaySubscriptionPayment) ;
//   (b) le RE-CHECK canonique GET /v1/payment/{merchant_transaction_id}
//       confirme le succès — on ne fait JAMAIS confiance au payload reçu ici,
//       qui peut être falsifié par n'importe qui connaissant l'URL ;
//   (c) le statut renvoyé par ce re-check est exactement code=100 / SUCCESS ;
//   (d) idempotence : une transaction déjà marquée 'success' n'est jamais
//       ré-activée (évite double-traitement si CinetPay rejoue la notif) ;
//   (e) répond 200 rapidement (pas de traitement lourd/bloquant) ;
//   (f) accepte aussi GET, utilisé par CinetPay comme sonde de disponibilité.
//
// ⚠️ Toujours répondre 200 même en cas de rejet (token invalide, transaction
// inconnue, statut non-succès) : on ne doit ni déclencher de tempête de
// re-tentatives côté CinetPay, ni donner d'indice à un tiers malveillant sur
// la raison exacte du rejet (pas de 4xx différenciés ici).

import { NextResponse } from "next/server";
import {
  getCinetpayTransaction,
  checkCinetpayPaymentStatus,
  activateCinetpaySubscriptionLicense,
  markCinetpayTransactionSuccess,
  markCinetpayTransactionFailed,
} from "@/lib/billing/cinetpayLicense";

export const dynamic = "force-dynamic";

// (f) Sonde de disponibilité CinetPay.
export async function GET() {
  return NextResponse.json({ ok: true });
}

async function parseNotifyBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) out[k] = String(v ?? "");
      return out;
    }
    // Défaut : CinetPay envoie généralement en x-www-form-urlencoded.
    const text = await request.text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return out;
  } catch (e) {
    console.error("[cinetpay/webhook] parse body error", e);
    return {};
  }
}

export async function POST(request: Request) {
  const body = await parseNotifyBody(request);

  // Formes plausibles selon la notification CinetPay — on reste tolérant sur
  // les noms de champs exacts (à confirmer en sandbox avant mise en prod).
  const merchantTransactionId =
    body.merchant_transaction_id || body.transaction_id || body.cpm_trans_id || "";
  const receivedToken = body.notify_token || body.token || body["x-token"] || "";

  if (!merchantTransactionId) {
    // Rien à traiter — on répond 200 pour ne pas provoquer de re-tentatives.
    return NextResponse.json({ ok: true });
  }

  const tx = await getCinetpayTransaction(merchantTransactionId);
  if (!tx) {
    console.warn("[cinetpay/webhook] transaction inconnue", merchantTransactionId);
    return NextResponse.json({ ok: true });
  }

  // (d) Idempotence : déjà traitée avec succès → ne rien refaire.
  if (tx.status === "success") {
    return NextResponse.json({ ok: true });
  }

  // (a) Vérification du notify_token AVANT tout appel réseau supplémentaire.
  if (!tx.notify_token || !receivedToken || receivedToken !== tx.notify_token) {
    console.warn(
      "[cinetpay/webhook] notify_token invalide ou manquant",
      merchantTransactionId,
    );
    return NextResponse.json({ ok: true });
  }

  // (b)(c) Re-check canonique — seule source de vérité pour l'activation.
  const statusCheck = await checkCinetpayPaymentStatus(merchantTransactionId);

  if (!statusCheck.ok || !statusCheck.success) {
    await markCinetpayTransactionFailed(merchantTransactionId);
    return NextResponse.json({ ok: true });
  }

  const activation = await activateCinetpaySubscriptionLicense({
    userId: tx.user_id,
    planId: tx.plan_id,
    merchantTransactionId,
  });
  if (!activation.ok) {
    console.error(
      "[cinetpay/webhook] activation licence échouée",
      merchantTransactionId,
      activation.error,
    );
    // Ne PAS marquer 'failed' ici : le paiement a bien réussi côté CinetPay,
    // seule l'écriture locale a échoué (à corriger manuellement/relance) —
    // marquer 'failed' induirait le support en erreur (le client a payé).
    return NextResponse.json({ ok: true });
  }

  await markCinetpayTransactionSuccess(
    merchantTransactionId,
    statusCheck.cinetpayTransactionId,
  );

  return NextResponse.json({ ok: true });
}
