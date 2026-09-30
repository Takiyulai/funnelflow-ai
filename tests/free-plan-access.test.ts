import { afterEach, describe, expect, it, vi } from "vitest";
import { FREE_PLAN } from "@/lib/billing/plans";

const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: vi.fn(() => ({ select })) }),
}));

import { getAccess } from "@/lib/billing/subscription";

describe("attribution du plan Free", () => {
  const previousBillingEnforced = process.env.BILLING_ENFORCED;

  afterEach(() => {
    if (previousBillingEnforced === undefined) delete process.env.BILLING_ENFORCED;
    else process.env.BILLING_ENFORCED = previousBillingEnforced;
  });

  it("applique immédiatement les limites Free sans profil payant ni licence", async () => {
    process.env.BILLING_ENFORCED = "true";

    const access = await getAccess("new-user-id", "nouveau@example.com");

    expect(access).toMatchObject({
      hasAccess: true,
      planId: null,
      status: "inactive",
      quotaPeriod: "lifetime",
      limits: FREE_PLAN.limits,
    });
  });
});
