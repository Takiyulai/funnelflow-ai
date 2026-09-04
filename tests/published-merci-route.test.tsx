import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CheckoutSuccessPage from "@/app/tunnel/[slug]/merci/page";
import { demoFunnel } from "@/lib/funnels/demo";

const mocks = vi.hoisted(() => ({ load: vi.fn(), renderPage: vi.fn() }));
vi.mock("@/lib/funnels/loadPublished", () => ({ getPublishedFunnelBySlug: mocks.load }));
vi.mock("@/app/tunnel/[slug]/PublishedSubPage", () => ({ default: mocks.renderPage }));

beforeEach(() => vi.clearAllMocks());

describe("la route statique merci ne masque plus la page créée", () => {
  it.each(["merci", "/merci"])("délègue le slug %s au renderer publié, avec son paramètre A/B", async (slug) => {
    mocks.load.mockResolvedValue({ funnel: { ...demoFunnel, pages: [
      { id: "thanks", slug, name: "Merci", role: "thankyou", sections: [], visible: true },
    ] } });
    mocks.renderPage.mockResolvedValue(<h1>Votre guide est prêt</h1>);
    const searchParams = Promise.resolve({ ff_ab: "b" });
    render(await CheckoutSuccessPage({ params: Promise.resolve({ slug: "inscription-3" }), searchParams }));
    expect(screen.getByText("Votre guide est prêt")).toBeInTheDocument();
    expect(screen.queryByText(/Paiement confirmé/)).not.toBeInTheDocument();
    expect(mocks.renderPage.mock.calls[0][0]).toMatchObject({ slug: "inscription-3", page: { slug } });
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.renderPage.mock.calls[0][0].searchParams).toBe(searchParams);
  });

  it("conserve le succès paiement historique en l'absence d'une page merci", async () => {
    mocks.load.mockResolvedValue({ funnel: { ...demoFunnel, pages: [] } });
    render(await CheckoutSuccessPage({ params: Promise.resolve({ slug: "legacy" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Paiement confirmé/)).toBeInTheDocument();
    expect(mocks.renderPage).not.toHaveBeenCalled();
  });
});
