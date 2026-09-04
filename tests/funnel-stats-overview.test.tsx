import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FunnelStatsOverview, type Stats } from "@/components/funnel/FunnelStatsOverview";
import { PageViewBeacon } from "@/components/funnel/PageViewBeacon";

vi.mock("next/navigation", () => ({ usePathname: () => "/tunnel/demo" }));
const stats: Stats = { views: 25, uniques: 4, leads: 1, pages: [], leadsByPage: [], sources: [{ source: "direct", views: 25 }] };
beforeEach(() => window.history.replaceState(null, "", "/funnels/demo/stats?days=30&abPage=home"));
afterEach(() => vi.unstubAllGlobals());

describe("statistiques lisibles et changement de période léger", () => {
  it("explicite le cumul A+B, les sources et le ratio global", () => {
    render(<FunnelStatsOverview funnelId="demo" initialStats={stats} initialDays={30} pageNames={{}} />);
    expect(screen.getByText(/variantes A \+ B cumulées/)).toBeInTheDocument();
    expect(screen.getByText("Direct ou origine inconnue")).toBeInTheDocument();
    expect(screen.getByText("25,0 %")).toBeInTheDocument();
  });
  it("réagit au clic et ignore la réponse d’une ancienne période", async () => {
    const responses: Array<(value: unknown) => void> = [];
    const fetcher = vi.fn(() => new Promise(resolve => responses.push(resolve)));
    vi.stubGlobal("fetch", fetcher);
    render(<FunnelStatsOverview funnelId="demo" initialStats={stats} initialDays={30} pageNames={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "7 j" }));
    expect(screen.getByRole("button", { name: "7 j" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Chargement des 7");
    fireEvent.click(screen.getByRole("button", { name: "90 j" }));
    expect(fetcher).toHaveBeenLastCalledWith("/api/funnels/demo/stats?days=90", expect.objectContaining({ cache: "no-store" }));
    await act(async () => responses[1]({ ok: true, json: async () => ({ ok: true, stats: { ...stats, views: 90 } }) }));
    await act(async () => responses[0]({ ok: true, json: async () => ({ ok: true, stats: { ...stats, views: 7 } }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Les 90 derniers jours");
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(window.location.search).toContain("abPage=home");
    expect(window.location.search).toContain("days=90");
  });
  it("affiche une erreur, pas des zéros, et permet de réessayer", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, stats }) });
    vi.stubGlobal("fetch", fetcher);
    render(<FunnelStatsOverview funnelId="demo" initialStats={stats} initialDays={30} pageNames={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "7 j" }));
    await waitFor(() => expect(screen.getByText("Statistiques indisponibles")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "7 j" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Les 7 derniers jours"));
  });
  it.each(["a", "b"])("Voir %s n’envoie aucun beacon, même pour un contact identifié", variant => {
    window.history.replaceState(null, "", `/tunnel/demo?ff_ab=${variant}`);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    window.localStorage.setItem("ff_contact_demo", "00000000-0000-4000-8000-000000000001");
    render(<PageViewBeacon />);
    expect(fetcher).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("ff_seen_/tunnel/demo")).toBeNull();
    window.localStorage.removeItem("ff_contact_demo");
  });
});
