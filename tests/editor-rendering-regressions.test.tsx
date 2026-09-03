import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CtaTab } from "@/components/editor/tabs/CtaTab";
import { StyleTab } from "@/components/editor/tabs/StyleTab";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { HeroRenderer } from "@/components/funnel/sections/HeroRenderer";
import { splitTitleDesc } from "@/components/funnel/templates/skins/shared";
import { ProductDashboardPreview } from "@/components/marketing/ProductDashboardPreview";
import { demoFunnel } from "@/lib/funnels/demo";
import { splitTextPair } from "@/lib/funnels/text";
import { renderFunnelHtml } from "@/lib/export/html";
import type { Funnel, FunnelPage, FunnelSection } from "@/lib/funnels/types";

function withSection(section: FunnelSection, templateId = "cosmos-night") {
  const page: FunnelPage = {
    id: "home", name: "Accueil", slug: "accueil", role: "optin",
    visible: true, isHome: true, sections: [section],
  };
  const funnel: Funnel = {
    ...demoFunnel, sections: [section], pages: [page],
    meta: { ...demoFunnel.meta, templateId },
  };
  return { funnel, page };
}

function CtaEditor({ global = true, legacy = false, specific = false }: { global?: boolean; legacy?: boolean; specific?: boolean }) {
  const section: FunnelSection = {
    id: "cta-test", type: "hero", cta: {
      mode: "popup", label: "Je veux mon guide", popupProvider: "systeme", systemePopupId: "24034535",
      ignoreGlobalCta: specific,
    },
  };
  const initial = withSection(section).funnel;
  const [funnel, setFunnel] = useState<Funnel>({
    ...initial, pages: legacy ? undefined : initial.pages,
    defaultCta: section.cta, meta: { ...initial.meta, applyDefaultCtaToAll: global },
  });
  const current = funnel.pages?.[0].sections[0] ?? funnel.sections[0];
  return <>
    <CtaTab
      section={current} funnel={funnel} language="fr"
      onChange={(patch) => setFunnel({
        ...funnel,
        sections: [{ ...current, ...patch }],
        pages: funnel.pages?.map((page) => ({ ...page, sections: [{ ...current, ...patch }] })),
      })}
      onFunnelChange={(patch) => setFunnel({ ...funnel, ...patch })}
    />
    <output data-testid="cta-state">{JSON.stringify(funnel)}</output>
  </>;
}

describe("édition atomique des CTA", () => {
  it.each([false, true])("permet d'effacer puis ressaisir avec une action globale (legacy=%s)", (legacy) => {
    render(<CtaEditor legacy={legacy} />);
    const label = screen.getByPlaceholderText("Ex : Je commence maintenant");
    const popupId = screen.getByPlaceholderText("24034535");
    fireEvent.change(label, { target: { value: "" } });
    expect(label).toHaveValue("");
    fireEvent.change(label, { target: { value: "Recevoir maintenant" } });
    fireEvent.change(popupId, { target: { value: "" } });
    expect(popupId).toHaveValue("");
    fireEvent.change(popupId, { target: { value: "12345" } });
    const state = JSON.parse(screen.getByTestId("cta-state").textContent!);
    expect(state.sections[0].cta).toMatchObject({ label: "Recevoir maintenant", systemePopupId: "12345" });
    expect(state.defaultCta).toMatchObject({ label: "Recevoir maintenant", systemePopupId: "12345" });
    if (!legacy) expect(state.pages[0].sections[0].cta).toEqual(state.sections[0].cta);
  });

  it("préserve le CTA global quand on édite un CTA local sans partage", () => {
    render(<CtaEditor global={false} />);
    fireEvent.change(screen.getByPlaceholderText("Ex : Je commence maintenant"), { target: { value: "" } });
    const state = JSON.parse(screen.getByTestId("cta-state").textContent!);
    expect(state.sections[0].cta.label).toBe("");
    expect(state.defaultCta.label).toBe("Je veux mon guide");
  });

  it("préserve l'action globale quand le bouton local l'ignore", () => {
    render(<CtaEditor specific />);
    fireEvent.change(screen.getByPlaceholderText("24034535"), { target: { value: "" } });
    const state = JSON.parse(screen.getByTestId("cta-state").textContent!);
    expect(state.sections[0].cta.systemePopupId).toBe("");
    expect(state.defaultCta.systemePopupId).toBe("24034535");
  });

  it("active l'action commune et lève l'exclusion locale en une seule mise à jour", () => {
    render(<CtaEditor global={false} specific />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Appliquer cette action/ }));
    const state = JSON.parse(screen.getByTestId("cta-state").textContent!);
    expect(state.meta.applyDefaultCtaToAll).toBe(true);
    expect(state.sections[0].cta.ignoreGlobalCta).toBe(false);
    expect(state.defaultCta).toEqual(state.sections[0].cta);
  });
});

