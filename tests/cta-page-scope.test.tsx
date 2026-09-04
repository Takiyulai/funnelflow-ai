import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CtaTab } from "@/components/editor/tabs/CtaTab";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";
import { isFunnelHomePage, resolveCtaWithGlobal } from "@/lib/funnels/cta";
import { resolveNextDestination } from "@/lib/funnels/nextDestination";
import { createSystemeBlocks, renderFunnelHtml } from "@/lib/export/html";
import type { CtaConfig, Funnel, FunnelPage, FunnelSection } from "@/lib/funnels/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/tunnel/inscription-3" }));

function fixture(provider: "internal" | "systeme" = "internal"): Funnel {
  const cta: CtaConfig = { mode: "redirect", label: "Recevoir mon guide", url: "https://youtube.com/old", pageSlug: "obsolete" };
  const section: FunnelSection = { id: "hero-1", type: "hero", pattern: "hero-split-stats-search-b2b", headline: "Accueil", cta };
  const pages: FunnelPage[] = [
    { id: "home", name: "Accueil", slug: "/", role: "landing", isHome: true, visible: true, nextPageId: "thanks", sections: [section] },
    { id: "thanks", name: "Merci", slug: "merci", role: "thankyou", visible: true, sections: [
      { ...section, pattern: undefined, headline: "Merci", cta: { mode: "redirect", label: "Voir la vidéo", url: "https://youtube.com/thanks" } },
    ] },
  ];
  return {
    ...demoFunnel, pages, sections: pages[0].sections, header: { enabled: false },
    defaultCta: { mode: "popup", label: "Action commune", popupProvider: provider, systemePopupId: "12345", popupTitle: "Recevez votre guide" },
    meta: { ...demoFunnel.meta, templateId: "lead-snap", applyDefaultCtaToAll: true },
  };
}

function Editor({ pageIndex }: { pageIndex: number }) {
  const initial = fixture();
  // Reproduce the production duplicate hero-1, with a popup editable on home.
  initial.pages![0].sections[0].cta = { ...initial.defaultCta!, label: "Recevoir mon guide" };
  const [funnel, setFunnel] = useState(initial);
  const page = funnel.pages![pageIndex];
  return <>
    <CtaTab section={page.sections[0]} pageId={page.id} funnel={funnel} language="fr"
      onFunnelChange={(patch) => setFunnel({ ...funnel, ...patch })}
      onChange={(patch) => setFunnel({ ...funnel, pages: funnel.pages!.map((p) => p.id === page.id
        ? { ...p, sections: p.sections.map((s) => ({ ...s, ...patch })) } : p) })} />
    <output data-testid="state">{JSON.stringify(funnel)}</output>
  </>;
}

