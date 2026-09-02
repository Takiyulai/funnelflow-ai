import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PageRegenPanel, isPageGenerationPlaceholder } from "@/components/editor/PageRegenPanel";
import { MediaTab } from "@/components/editor/tabs/MediaTab";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";
import type { FunnelPage, FunnelSection, ImageAnimation } from "@/lib/funnels/types";

const image = { mode: "upload" as const, url: "https://example.com/photo.jpg", alt: "Photo du programme" };
const emptyPage: FunnelPage = {
  id: "page-new", name: "Nouvelle page 3", slug: "page-3", role: "custom",
  visible: true, isHome: false,
  sections: [{ id: "hero-new", type: "hero", headline: "Nouvelle section", image }],
};
const existingPage: FunnelPage = {
  ...emptyPage, id: "confirmation", role: "confirmation",
  sections: [{ id: "thanks", type: "hero", headline: "Inscription confirmée" }],
};

afterEach(() => vi.unstubAllGlobals());

describe("génération d'une nouvelle page", () => {
  it("distingue un placeholder d'une page courte déjà rédigée", () => {
    expect(isPageGenerationPlaceholder(emptyPage)).toBe(true);
    expect(isPageGenerationPlaceholder({ ...emptyPage, sections: [] })).toBe(true);
    expect(isPageGenerationPlaceholder(existingPage)).toBe(false);
    expect(isPageGenerationPlaceholder({ ...emptyPage, sections: [{ ...emptyPage.sections[0], body: "Mon texte" }] })).toBe(false);
    expect(isPageGenerationPlaceholder({ ...emptyPage, sections: [{ ...emptyPage.sections[0], type: "raw-html" }] })).toBe(false);
  });

  it("ne reporte ni le rôle, ni les instructions d'une autre page", () => {
    const props = { funnel: demoFunnel, onApply: vi.fn() };
    const { rerender } = render(<PageRegenPanel {...props} page={existingPage} />);
    fireEvent.click(screen.getByRole("button", { name: /Régénérer toute la page/ }));
    expect(screen.getByRole("button", { name: "Confirmation" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ancienne instruction" } });

    rerender(<PageRegenPanel {...props} page={emptyPage} />);
    expect(screen.getByRole("button", { name: /Générer cette nouvelle page/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Libre" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Objectif de la nouvelle page" })).toHaveValue("");
    expect(screen.queryByText("Rends le copy plus percutant")).not.toBeInTheDocument();
  });

  it("génère seulement la page sélectionnée et conserve ses médias à l'application", async () => {
    const generated: FunnelSection[] = [{ id: "offer-hero", type: "hero", headline: "Votre accompagnement" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ sections: generated }) });
    vi.stubGlobal("fetch", fetchMock);
    const onApply = vi.fn();
    render(<PageRegenPanel funnel={demoFunnel} page={emptyPage} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Vente" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Présente mon coaching" } });
    fireEvent.click(screen.getByRole("button", { name: "Générer la nouvelle page" }));
    await screen.findByRole("button", { name: "Appliquer à la page" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ role: "sales", slug: "page-3", instruction: "Présente mon coaching" });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Appliquer à la page" }));
    expect(onApply).toHaveBeenCalledWith([{ ...generated[0], image, video: undefined }], "sales");
  });
});

describe("réglages de médias", () => {
  function MediaEditor() {
    const [section, setSection] = useState<FunnelSection>({ id: "media", type: "about", headline: "À propos" });
    return <MediaTab section={section} funnel={demoFunnel} language="fr" onChange={(patch) => setSection((s) => ({ ...s, ...patch }))} />;
  }

  it("conserve Vimeo avant de saisir le lien et après l'avoir effacé", () => {
    render(<MediaEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Vimeo" }));
    expect(screen.getByRole("button", { name: "Vimeo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "YouTube" })).toHaveAttribute("aria-pressed", "false");
    const url = screen.getByPlaceholderText("https://vimeo.com/123456789");
    fireEvent.change(url, { target: { value: "https://vimeo.com/123456789" } });
    fireEvent.change(url, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Vimeo" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "URL directe" }));
    expect(screen.getByPlaceholderText("https://exemple.com/video.mp4")).toBeInTheDocument();
  });

  function preview(radius?: number, animation?: ImageAnimation) {
    const section: FunnelSection = {
      id: "proof", type: "testimonials", headline: "Résultats réels",
      animations: { headline: "none" },
      image: { ...image, frame: radius === undefined ? undefined : { radius }, animation },
    };
    const page = { ...existingPage, role: "optin" as const, isHome: true, sections: [section] };
    const funnel = { ...demoFunnel, pages: [page], sections: [section], meta: { ...demoFunnel.meta, templateId: "cosmos-night" } };
    return <FunnelPreview funnel={funnel} activePage={page} showToolbar={false} />;
  }

  it("transmet l'arrondi 0 puis 48px et restaure le défaut quand le réglage est retiré", () => {
    const { container, rerender } = render(preview(0));
    const figure = () => container.querySelector<HTMLElement>(".ff-image-wrap")!;
    expect(figure().style.getPropertyValue("--ff-img-radius")).toBe("0px");
    rerender(preview(48));
    expect(figure().style.getPropertyValue("--ff-img-radius")).toBe("48px");
    rerender(preview());
    expect(figure().style.getPropertyValue("--ff-img-radius")).toBe("");
    // Vérifie aussi la règle !important qui écrasait le réglage dans Cosmos.
    const css = readFileSync("app/funnel-theme.css", "utf8");
    expect(css).toContain("border-radius: var(--ff-img-radius, 16px) !important");
  });

  it("réarme seulement l'image quand son animation change, sans animer les simples réglages de cadre", async () => {
    const { container, rerender } = render(preview(0, "none"));
    const previous = container.querySelector(".ff-image-wrap");
    rerender(preview(0, "slide-left"));
    const next = container.querySelector(".ff-image-wrap");
    expect(next).not.toBe(previous);
    expect(next).toHaveAttribute("data-ff-anim", "slide-left");
    expect(next).toHaveAttribute("data-ff-anim-override", "true");
    rerender(preview(48, "slide-left"));
    expect(container.querySelector(".ff-image-wrap")).toBe(next);
    rerender(preview(48, "float"));
    await waitFor(() => expect(container.querySelector(".ff-image-wrap")).toHaveAttribute("data-ff-img-anim", "float"));
  });
});
