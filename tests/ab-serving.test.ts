import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FunnelPage } from "@/lib/funnels/types";
import { pickVariant } from "@/lib/ab/assign";
import { serveAbVariant, recordAbConversion } from "@/lib/ab/serve";

const mocks = vi.hoisted(() => ({ cookie: vi.fn(), header: vi.fn(), running: vi.fn(), record: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }), headers: async () => ({ get: mocks.header }) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/ab/tests", () => ({ getRunningTest: mocks.running, recordAbEvent: mocks.record }));

const page = { id: "home", sections: [{ id: "hero", type: "hero", headline: "A" }] } as FunnelPage;
const variantB = [{ ...page.sections[0], headline: "B" }];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie.mockReturnValue({ value: "visitor-1" });
  mocks.header.mockReturnValue(null);
  mocks.running.mockResolvedValue({ id: "test-1", traffic_split: 50, variant_b: variantB });
  mocks.record.mockResolvedValue(undefined);
});

describe("répartition simultanée, stable et aperçus A/B", () => {
  it("répartit une population, sans alterner un visiteur au rechargement", () => {
    const variants = Array.from({ length: 10000 }, (_, i) => pickVariant(`visitor-${i}`, "test-1", 50));
    const shareB = variants.filter(v => v === "b").length / variants.length;
    expect(shareB).toBeGreaterThan(0.47);
    expect(shareB).toBeLessThan(0.53);
    expect(pickVariant("visitor-1", "test-1", 50)).toBe(pickVariant("visitor-1", "test-1", 50));
    expect(new Set(variants.slice(0, 100)).size).toBe(2);
  });
  it.each(["a", "b"] as const)("sert réellement %s et crédite cette même variante", async variant => {
    const visitor = Array.from({ length: 100 }, (_, i) => `visitor-${i}`).find(v => pickVariant(v, "test-1", 50) === variant)!;
    mocks.cookie.mockReturnValue({ value: visitor });
    const served = await serveAbVariant("funnel", "owner", page);
    expect(served.variant).toBe(variant);
    expect(served.page.sections).toEqual(variant === "a" ? page.sections : variantB);
    expect(mocks.record).toHaveBeenCalledWith({}, expect.objectContaining({ variant, visitorKey: visitor, kind: "view" }));
    await recordAbConversion("funnel", "owner", "home");
    expect(mocks.record).toHaveBeenLastCalledWith({}, expect.objectContaining({ variant, visitorKey: visitor, kind: "conversion" }));
  });
  it.each(["a", "b"] as const)("l’aperçu %s marche sans cookie et ne compte aucune vue", async variant => {
    mocks.cookie.mockReturnValue(undefined);
    const served = await serveAbVariant("funnel", "owner", page, variant);
    expect(served.variant).toBe(variant);
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("ne crédite pas de conversion depuis Voir B", async () => {
    mocks.header.mockReturnValue("https://example.test/tunnel/demo?ff_ab=b");
    await recordAbConversion("funnel", "owner", "home");
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("préserve la page d’origine sans test", async () => {
    mocks.running.mockResolvedValue(null);
    expect((await serveAbVariant("funnel", "owner", page)).page).toBe(page);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
