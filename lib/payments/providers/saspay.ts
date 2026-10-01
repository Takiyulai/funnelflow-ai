import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PAYMENT_PROVIDER_CAPABILITIES } from "@/lib/payments/providerRegistry";
import type {
  CheckoutPaymentStatus,
  CreateCheckoutInput,
  CreatedCheckout,
  PaymentProvider,
  VerifiedPayment,
} from "@/lib/payments/types";

const SASPAY_API_BASE = "https://api.saspay.me/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;
const WEBHOOK_TOLERANCE_SECONDS = 300;

const checkoutSchema = z.object({
  id: z.string().uuid(),
  checkout_url: z.string().url(),
  status: z.string(),
  expires_at: z.string().nullable().optional(),
});

const checkoutStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  transaction_id: z.string().uuid().nullable().optional(),
  transaction_status: z.string().nullable().optional(),
  transaction_reference: z.string().nullable().optional(),
});

const verifiedPaymentSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  description: z.string().default(""),
  requested_amount: z.string(),
  currency: z.string(),
  status: z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const webhookSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()).default({}),
});

export type SasPayWebhookEvent = z.infer<typeof webhookSchema>;

export class SasPayApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "SasPayApiError";
  }
}

function secretKey(): string {
  const value = process.env.SASPAY_SECRET_KEY?.trim();
  if (!value) throw new SasPayApiError("not_configured", 503);
  return value;
}

export function isSasPayConfigured(): boolean {
  return Boolean(
    process.env.SASPAY_SECRET_KEY?.trim() &&
      process.env.SASPAY_WEBHOOK_SECRET?.trim(),
  );
}

function unwrapResponse(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.success === true && record.data !== undefined) return record.data;
  return value;
}

function apiErrorCode(value: unknown): string {
  if (!value || typeof value !== "object") return "request_failed";
  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object") {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "string" && code) return code;
  }
  if (typeof record.code === "string" && record.code) return record.code;
  return "request_failed";
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SASPAY_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      throw new SasPayApiError(apiErrorCode(body), response.status);
    }
    return unwrapResponse(body);
  } catch (error) {
    if (error instanceof SasPayApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SasPayApiError("timeout", 504);
    }
    throw new SasPayApiError("network_error", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function sasPayPaymentDescription(
  paymentId: string,
  planName: string,
): string {
  return `AutoFunnel AI - ${planName} - [${paymentId}]`;
}

export function paymentIdFromSasPayDescription(
  description: string,
): string | null {
  const match = description.match(
    /\[([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

export function verifySasPayWebhook(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  eventHeader?: string | null;
  nowSeconds?: number;
}): SasPayWebhookEvent {
  const secret = process.env.SASPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("saspay_webhook_not_configured");
  if (!input.signature || !input.timestamp) throw new Error("missing_signature");

  const timestampNumber = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(timestampNumber) ||
    Math.abs(now - timestampNumber) > WEBHOOK_TOLERANCE_SECONDS
  ) {
    throw new Error("stale_signature");
  }

  const expected = createHmac("sha256", secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");
  const receivedBuffer = Buffer.from(input.signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error("invalid_signature");
  }

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    throw new Error("invalid_json");
  }
  const event = webhookSchema.parse(json);
  if (input.eventHeader && input.eventHeader !== event.event) {
    throw new Error("event_header_mismatch");
  }
  return event;
}

export const sasPayProvider: PaymentProvider = {
  id: "saspay",
  capabilities: PAYMENT_PROVIDER_CAPABILITIES.saspay,

  async createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const data = checkoutSchema.parse(
      await request("/checkout-sessions/", {
        method: "POST",
        body: JSON.stringify({
          amount: input.amountMinor.toFixed(2),
          currency: input.currency,
          description: sasPayPaymentDescription(input.paymentId, input.planName),
          country: "BJ",
          customer_email: input.customerEmail,
          customer_name: input.customerName,
          return_url: input.returnUrl,
          metadata: {
            autofunnel_payment_id: input.paymentId,
            autofunnel_user_id: input.userId,
            autofunnel_plan_id: input.planId,
          },
        }),
      }),
    );
    return {
      id: data.id,
      checkoutUrl: data.checkout_url,
      status: data.status,
      expiresAt: data.expires_at ?? null,
    };
  },

  async getCheckoutStatus(checkoutId: string): Promise<CheckoutPaymentStatus> {
    const data = checkoutStatusSchema.parse(
      await request(`/checkout-sessions/${encodeURIComponent(checkoutId)}/status/`),
    );
    return {
      checkoutId: data.id,
      status: data.status.toUpperCase(),
      transactionId: data.transaction_id ?? null,
      transactionStatus: data.transaction_status?.toUpperCase() ?? null,
      transactionReference: data.transaction_reference ?? null,
    };
  },

  async verifyPayment(paymentId: string): Promise<VerifiedPayment> {
    const data = verifiedPaymentSchema.parse(
      await request(`/payments/${encodeURIComponent(paymentId)}/verify/`),
    );
    return {
      id: data.id,
      reference: data.reference ?? null,
      merchantId: data.merchant ?? null,
      description: data.description,
      requestedAmount: data.requested_amount,
      currency: data.currency.toUpperCase(),
      status: data.status.toUpperCase(),
      createdAt: data.created_at ?? null,
      updatedAt: data.updated_at ?? null,
    };
  },

  async cancelCheckout(checkoutId: string): Promise<void> {
    await request(`/checkout-sessions/${encodeURIComponent(checkoutId)}/cancel/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