describe("action commune limitée à l'accueil", () => {
  it("modifier hero-1 à l'accueil ne réécrit pas hero-1 sur merci", () => {
    render(<Editor pageIndex={0} />);
    fireEvent.change(screen.getByPlaceholderText("Ex : Je commence maintenant"), { target: { value: "Nouveau libellé" } });
    const state = JSON.parse(screen.getByTestId("state").textContent!);
    expect(state.defaultCta.label).toBe("Nouveau libellé");
    expect(state.pages[0].sections[0].cta.label).toBe("Nouveau libellé");
    expect(state.pages[1].sections[0].cta.url).toBe("https://youtube.com/thanks");
    expect(state.pages[1].sections[0].cta.label).toBe("Voir la vidéo");
  });

  it("modifier merci ne change ni le CTA global ni l'accueil", () => {
    render(<Editor pageIndex={1} />);
    expect(screen.queryByRole("checkbox", { name: /Appliquer cette action/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ex : Je commence maintenant"), { target: { value: "Regarder" } });
    const state = JSON.parse(screen.getByTestId("state").textContent!);
    expect(state.defaultCta.label).toBe("Action commune");
    expect(state.pages[0].sections[0].cta.label).toBe("Recevoir mon guide");
    expect(state.pages[1].sections[0].cta.label).toBe("Regarder");
  });

  it("efface les anciennes destinations lors du retour au popup global", () => {
    const funnel = fixture();
    const page = funnel.pages![0];
    const section = page.sections[0];
    const cta = resolveCtaWithGlobal(section.cta!, funnel.defaultCta, true);
    expect(cta.url).toBeUndefined();
    expect(cta.pageSlug).toBeUndefined();
    expect(resolveNextDestination({ section: { ...section, cta }, page, funnel, funnelSlug: "inscription-3" }))
      .toBe("/tunnel/inscription-3/merci");
    expect(resolveCtaWithGlobal({ ...section.cta!, ignoreGlobalCta: true }, funnel.defaultCta, true)).toEqual({ ...section.cta!, ignoreGlobalCta: true });
  });

  it("reste compatible avec la première page sans isHome et les tunnels mono-page", () => {
    const funnel = fixture();
    delete funnel.pages![0].isHome;
    expect(isFunnelHomePage(funnel, funnel.pages![0])).toBe(true);
    expect(isFunnelHomePage(funnel, funnel.pages![1])).toBe(false);
    expect(isFunnelHomePage({ ...funnel, pages: undefined })).toBe(true);
  });

  it.each([
    "hero-split-stats-search-b2b", "hero-centered-nav-glow", "hero-video-centered-funnel",
    "cta-final-centered-urgency", "cta-final-split-recap-benefits", "cta-final-glow-countdown",
  ])("le pattern %s ouvre réellement le popup interne", (pattern) => {
    const funnel = fixture();
    funnel.pages![0].sections[0].pattern = pattern;
    funnel.pages![0].sections[0].type = pattern.startsWith("cta-") ? "cta" : "hero";
    render(<FunnelPreview funnel={funnel} activePage={funnel.pages![0]} showToolbar={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Recevoir mon guide/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Recevez votre guide")).toBeInTheDocument();
  });

  it("changer Systeme.io en interne remplace le déclencheur sans conserver l'ancien handler", () => {
    const funnel = fixture("systeme");
    const { rerender } = render(<FunnelPreview funnel={funnel} activePage={funnel.pages![0]} showToolbar={false} />);
    expect(screen.getByRole("button", { name: /Recevoir mon guide/ })).toHaveClass("systeme-show-popup-12345");
    const changed = { ...funnel, defaultCta: { ...funnel.defaultCta!, popupProvider: "internal" as const } };
    rerender(<FunnelPreview funnel={changed} activePage={changed.pages![0]} showToolbar={false} />);
    const button = screen.getByRole("button", { name: /Recevoir mon guide/ });
    expect(button).not.toHaveClass("systeme-show-popup-12345");
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("la page de remerciement conserve son lien local dans le rendu public", () => {
    const funnel = fixture();
    render(<FunnelPreview funnel={funnel} activePage={funnel.pages![1]} showToolbar={false} />);
    expect(screen.getByRole("link", { name: /Voir la vidéo/ })).toHaveAttribute("href", "https://youtube.com/thanks");
  });

  it.each([false, true])("l'export respecte la même portée sans modifier le funnel (blocs=%s)", (blocks) => {
    const funnel = fixture("systeme");
    const before = JSON.stringify(funnel);
    const html = (id: string) => blocks
      ? createSystemeBlocks(funnel, { targetPageId: id }).map((block) => block.html).join("")
      : renderFunnelHtml(funnel, { targetPageId: id });
    expect(html("home")).toContain("systeme-show-popup-12345");
    expect(html("home")).not.toContain("https://youtube.com/old");
    expect(html("thanks")).toContain("https://youtube.com/thanks");
    expect(html("thanks")).not.toContain("systeme-show-popup-12345");
    expect(JSON.stringify(funnel)).toBe(before);
  });
});
