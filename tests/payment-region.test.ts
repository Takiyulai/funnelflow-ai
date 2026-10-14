import { describe, expect, it } from "vitest";
import { paymentRegionFromCountry } from "@/lib/geo/paymentRegion";

describe("recommandation du parcours de paiement", () => {
  it("recommande le paiement Afrique pour plusieurs marchés africains", () => {
    expect(paymentRegionFromCountry("BJ")).toBe("africa");
    expect(paymentRegionFromCountry("ci")).toBe("africa");
    expect(paymentRegionFromCountry("NG")).toBe("africa");
    expect(paymentRegionFromCountry("ZA")).toBe("africa");
  });

  it("recommande le paiement international hors d'Afrique", () => {
    expect(paymentRegionFromCountry("FR")).toBe("international");
    expect(paymentRegionFromCountry("CA")).toBe("international");
    expect(paymentRegionFromCountry("US")).toBe("international");
  });

  it("ne devine pas une région sans code pays exploitable", () => {
    expect(paymentRegionFromCountry(null)).toBeNull();
    expect(paymentRegionFromCountry("XX")).toBeNull();
    expect(paymentRegionFromCountry("France")).toBeNull();
  });
});
