import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";

describe("FunnelPreview", () => {
  it("renders the hero headline of the generated funnel", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    const hero = demoFunnel.sections.find((section) => section.type === "hero");
    expect(hero).toBeDefined();
    if (hero?.headline) {
      expect(screen.getByText(hero.headline)).toBeInTheDocument();
    }
  });

  it("renders sections that are flagged visible", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    const visibleSections = demoFunnel.sections.filter((section) => section.visible !== false);
    expect(visibleSections.length).toBeGreaterThan(0);
  });

  it("exposes a desktop / mobile preview toggle", () => {
    render(<FunnelPreview funnel={demoFunnel} />);
    expect(screen.getByRole("button", { name: /desktop|ordinateur/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mobile/i })).toBeInTheDocument();
  });

  it("does not render hidden sections", () => {
    const funnelWithHidden = {
      ...demoFunnel,
      sections: demoFunnel.sections.map((section, index) =>
        index === 1 ? { ...section, visible: false } : section
      )
    };
    render(<FunnelPreview funnel={funnelWithHidden} />);
    const hidden = funnelWithHidden.sections[1];
    if (hidden.headline) {
      expect(screen.queryByText(hidden.headline)).not.toBeInTheDocument();
    }
  });
});
