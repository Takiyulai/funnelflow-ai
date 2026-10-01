import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getPaymentStatus = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/payments/saspayBilling", () => ({
  getSasPayPaymentStatusForUser: getPaymentStatus,
}));

import { GET } from "@/app/api/payments/saspay/status/route";

const PAYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("route de réconciliation SasPay", () => {
  beforeEach(() => {
    getUser.mockReset();
    getPaymentStatus.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("une URL de succès sans session utilisateur n'active rien", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(
      new Request(
        "https://autofunnel.example/api/payments/saspay/status?paymentId=" +
          PAYMENT_ID,
      ),
    );
    expect(response.status).toBe(401);
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });

  it("refuse un paiement qui n'appartient pas à l'utilisateur", async () => {
    getPaymentStatus.mockResolvedValue(null);
    const response = await GET(
      new Request(
        "https://autofunnel.example/api/payments/saspay/status?paymentId=" +
          PAYMENT_ID,
      ),
    );
    expect(response.status).toBe(404);
    expect(getPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, "user-1");
  });

  it("ne renvoie succeeded qu'après la réconciliation serveur", async () => {
    getPaymentStatus.mockResolvedValue({ status: "succeeded", planId: "pro" });
    const response = await GET(
      new Request(
        "https://autofunnel.example/api/payments/saspay/status?paymentId=" +
          PAYMENT_ID,
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "succeeded",
      planId: "pro",
    });
  });
});
