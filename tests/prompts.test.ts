import { describe, expect, it } from "vitest";
import { completeFunnelPrompt } from "@/lib/ai/prompts";
import { createDemoFunnel, parseFunnelJson } from "@/lib/ai/generate";

const brief = {
  brandName: "Demo Brand",
  offerName: "Demo Offer",
  price: "49€",
  targetAudience: "coaches",
  mainPain: "manque de clarté",
  promise: "vendre mieux",
  tone: "premium",
  funnelType: "Vente ebook premium",
  designStyle: "premium",
  language: "fr" as const
};

describe("AI prompts and parser", () => {
  it("injects the funnel brief into the complete prompt", () => {
    const prompt = completeFunnelPrompt(brief);
    expect(prompt).toContain("Demo Brand");
    expect(prompt).toContain("Retourner uniquement du JSON valide");
    expect(prompt).toContain("AIDA, PAS et Story-Proof-Offer");
  });

  it("parses valid funnel JSON and adds missing section ids", () => {
    const funnel = createDemoFunnel(brief);
    const parsed = parseFunnelJson(JSON.stringify({
      ...funnel,
      sections: funnel.sections.map(({ id: _id, ...section }) => section)
    }));
    expect(parsed.sections[0].id).toBe("hero-1");
    expect(parsed.language).toBe("fr");
  });
});
