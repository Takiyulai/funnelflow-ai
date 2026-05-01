import { describe, expect, it } from "vitest";
import { createDemoFunnel } from "@/lib/ai/generate";
import { createHtmlZipBase64, createImportGuide, createSystemeBlocks, renderFunnelHtml } from "@/lib/export/html";

const funnel = createDemoFunnel({
  brandName: "Demo",
  offerName: "Offer",
  price: "29€",
  targetAudience: "freelances",
  mainPain: "pas assez de leads",
  promise: "générer une page claire",
  tone: "direct",
  funnelType: "Tunnel ebook gratuit",
  designStyle: "minimaliste",
  language: "fr"
});

describe("HTML and Systeme.io export", () => {
  it("renders a complete responsive HTML document", () => {
    const html = renderFunnelHtml(funnel);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("viewport");
    expect(html).toContain("Recevoir les détails");
  });

  it("creates Systeme.io paste blocks and an import guide", () => {
    expect(createSystemeBlocks(funnel).length).toBeGreaterThan(3);
    expect(createImportGuide()).toContain("Systeme.io");
  });

  it("creates a zip payload", () => {
    expect(createHtmlZipBase64(funnel).length).toBeGreaterThan(100);
  });
});
