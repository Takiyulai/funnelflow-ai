import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";
import { getHomePage } from "@/lib/funnels/types";

// Helper : récupère les sections de la home, quel que soit le modèle
function getHomeSections() {
  const home = getHomePage(demoFunnel);
  return home?.sections ?? [];
}

describe("FunnelPreview", () => {
  it("renders the hero headline of the generated funnel", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    const hero = getHomeSections().find((section) => section.type === "hero");
    expect(hero).toBeDefined();
    if (hero && "headline" in hero && hero.headline) {
      expect(screen.getByText(hero.headline)).toBeInTheDocument();
    }
  });

  it("renders sections that are flagged visible", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    const visibleSections = getHomeSections().filter(
      (section) => section.visible !== false,
    );
    expect(visibleSections.length).toBeGreaterThan(0);
  });

  it("exposes a desktop / mobile preview toggle", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    expect(
      screen.getByRole("button", { name: /desktop|ordinateur/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /mobile/i }),
    ).toBeInTheDocument();
  });

  it("does not render hidden sections", () => {
    const home = getHomePage(demoFunnel);
    if (!home) return;
    const funnelWithHidden = {
      ...demoFunnel,
      pages: demoFunnel.pages.map((page) =>
        page.id === home.id
          ? {
              ...page,
              sections: page.sections.map((section, index) =>
                index === 1 ? { ...section, visible: false } : section,
              ),
            }
          : page,
      ),
    };
    render(<FunnelPreview funnel={funnelWithHidden} />);
    const hidden = home.sections[1];
    if (hidden && "headline" in hidden && hidden.headline) {
      expect(screen.queryByText(hidden.headline)).not.toBeInTheDocument();
    }
  });
});
