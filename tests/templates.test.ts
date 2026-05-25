import { describe, expect, it } from "vitest";
import { funnelTemplates } from "@/lib/funnels/templates";
import type { FunnelSectionType } from "@/lib/funnels/types";

describe("Funnel templates catalogue", () => {
  it("ships a non-empty list of templates", () => {
    expect(funnelTemplates.length).toBeGreaterThan(0);
  });

  it("every template has stable id, name, objective and sections", () => {
    funnelTemplates.forEach((template) => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.objective).toBeTruthy();
      expect(Array.isArray(template.sections)).toBe(true);
      expect(template.sections.length).toBeGreaterThanOrEqual(4);
    });
  });

  it("template ids are unique", () => {
    const ids = funnelTemplates.map((template) => template.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("contains the ebook-creation-service template", () => {
    const ids = funnelTemplates.map((template) => template.id);
    expect(ids).toContain("ebook-creation-service");
  });

  it("each section has a known type", () => {
    const knownTypes = new Set<FunnelSectionType>([
      "hero",
      "about",
      "problem",
      "solution",
      "benefits",
      "proof",
      "offer",
      "bonus",
      "guarantee",
      "faq",
      "cta",
      "form",
      "thank_you",
      "program",
      "pricing",
      "process",
      "webinar",
      "video",
      "qualification",
      "testimonials",
    ]);
    funnelTemplates.forEach((template) => {
      template.sections.forEach((section) => {
        expect(knownTypes.has(section)).toBe(true);
      });
    });
  });
});
