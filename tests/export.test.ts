import { describe, expect, it } from "vitest";
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
});

describe("Systeme.io block export", () => {
  it("creates more than three independent blocks", () => {
    const blocks = createSystemeBlocks(funnel);
    expect(blocks.length).toBeGreaterThan(3);
  });

  it("each block is self-contained with its own scoped <style>", () => {
    const blocks = createSystemeBlocks(funnel);
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
  it("creates a non-empty base64 zip payload", () => {
    const base64 = createHtmlZipBase64(funnel);
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(100);
    expect(base64).toMatch(/^[A-Za-z0-9+/=\r\n]+$/);
  });
});
