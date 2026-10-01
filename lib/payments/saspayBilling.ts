import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getPlan, isPlanId, type PlanId } from "@/lib/billing/plans";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isSasPayConfigured,
  paymentIdFromSasPayDescription,
  sasPayPaymentDescription,
  sasPayProvider,
  type SasPayWebhookEvent,
} from "@/lib/payments/providers/saspay";
import type { VerifiedPayment } from "@/lib/payments/types";

export type BillingPaymentStatus =
  | "creating"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export type BillingPaymentRow = {
  id: string;
  user_id: string;
  plan_id: PlanId;
  provider: "saspay";
  amount_minor: number;
  currency: "XOF";
  status: BillingPaymentStatus;
  provider_description: string;
  provider_checkout_id: string | null;
  provider_checkout_url: string | null;
  provider_transaction_id: string | null;
  provider_transaction_reference: string | null;
  paid_at: string | null;
};

function asPaymentRow(value: unknown): BillingPaymentRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    !isPlanId(row.plan_id) ||
    row.provider !== "saspay" ||
    typeof row.amount_minor !== "number" ||
    row.currency !== "XOF" ||
    typeof row.status !== "string" ||
    typeof row.provider_description !== "string"
  ) {
    return null;
  }
  return row as unknown as BillingPaymentRow;
}

function normalizeDecimalToMinor(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  // SasPay représente même le XOF sous forme décimale (ex. "39000.00").
  return Number.isInteger(number) ? number : null;
}

export function verifiedPaymentMatchesIntent(
  payment: BillingPaymentRow,
  verified: VerifiedPayment,
): boolean {
  return (
    verified.id.length > 0 &&
    verified.status === "SUCCESS" &&
    verified.currency === payment.currency &&
    normalizeDecimalToMinor(verified.requestedAmount) === payment.amount_minor &&
    verified.description === payment.provider_description &&
    paymentIdFromSasPayDescription(verified.description) === payment.id
  );
}

async function getPaymentById(paymentId: string): Promise<BillingPaymentRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("billing_payment_intents")
    .select(
      "id, user_id, plan_id, provider, amount_minor, currency, status, provider_description, provider_checkout_id, provider_checkout_url, provider_transaction_id, provider_transaction_reference, paid_at",
    )
    .eq("id", paymentId)
    .eq("provider", "saspay")
    .maybeSingle();
  if (error) throw new Error(`payment_lookup_failed:${error.code ?? "unknown"}`);
  return asPaymentRow(data);
}

