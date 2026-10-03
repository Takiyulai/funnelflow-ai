import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { createDemoFunnel } from "@/lib/ai/generate";
import {
  createHtmlZipBase64,
  createImportGuide,
  createSystemeBlocks,
  renderFunnelCss,
  renderFunnelHtml
} from "@/lib/export/html";
import { makeAnchorCta } from "@/lib/funnels/types";

const baseBrief = {
  brandName: "Demo",
  offerName: "Offer",
  price: "29€",
  targetAudience: "freelances",
  mainPain: "pas assez de leads",
  promise: "générer une page claire",
  tone: "direct",
  funnelType: "Tunnel ebook gratuit",
  designStyle: "minimaliste",
  language: "fr" as const,
  primaryCta: makeAnchorCta("Recevoir l'ebook", "lead-form")
};

const funnel = createDemoFunnel(baseBrief);

describe("Systeme.io HTML export", () => {
  it("never emits <!doctype>, <html>, <head> or <body>", () => {
    const html = renderFunnelHtml(funnel);
    expect(html.toLowerCase()).not.toContain("<!doctype");
    expect(html.toLowerCase()).not.toContain("<html");
    expect(html.toLowerCase()).not.toContain("<head");
    expect(html.toLowerCase()).not.toContain("<body");
  });

  it("wraps content under .ff-page and includes a scoped <style>", () => {
    const html = renderFunnelHtml(funnel);
    expect(html).toContain('class="ff-page"');
    expect(html).toMatch(/<style>[\s\S]*\.ff-page[\s\S]*<\/style>/);
  });

  it("renders sections with ff-section class and a type qualifier", () => {
    const html = renderFunnelHtml(funnel);
    expect(html).toContain("ff-section");
    expect(html).toMatch(/ff-(hero|problem|solution|offer|form|faq)/);
  });

  it("renders forms with onsubmit return false and no inline JS handlers", () => {
    const html = renderFunnelHtml(funnel);
    if (html.includes("<form")) {
      expect(html).toContain('onsubmit="return false;"');
    }
    expect(html).not.toContain("document.write");
    expect(html).not.toMatch(/\balert\s*\(/);
  });

  it("produces standalone CSS scoped under .ff-page", () => {
    const css = renderFunnelCss(funnel);
    expect(css).toContain(".ff-page");
    expect(css).not.toMatch(/^\s*body\s*\{/m);
    expect(css).not.toMatch(/^\s*html\s*\{/m);
  });

  it("keeps a video below its text even when an old split layout is stored", () => {
    const videoFunnel = {
      ...funnel,
      sections: [
        {
          id: "video-demo",
          type: "solution",
          headline: "Démonstration",
          body: "Le contenu précède toujours la vidéo.",
          video: { url: "https://cdn.example.org/demo.mp4" },
          layoutVariant: "split-text-image",
          style: { contentOffsetY: 24 },
          visible: true,
        },
      ],
    } as unknown as typeof funnel;

    const html = renderFunnelHtml(videoFunnel);
    expect(html).toContain('data-ff-layout="centered"');
    expect(html).toContain('data-ff-has-video="true"');
    expect(html).toContain('data-ff-content-offset="true"');
    expect(html).toContain("--ff-content-offset-y:24px");
    expect(html.indexOf("Le contenu précède toujours la vidéo.")).toBeLessThan(
      html.indexOf("<video"),
    );
  });

  it("keeps desktop media inside the right section and preserves pattern layouts", () => {
    const regressionFunnel = {
      ...funnel,
      sections: [
        {
          id: "hero-layout",
          type: "hero",
          pattern: "hero-split-product-mockup",
          headline: "Un hero réellement en deux colonnes",
          body: "Le texte reste à gauche et le visuel à droite.",
          image: { mode: "url", url: "https://cdn.example.org/book.png", alt: "Livre" },
          visible: true,
        },
        {
          id: "benefits-layout",
          type: "benefits",
          pattern: "benefits-cards-4-shadow-longtext",
          headline: "Un bénéfice important",
          bullets: ["Des pages de capture en quelques minutes"],
          visible: true,
        },
        {
          id: "video-layout",
          type: "solution",
          headline: "La démonstration",
          video: { url: "https://cdn.example.org/demo.mp4" },
          visible: true,
        },
        {
          id: "stats-layout",
          type: "proof",
          pattern: "stats-cards-4-suffix-badge",
          eyebrow: "Résultats concrets",
          bullets: [
            "< 5 MINUTES | pour générer un tunnel complet",
            "x 3.4 | taux de conversion moyen constaté",
            "1 CLIC | pour exporter vers systeme.io",
            "0 € | compétence technique requise",
          ],
          visible: true,
        },
      ],
    } as unknown as typeof funnel;

    const html = renderFunnelHtml(regressionFunnel);
    const $ = load(html);

    expect($('.ff-page[data-ff-systeme="true"]').length).toBe(1);
    expect($('#hero-layout[data-ff-layout="split"] .ff-split-grid').length).toBe(1);
    expect($('#hero-layout img[src="https://cdn.example.org/book.png"]').length).toBe(1);
    expect($("#hero-layout video").length).toBe(0);
    expect($('#video-layout[data-ff-has-video="true"] video').length).toBe(1);
    expect($("#benefits-layout .ff-list-card").length).toBe(1);
    expect($('#stats-layout[data-ff-pattern="stats-cards-4-suffix-badge"] .ff-stat-card').length).toBe(4);
    expect($("#stats-layout .ff-bullets").length).toBe(0);
  });

  it("includes a direct media-query fallback that systeme.io cannot collapse", () => {
    const html = renderFunnelHtml(funnel);
    expect(html).toContain('@media (min-width: 760px)');
    expect(html).toContain('.ff-page[data-ff-systeme="true"] .ff-split-grid');
    expect(html).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
  });
});

// createDemoFunnel ne produit qu'une section (hero). Pour vérifier que
// createSystemeBlocks génère bien UN bloc indépendant PAR section, on lui
// fournit un funnel multi-sections représentatif.
const multiSectionFunnel = {
  ...funnel,
  sections: [
    { id: "hero", type: "hero", headline: "Bienvenue", visible: true },
    { id: "problem", type: "problem", headline: "Le problème", visible: true },
    { id: "solution", type: "solution", headline: "La solution", visible: true },
    { id: "offer", type: "offer", headline: "Notre offre", visible: true },
    { id: "faq", type: "faq", headline: "Questions fréquentes", visible: true },
  ],
} as unknown as typeof funnel;

describe("Systeme.io block export", () => {
  it("creates more than three independent blocks", () => {
    const blocks = createSystemeBlocks(multiSectionFunnel);
    expect(blocks.length).toBeGreaterThan(3);
  });

  it("each block is self-contained with its own scoped <style>", () => {
    const blocks = createSystemeBlocks(multiSectionFunnel);
    for (const block of blocks) {
      const html = typeof block === "string" ? block : block.html;
      expect(html.toLowerCase()).not.toContain("<html");
      expect(html.toLowerCase()).not.toContain("<body");
      expect(html).toMatch(/<style>[\s\S]*<\/style>/);
      expect(html).toMatch(/class="ff-[a-z0-9-]+/);
    }
  });

  it("provides an import guide mentioning Systeme.io", () => {
    const guide = createImportGuide();
    expect(guide.toLowerCase()).toContain("systeme.io");
  });
});

describe("ZIP packaging", () => {
  it("creates a non-empty base64 zip payload", async () => {
    const base64 = await createHtmlZipBase64(funnel);
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(100);
    expect(base64).toMatch(/^[A-Za-z0-9+/=\r\n]+$/);
  });
});
