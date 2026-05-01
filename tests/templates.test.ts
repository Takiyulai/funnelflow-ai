import { describe, expect, it } from "vitest";
import { funnelTemplates } from "@/lib/funnels/templates";

describe("V1 templates", () => {
  it("ships the eight mandatory funnel templates", () => {
    expect(funnelTemplates).toHaveLength(8);
    expect(funnelTemplates.map((template) => template.id)).toContain("ebook-creation-service");
    expect(funnelTemplates.every((template) => template.sections.length >= 6)).toBe(true);
  });
});
