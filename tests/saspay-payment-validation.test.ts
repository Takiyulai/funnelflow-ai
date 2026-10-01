import { describe, expect, it } from "vitest";
import {
  verifiedPaymentMatchesIntent,
  type BillingPaymentRow,
} from "@/lib/payments/saspayBilling";
import { sasPayPaymentDescription } from "@/lib/payments/providers/saspay";
import type { VerifiedPayment } from "@/lib/payments/types";

const PAYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

function intent(): BillingPaymentRow {
  return {
    id: PAYMENT_ID,
    user_id: "user-1",
    plan_id: "pro",
    provider: "saspay",
    amount_minor: 39000,
    currency: "XOF",
    status: "pending",
    provider_description: sasPayPaymentDescription(PAYMENT_ID, "Pro"),
    provider_checkout_id: "checkout-1",
    provider_checkout_url: "https://pay.saspay.me/checkout/test",
    provider_transaction_id: null,
    provider_transaction_reference: null,
    paid_at: null,
  };
}

function verified(overrides: Partial<VerifiedPayment> = {}): VerifiedPayment {
  return {
    id: "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
    reference: "TXN-1",
    merchantId: "merchant-1",
    description: sasPayPaymentDescription(PAYMENT_ID, "Pro"),
    requestedAmount: "39000.00",
    currency: "XOF",
    status: "SUCCESS",
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("validation canonique d'un paiement SasPay", () => {
  it("accepte uniquement un succès correspondant exactement à l'intention", () => {
    expect(verifiedPaymentMatchesIntent(intent(), verified())).toBe(true);
  });

  it("refuse un montant, une devise, un statut ou une référence interne différents", () => {
    expect(
      verifiedPaymentMatchesIntent(intent(), verified({ requestedAmount: "1.00" })),
    ).toBe(false);
    expect(
      verifiedPaymentMatchesIntent(intent(), verified({ currency: "EUR" })),
    ).toBe(false);
    expect(
      verifiedPaymentMatchesIntent(intent(), verified({ status: "FAILED" })),
    ).toBe(false);
    expect(
      verifiedPaymentMatchesIntent(
        intent(),
        verified({ description: "AutoFunnel AI - Pro - [11111111-1111-4111-8111-111111111111]" }),
      ),
    ).toBe(false);
  });
});
