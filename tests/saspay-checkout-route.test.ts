import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createCheckout = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/payments/saspayBilling", () => ({
  createSasPayCheckout: createCheckout,
}));

import { POST } from "@/app/api/payments/saspay/checkout/route";

describe("route checkout SasPay", () => {
  beforeEach(() => {
    getUser.mockReset();
    createCheckout.mockReset();
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "client@example.com",
          user_metadata: { full_name: "Awa Sossou" },
        },
      },
    });
  });

  it("refuse un utilisateur non authentifié", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(
      new Request("https://autofunnel.example/api/payments/saspay/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "pro" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("refuse un plan inexistant", async () => {
    const response = await POST(
      new Request("https://autofunnel.example/api/payments/saspay/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "business" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("ignore tout montant navigateur et transmet seulement le plan au service", async () => {
    createCheckout.mockResolvedValue({
      paymentId: "payment-1",
      checkoutUrl: "https://pay.saspay.me/checkout/test",
      reused: false,
    });
    const response = await POST(
      new Request("https://autofunnel.example/api/payments/saspay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "pro", amount: 1 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ planId: "pro", userId: "user-1" }),
    );
    expect(createCheckout.mock.calls[0][0]).not.toHaveProperty("amount");
  });

  it("transforme une erreur SasPay en réponse neutre", async () => {
    createCheckout.mockRejectedValue(new Error("network_error"));
    const response = await POST(
      new Request("https://autofunnel.example/api/payments/saspay/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "starter" }),
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "network_error" });
  });
});
