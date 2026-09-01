import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CtaButton } from "@/components/funnel/CtaButton";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";
import type { FunnelPage, FunnelSection } from "@/lib/funnels/types";

function funnelWithSection(section: FunnelSection) {
  const page: FunnelPage = {
    id: "home-test",
    slug: "accueil",
    name: "Accueil",
    role: "optin",
    sections: [section],
    visible: true,
    isHome: true,
  };
  return {
    page,
    funnel: {
      ...demoFunnel,
      meta: { ...demoFunnel.meta, templateId: "cosmos-night" },
      sections: [section],
      pages: [page],
    },
  };
}

describe("template media layout regressions", () => {
  it("keeps a testimonial grid when the wizard adds a section image", () => {
    const section: FunnelSection = {
      id: "proof-with-media",
      type: "testimonials",
      headline: "Résultats réels",
      layoutVariant: "feature-grid",
      image: {
        mode: "upload",
        url: "https://example.com/proof.jpg",
        alt: "Preuve client",
      },
      items: [
        {
          kind: "testimonial",
          data: { quote: "Un vrai résultat.", authorName: "Claire" },
        },
      ],
    };
    const { funnel, page } = funnelWithSection(section);
    const { container } = render(
      <FunnelPreview funnel={funnel} activePage={page} showToolbar={false} />,
    );

    expect(
      container.querySelector('[data-ff-section="testimonials"]'),
    ).toHaveAttribute("data-ff-layout", "feature-grid");
    expect(screen.getByAltText("Preuve client")).toHaveClass("w-full", "h-auto");
  });

  it("renders a FAQ CTA only once outside the redundant help block", () => {
    const section: FunnelSection = {
      id: "faq-with-cta",
      type: "faq",
      headline: "Questions fréquentes",
      pattern: "faq-grid-intro",
      cta: { label: "Recevoir mon guide", mode: "anchor", anchorId: "lead-form" },
      items: [
        {
          kind: "faq",
          data: { question: "Comment commencer ?", answer: "En quelques minutes." },
        },
      ],
    };
    const { funnel, page } = funnelWithSection(section);
    render(<FunnelPreview funnel={funnel} activePage={page} showToolbar={false} />);

    expect(screen.queryByText("Pas trouvé ta réponse ?")).not.toBeInTheDocument();
    expect(screen.getAllByText("Recevoir mon guide")).toHaveLength(1);
  });

  it("always gives shared CTA buttons the themed, non-transparent contract", () => {
    render(
      <CtaButton
        cta={{ label: "Télécharger", mode: "anchor", anchorId: "lead-form" }}
      />,
    );

    const cta = screen.getByRole("link", { name: /télécharger/i });
    expect(cta).toHaveClass("ff-btn");
    expect(cta).toHaveAttribute("data-ff-cta");
  });
});
