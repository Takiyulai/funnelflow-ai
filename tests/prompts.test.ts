import { describe, expect, it } from "vitest";
import {
  completeFunnelPrompt,
  regenerateSectionPrompt,
  importInspirationPrompt,
  emailSequencePrompt
} from "@/lib/ai/prompts";
import { createDemoFunnel, parseFunnelJson } from "@/lib/ai/generate";
import { makeAnchorCta } from "@/lib/funnels/types";

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
  language: "fr" as const,
  primaryCta: makeAnchorCta("Recevoir l'ebook", "lead-form")
};

describe("AI prompts", () => {
  it("injects all key brief fields into the complete prompt", () => {
    const prompt = completeFunnelPrompt(brief);
    expect(prompt).toContain("Demo Brand");
    expect(prompt).toContain("Demo Offer");
    expect(prompt).toContain("coaches");
    expect(prompt).toContain("49€");
  });

  it("enforces JSON-only output and forbids emojis / hype", () => {
    const prompt = completeFunnelPrompt(brief);
    expect(prompt.toLowerCase()).toMatch(/json/);
    expect(prompt.toLowerCase()).toMatch(/sans emoji|no emoji|aucun emoji/);
  });

  it("declares systeme.io as the priority export target", () => {
    const prompt = completeFunnelPrompt(brief);
    expect(prompt.toLowerCase()).toContain("systeme.io");
  });

  it("supports the three target languages", () => {
    for (const language of ["fr", "en", "es"] as const) {
      const prompt = completeFunnelPrompt({ ...brief, language });
      expect(prompt.toLowerCase()).toContain(language);
    }
  });

  it("regenerate prompt targets a single section", () => {
    const prompt = regenerateSectionPrompt({
      brief,
      sectionType: "hero",
      currentSection: { id: "hero-1", type: "hero", headline: "Old", body: "Old body" }
    });
    expect(prompt).toContain("hero");
    expect(prompt.toLowerCase()).toMatch(/json/);
  });

  it("inspiration prompt forbids copying third-party copy", () => {
    const prompt = importInspirationPrompt({
      brief,
      extractedContent: "Some competitor content"
    });
    expect(prompt.toLowerCase()).toMatch(/original|reformul|sans copier|do not copy/);
  });

  it("email sequence prompt asks for three emails", () => {
    const prompt = emailSequencePrompt(brief);
    expect(prompt).toMatch(/3|trois|three/i);
    expect(prompt.toLowerCase()).toMatch(/email|mail/);
  });
});

describe("Funnel JSON parser", () => {
  it("parses a valid funnel and preserves the language", () => {
    const funnel = createDemoFunnel(brief);
    const parsed = parseFunnelJson(JSON.stringify(funnel));
    expect(parsed.language).toBe("fr");
    expect(parsed.sections.length).toBe(funnel.sections.length);
  });

  it("adds missing section ids deterministically", () => {
    const funnel = createDemoFunnel(brief);
    const stripped = {
      ...funnel,
      sections: funnel.sections.map(({ id: _id, ...section }) => section)
    };
    const parsed = parseFunnelJson(JSON.stringify(stripped));
    parsed.sections.forEach((section) => {
      expect(section.id).toBeTruthy();
      expect(typeof section.id).toBe("string");
    });
  });

  it("normalizes a string CTA into a structured CtaConfig", () => {
    const funnel = createDemoFunnel(brief);
    const withStringCta = {
      ...funnel,
      sections: funnel.sections.map((section, index) =>
        index === 0 ? { ...section, cta: "Recevoir l'ebook" } : section
      )
    };
    const parsed = parseFunnelJson(JSON.stringify(withStringCta));
    const hero = parsed.sections[0];
    expect(hero.cta).toBeDefined();
    expect(typeof hero.cta).toBe("object");
    expect(hero.cta?.label).toBe("Recevoir l'ebook");
    expect(hero.cta?.mode).toBeDefined();
  });

  it("defaults visible to true and image mode to a known value", () => {
    const funnel = createDemoFunnel(brief);
    const parsed = parseFunnelJson(JSON.stringify(funnel));
    parsed.sections.forEach((section) => {
      expect(section.visible).not.toBe(false);
      if (section.image) {
        expect(["none", "upload", "ai-suggested"]).toContain(section.image.mode);
      }
    });
  });
});