async function setPaymentStatus(
  paymentId: string,
  status: Exclude<BillingPaymentStatus, "succeeded">,
  errorCode?: string,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("billing_payment_intents")
    .update({
      status,
      last_error_code: errorCode ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .in("status", ["creating", "pending"]);
  if (error) throw new Error(`payment_update_failed:${error.code ?? "unknown"}`);
}

async function recordPendingAttemptOutcome(
  paymentId: string,
  errorCode: "provider_failed" | "provider_cancelled",
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("billing_payment_intents")
    .update({
      // Une session de checkout SasPay peut proposer un nouvel essai après
      // l'échec ou l'annulation d'une transaction. L'intention reste donc
      // réconciliable jusqu'à l'expiration/annulation de la session elle-même.
      last_error_code: errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .in("status", ["creating", "pending"]);
  if (error) throw new Error(`payment_update_failed:${error.code ?? "unknown"}`);
}

async function activateVerifiedPayment(
  payment: BillingPaymentRow,
  verified: VerifiedPayment,
): Promise<boolean> {
  if (!verifiedPaymentMatchesIntent(payment, verified)) {
    throw new Error("payment_verification_mismatch");
  }
  if (
    payment.provider_transaction_id &&
    payment.provider_transaction_id !== verified.id
  ) {
    throw new Error("provider_transaction_mismatch");
  }

  const admin = getSupabaseAdmin();
  const paidAt = verified.updatedAt ?? verified.createdAt ?? new Date().toISOString();
  const { data, error } = await admin.rpc("activate_saspay_payment", {
    p_payment_id: payment.id,
    p_provider_transaction_id: verified.id,
    p_provider_transaction_reference: verified.reference,
    p_paid_at: paidAt,
  });
  if (error) throw new Error(`payment_activation_failed:${error.code ?? "unknown"}`);
  return data === true;
}

export async function reconcileSasPayPayment(
  paymentId: string,
  knownTransactionId?: string | null,
): Promise<{ status: BillingPaymentStatus; activated: boolean }> {
  const payment = await getPaymentById(paymentId);
  if (!payment) throw new Error("payment_not_found");
  if (payment.status === "succeeded") {
    return { status: "succeeded", activated: false };
  }
  if (["failed", "cancelled", "expired"].includes(payment.status)) {
    return { status: payment.status, activated: false };
  }
  if (!payment.provider_checkout_id && !knownTransactionId) {
    return { status: payment.status, activated: false };
  }

  let transactionId = knownTransactionId ?? null;
  if (!transactionId && payment.provider_checkout_id) {
    const checkout = await sasPayProvider.getCheckoutStatus(
      payment.provider_checkout_id,
    );
    if (checkout.status === "EXPIRED") {
      await setPaymentStatus(payment.id, "expired");
      return { status: "expired", activated: false };
    }
    if (checkout.status === "CANCELLED") {
      await setPaymentStatus(payment.id, "cancelled");
      return { status: "cancelled", activated: false };
    }
    transactionId = checkout.transactionId;
    if (!transactionId || checkout.transactionStatus !== "SUCCESS") {
      return { status: "pending", activated: false };
    }
  }

  if (!transactionId) return { status: "pending", activated: false };
  const verified = await sasPayProvider.verifyPayment(transactionId);
  if (verified.status === "SUCCESS") {
    const activated = await activateVerifiedPayment(payment, verified);
    return { status: "succeeded", activated };
  }
  if (verified.status === "FAILED") {
    await recordPendingAttemptOutcome(payment.id, "provider_failed");
    return { status: "pending", activated: false };
  }
  if (verified.status === "CANCELLED") {
    await recordPendingAttemptOutcome(payment.id, "provider_cancelled");
    return { status: "pending", activated: false };
  }
  return { status: "pending", activated: false };
}

export async function createSasPayCheckout(input: {
  userId: string;
  planId: PlanId;
  customerEmail: string;
  customerName: string;
  origin: string;
}): Promise<{
  paymentId: string;
  checkoutUrl: string;
  reused: boolean;
}> {
  if (!isSasPayConfigured()) throw new Error("saspay_not_configured");
  const admin = getSupabaseAdmin();

  const { data: current } = await admin
    .from("billing_payment_intents")
    .select(
      "id, user_id, plan_id, provider, amount_minor, currency, status, provider_description, provider_checkout_id, provider_checkout_url, provider_transaction_id, provider_transaction_reference, paid_at",
    )
    .eq("user_id", input.userId)
    .eq("provider", "saspay")
    .eq("purpose", "platform_plan")
    .in("status", ["creating", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = asPaymentRow(current);
  if (existing?.provider_checkout_url) {
    if (existing.plan_id !== input.planId && existing.provider_checkout_id) {
      await sasPayProvider.cancelCheckout(existing.provider_checkout_id);
      await setPaymentStatus(existing.id, "cancelled", "plan_changed");
    } else {
      return {
        paymentId: existing.id,
        checkoutUrl: existing.provider_checkout_url,
        reused: true,
      };
    }
  } else if (existing) {
    throw new Error("checkout_creation_in_progress");
  }

  const plan = getPlan(input.planId);
  if (!Number.isSafeInteger(plan.priceXof) || plan.priceXof <= 0) {
    throw new Error("invalid_plan_amount");
  }

  const paymentId = randomUUID();
  const description = sasPayPaymentDescription(paymentId, plan.name);
  const { error: insertError } = await admin
    .from("billing_payment_intents")
    .insert({
      id: paymentId,
      user_id: input.userId,
      purpose: "platform_plan",
      plan_id: input.planId,
      provider: "saspay",
      amount_minor: plan.priceXof,
      currency: "XOF",
      status: "creating",
      provider_description: description,
    });
  if (insertError) {
    if (insertError.code === "23505") throw new Error("checkout_creation_in_progress");
    throw new Error(`payment_insert_failed:${insertError.code ?? "unknown"}`);
  }

  try {
    const returnUrl = `${input.origin}/abonnement/success?provider=saspay&payment=${paymentId}`;
    const checkout = await sasPayProvider.createCheckout({
      paymentId,
      userId: input.userId,
      planId: input.planId,
      planName: plan.name,
      amountMinor: plan.priceXof,
      currency: "XOF",
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      returnUrl,
    });

    const { error: updateError } = await admin
      .from("billing_payment_intents")
      .update({
        status: "pending",
        provider_checkout_id: checkout.id,
        provider_checkout_url: checkout.checkoutUrl,
        expires_at: checkout.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("status", "creating");
    if (updateError) throw new Error(`checkout_store_failed:${updateError.code ?? "unknown"}`);

    console.info("[saspay] checkout created", {
      paymentId,
      checkoutId: checkout.id,
      planId: input.planId,
    });
    return { paymentId, checkoutUrl: checkout.checkoutUrl, reused: false };
  } catch (error) {
    await setPaymentStatus(
      paymentId,
      "failed",
      error instanceof Error ? error.message.split(":", 1)[0] : "unknown_error",
    ).catch(() => undefined);
    throw error;
  }
}

export async function getSasPayPaymentStatusForUser(
  paymentId: string,
  userId: string,
): Promise<{ status: BillingPaymentStatus; planId: PlanId } | null> {
  const payment = await getPaymentById(paymentId);
  if (!payment || payment.user_id !== userId) return null;
  const reconciled = await reconcileSasPayPayment(paymentId);
  return { status: reconciled.status, planId: payment.plan_id };
}

function webhookEventKey(event: SasPayWebhookEvent, rawBody: string): string {
  const transactionId =
    typeof event.data.id === "string" ? event.data.id : null;
  return transactionId
    ? `${event.event}:${transactionId}`
    : `${event.event}:${createHash("sha256").update(rawBody).digest("hex")}`;
}

function sanitizedWebhookPayload(event: SasPayWebhookEvent): Record<string, unknown> {
  return {
    event: event.event,
    data: {
      id: event.data.id ?? null,
      reference: event.data.reference ?? null,
      status: event.data.status ?? null,
      amount: event.data.amount ?? null,
      currency: event.data.currency ?? null,
    },
  };
}

export async function processSasPayWebhook(
  event: SasPayWebhookEvent,
  rawBody: string,
): Promise<{ duplicate: boolean; processed: boolean }> {
  const admin = getSupabaseAdmin();
  const eventKey = webhookEventKey(event, rawBody);
  const transactionId =
    typeof event.data.id === "string" ? event.data.id : null;

  const { data: inserted, error: insertError } = await admin
    .from("billing_webhook_events")
    .insert({
      provider: "saspay",
      event_key: eventKey,
      event_type: event.event,
      provider_object_id: transactionId,
      processing_status: "received",
      payload: sanitizedWebhookPayload(event),
    })
    .select("id")
    .maybeSingle();
  let eventRowId = inserted?.id as string | undefined;
  if (insertError?.code === "23505") {
    const { data: existingEvent, error: existingError } = await admin
      .from("billing_webhook_events")
      .select("id, processing_status")
      .eq("provider", "saspay")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (existingError || !existingEvent?.id) {
      throw new Error("webhook_duplicate_lookup_failed");
    }
    if (existingEvent.processing_status !== "failed") {
      return { duplicate: true, processed: true };
    }
    eventRowId = existingEvent.id as string;
    const { error: resetError } = await admin
      .from("billing_webhook_events")
      .update({
        processing_status: "received",
        error_code: null,
        processed_at: null,
      })
      .eq("id", eventRowId)
      .eq("processing_status", "failed");
    if (resetError) throw new Error("webhook_retry_reset_failed");
  } else if (insertError || !eventRowId) {
    throw new Error(`webhook_store_failed:${insertError?.code ?? "unknown"}`);
  }
  try {
    if (event.event === "webhook.test") {
      await admin
        .from("billing_webhook_events")
        .update({ processing_status: "processed", processed_at: new Date().toISOString() })
        .eq("id", eventRowId);
      return { duplicate: false, processed: true };
    }
    if (!event.event.startsWith("transaction.") || !transactionId) {
      await admin
        .from("billing_webhook_events")
        .update({ processing_status: "ignored", processed_at: new Date().toISOString() })
        .eq("id", eventRowId);
      return { duplicate: false, processed: false };
    }

    const verified = await sasPayProvider.verifyPayment(transactionId);
    const paymentId = paymentIdFromSasPayDescription(verified.description);
    const payment = paymentId ? await getPaymentById(paymentId) : null;
    if (!payment) {
      await admin
        .from("billing_webhook_events")
        .update({
          processing_status: "ignored",
          error_code: "payment_not_found",
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRowId);
      return { duplicate: false, processed: false };
    }

    if (verified.status === "SUCCESS") {
      await activateVerifiedPayment(payment, verified);
    } else if (verified.status === "FAILED") {
      await recordPendingAttemptOutcome(payment.id, "provider_failed");
    } else if (verified.status === "CANCELLED") {
      await recordPendingAttemptOutcome(payment.id, "provider_cancelled");
    }

    await admin
      .from("billing_webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventRowId);
    console.info("[saspay] webhook processed", {
      event: event.event,
      transactionId,
      paymentId: payment.id,
      status: verified.status,
    });
    return { duplicate: false, processed: true };
  } catch (error) {
    await admin
      .from("billing_webhook_events")
      .update({
        processing_status: "failed",
        error_code: error instanceof Error ? error.message.split(":", 1)[0] : "unknown_error",
      })
      .eq("id", eventRowId);
    throw error;
  }
}
