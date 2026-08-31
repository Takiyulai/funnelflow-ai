import { describe, expect, it } from "vitest";
import {
  internalTestAccountEmails,
  isInternalTestAccountEmail,
} from "@/lib/billing/internalTestAccounts";
import { getAccess } from "@/lib/billing/subscription";

describe("internal test accounts", () => {
  it("accorde les droits internes aux deux comptes de test intégrés", () => {
    expect(isInternalTestAccountEmail("takiyulai0dramane@gmail.com", "")).toBe(true);
    expect(isInternalTestAccountEmail("JWDemanou@GMAIL.com", "")).toBe(true);
  });

  it("permet d'ajouter des testeurs sans remplacer les comptes intégrés", () => {
    const emails = internalTestAccountEmails(" autre@example.com, TEST@example.com ");

    expect(emails).toContain("takiyulai0dramane@gmail.com");
    expect(emails).toContain("jwdemanou@gmail.com");
    expect(emails).toContain("autre@example.com");
    expect(emails).toContain("test@example.com");
  });

  it("refuse une adresse utilisateur ordinaire", () => {
    expect(isInternalTestAccountEmail("client@example.com", "")).toBe(false);
  });

  it("retourne les droits Agency même quand le billing est appliqué", async () => {
    const previous = process.env.BILLING_ENFORCED;
    process.env.BILLING_ENFORCED = "true";

    try {
      const access = await getAccess("test-user-id", "jwdemanou@gmail.com");

      expect(access).toMatchObject({
        enforced: true,
        hasAccess: true,
        planId: "agency",
        status: "active",
      });
      expect(access.limits.funnels).toBe(Infinity);
      expect(access.limits.urlImportsPerMonth).toBe(Infinity);
      expect(access.limits.pageTimeTracking).toBe(true);
      expect(access.limits.customCode).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.BILLING_ENFORCED;
      else process.env.BILLING_ENFORCED = previous;
    }
  });
});
