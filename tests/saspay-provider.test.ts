import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  paymentIdFromSasPayDescription,
  sasPayPaymentDescription,
  sasPayProvider,
  verifySasPayWebhook,
} from "@/lib/payments/providers/saspay";
import { PAYMENT_PROVIDER_CAPABILITIES } from "@/lib/payments/providerRegistry";

const PAYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const CHECKOUT_ID = "c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e6f";

describe("provider SasPay", () => {
  beforeEach(() => {
    process.env.SASPAY_SECRET_KEY = "sk_test_example";
    process.env.SASPAY_WEBHOOK_SECRET = "webhook-test-secret";
  });

  afterEach(() => {
    delete process.env.SASPAY_SECRET_KEY;
    delete process.env.SASPAY_WEBHOOK_SECRET;
    vi.unstubAllGlobals();
  });

  it("crée une checkout session avec le montant serveur et la référence interne", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: CHECKOUT_ID,
          checkout_url: "https://pay.saspay.me/checkout/test",
          status: "PENDING",
          expires_at: null,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const checkout = await sasPayProvider.createCheckout({
      paymentId: PAYMENT_ID,
      userId: "user-1",
      planId: "pro",
      planName: "Pro",
      amountMinor: 39000,
      currency: "XOF",
      customerEmail: "client@example.com",
      customerName: "Client",
      returnUrl: "https://autofunnel.example/abonnement/success?payment=" + PAYMENT_ID,
    });

    expect(checkout.id).toBe(CHECKOUT_ID);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.amount).toBe("39000.00");
    expect(body.currency).toBe("XOF");
    expect(body.description).toContain(PAYMENT_ID);
    expect(body.metadata.autofunnel_plan_id).toBe("pro");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk_test_example",
    );
  });

  it("accepte une signature HMAC valide sur le corps brut", () => {
    const timestamp = "1800000000";
    const rawBody = JSON.stringify({
      event: "transaction.success",
      data: { id: PAYMENT_ID, status: "SUCCESS" },
    });
    const signature = createHmac("sha256", "webhook-test-secret")
      .update(timestamp + "." + rawBody)
      .digest("hex");

    const event = verifySasPayWebhook({
      rawBody,
      signature,
      timestamp,
      nowSeconds: Number(timestamp),
      eventHeader: "transaction.success",
    });
    expect(event.event).toBe("transaction.success");
  });

  it("rejette une signature invalide ou trop ancienne", () => {
    const rawBody = JSON.stringify({ event: "webhook.test", data: {} });
    expect(() =>
      verifySasPayWebhook({
        rawBody,
        signature: "invalid",
        timestamp: "1800000000",
        nowSeconds: 1800000000,
      }),
    ).toThrow("invalid_signature");

    const oldSignature = createHmac("sha256", "webhook-test-secret")
      .update("1700000000." + rawBody)
      .digest("hex");
    expect(() =>
      verifySasPayWebhook({
        rawBody,
        signature: oldSignature,
        timestamp: "1700000000",
        nowSeconds: 1800000000,
      }),
    ).toThrow("stale_signature");
  });

  it("encode et relit l'identifiant interne sans faire confiance au frontend", () => {
    const description = sasPayPaymentDescription(PAYMENT_ID, "Pro");
    expect(paymentIdFromSasPayDescription(description)).toBe(PAYMENT_ID);
    expect(paymentIdFromSasPayDescription("Abonnement Pro")).toBeNull();
  });

  it("laisse le récurrent, SoftPay et les comptes connectés désactivés", () => {
    expect(PAYMENT_PROVIDER_CAPABILITIES.saspay).toMatchObject({
      hostedCheckout: true,
      signedWebhooks: true,
      recurringSubscriptions: false,
      softPay: false,
      connectedMerchants: false,
    });
  });
});
