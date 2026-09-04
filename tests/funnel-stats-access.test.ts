import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET } from "@/app/api/funnels/[id]/stats/route";
import { listAbTests } from "@/lib/ab/tests";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), single: vi.fn(), rpc: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.auth },
    from: () => ({ select: mocks.select }),
    rpc: mocks.rpc,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: "owner" } } });
  mocks.single.mockResolvedValue({ data: { id: "funnel" }, error: null });
  const chain = { eq: mocks.eq, maybeSingle: mocks.single, order: mocks.order };
  mocks.select.mockReturnValue(chain);
  mocks.eq.mockReturnValue(chain);
});
const request = (days = "7") => new Request(`https://example.test/api/funnels/funnel/stats?days=${days}`);
const context = { params: Promise.resolve({ id: "funnel" }) };

describe("agrégats privés sans recharger le contenu du tunnel", () => {
  it("refuse un utilisateur non connecté", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null } });
    expect((await GET(request(), context)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("vérifie le propriétaire avant toute lecture des statistiques", async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    expect((await GET(request(), context)).status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ne sélectionne que l’id et distingue un vrai zéro d’une erreur", async () => {
    const stats = { views: 0, uniques: 0, leads: 0, pages: [], leadsByPage: [], sources: [] };
    mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: stats, error: null }) });
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.select).toHaveBeenCalledWith("id");
    expect(await response.json()).toEqual({ ok: true, stats });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("ne renvoie pas le détail technique d’un échec RPC", async () => {
    mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { message: "internal secret" } }) });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("internal secret");
    log.mockRestore();
  });
  it("refuse les périodes non prévues", async () => {
    expect((await GET(request("100000"), context)).status).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("une erreur de statistiques A/B n’est plus convertie en zéros", async () => {
    mocks.order.mockResolvedValue({ data: [{ id: "test" }], error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const sb = { from: () => ({ select: mocks.select }), rpc: mocks.rpc } as unknown as SupabaseClient;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(listAbTests(sb, "owner", "funnel")).rejects.toThrow("ab_stats_unavailable");
    log.mockRestore();
  });
});