describe("couleurs de texte et ordre des bénéfices", () => {
  const bullet = "[[Démarrez|#846310]] à votre rythme | Un programme adapté à votre quotidien, sans contrainte.";
  it("ignore les séparateurs situés dans les marqueurs de couleur", () => {
    expect(splitTextPair("[[Démarrez|#846310]] à votre rythme")).toBeNull();
    expect(splitTitleDesc(bullet)).toEqual({ title: "[[Démarrez|#846310]] à votre rythme", description: "Un programme adapté à votre quotidien, sans contrainte." });
  });

  it.each(["cosmos-night", "lead-snap"])("rend la couleur sans afficher la syntaxe dans %s", (templateId) => {
    const section: FunnelSection = {
      id: "benefits", type: "benefits", pattern: "benefits-cards-4-shadow-longtext",
      headline: "Une méthode adaptée", subheadline: "Vos bénéfices", body: "Le détail du programme.", bullets: [bullet],
    };
    const { funnel, page } = withSection(section, templateId);
    const { container } = render(<FunnelPreview funnel={funnel} activePage={page} showToolbar={false} />);
    expect(screen.getByText("Démarrez")).toHaveStyle({ color: "#846310" });
    expect(container.textContent).not.toContain("[[");
    if (templateId === "cosmos-night") {
      const text = container.textContent!;
      expect(text.indexOf("Une méthode adaptée")).toBeLessThan(text.indexOf("Le détail du programme."));
      expect(screen.getAllByText("Le détail du programme.")).toHaveLength(1);
    }
  });

  it("conserve les couleurs et l'alignement dans l'export HTML", () => {
    const section: FunnelSection = { id: "benefits", type: "benefits", headline: "Bénéfices", bullets: [bullet], style: { align: "right" } };
    const { funnel } = withSection(section);
    const html = renderFunnelHtml(funnel);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rendered = doc.querySelector('[data-ff-section="benefits"]')!;
    expect(rendered.getAttribute("data-ff-text-align")).toBe("right");
    expect(rendered.textContent).not.toContain("[[");
    expect(rendered.querySelector('.ff-hl[style*="#846310"]')).not.toBeNull();
  });
});

describe("fond et alignement du hero", () => {
  it.each(["hero-centered-nav-glow", "hero-split-stats-search-b2b", "hero-video-centered-funnel"])("affiche le fond choisi pour %s", (pattern) => {
    const section: FunnelSection = { id: "hero", type: "hero", pattern, headline: "Bienvenue", background: { imageUrl: "https://example.com/fond.jpg", overlayOpacity: 35 }, style: { align: "right" } };
    const { container } = render(<HeroRenderer section={section} />);
    expect(container.querySelector('section')).toHaveAttribute("data-ff-text-align", "right");
    expect(container.querySelector('[style*="fond.jpg"]')).not.toBeNull();
  });

  it("permet de revenir à l'alignement automatique du template", () => {
    function Editor() {
      const [section, setSection] = useState<FunnelSection>({ id: "hero", type: "hero", style: { align: "right" } });
      return <><StyleTab section={section} language="fr" onChange={(patch) => setSection({ ...section, ...patch })} /><output data-testid="align">{section.style?.align ?? "auto"}</output></>;
    }
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Gauche" }));
    expect(screen.getByTestId("align")).toHaveTextContent("left");
    fireEvent.click(screen.getByRole("button", { name: "Automatique" }));
    expect(screen.getByTestId("align")).toHaveTextContent("auto");
  });
});

describe("aperçu produit de la landing", () => {
  it("présente le dashboard AutoFunnel avec une mention illustrative explicite", () => {
    render(<ProductDashboardPreview language="fr" />);
    expect(screen.getByRole("heading", { name: "Votre activité, au même endroit." })).toBeInTheDocument();
    expect(screen.getByText("Contacts dans le CRM")).toBeInTheDocument();
    expect(screen.getByText("Le suivi continue, automatiquement")).toBeInTheDocument();
    expect(screen.getByText("Aperçu du produit · données d’illustration")).toBeInTheDocument();
  });
});
