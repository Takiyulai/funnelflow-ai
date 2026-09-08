import { describe, expect, it } from "vitest";
import { regenerateSectionPrompt } from "@/lib/ai/prompts";
import { mergeRegeneratedSections } from "@/lib/funnels/mergeRegeneratedSections";
import { combinePhoneNumber, isPhoneField } from "@/lib/funnels/phone";
import type { FunnelBrief, FunnelSection } from "@/lib/funnels/types";

const brief: FunnelBrief = {
  brandName: "Marque",
  offerName: "Offre",
  price: "",
  targetAudience: "indépendants",
  mainPain: "manque de temps",
  promise: "aller plus vite",
  tone: "direct",
  funnelType: "lead-magnet",
  designStyle: "premium",
  language: "fr",
};

describe("régénération de copy", () => {
  it("limite le prompt à une seule section et au nombre de mots choisi", () => {
    const prompt = regenerateSectionPrompt({
      brief,
      section: {
        type: "about",
        headline: "À propos",
        subheadline: "Une introduction",
        body: "Le texte actuel",
        bullets: [],
      },
      maxWords: 100,
    });

    expect(prompt).toContain("UNIQUEMENT cette section");
    expect(prompt).toContain("100 mots");
    expect(prompt).not.toContain("80 à 200 mots minimum");
    expect(prompt).not.toContain("au moins 5 FAQ");
  });

  it("préserve le design et les actions d'une page déjà construite", () => {
    const previous: FunnelSection[] = [{
      id: "about-existing",
      type: "about",
      headline: "Ancien titre",
      style: { colors: { ink: "#ffffff" } },
      background: { imageUrl: "https://example.com/background.jpg" },
      layoutVariant: "split-text-image",
      cta: { mode: "redirect", label: "Ancien CTA", url: "https://example.com" },
    }];
    const generated: FunnelSection[] = [{
      id: "about-generated",
      type: "about",
      headline: "Nouveau titre",
      style: { colors: { ink: "#000000" } },
      cta: { mode: "popup", label: "Nouveau CTA", popupId: "generated" },
    }];

    const [merged] = mergeRegeneratedSections(previous, generated);
    expect(merged.id).toBe("about-existing");
    expect(merged.headline).toBe("Nouveau titre");
    expect(merged.style).toEqual(previous[0].style);
    expect(merged.background).toEqual(previous[0].background);
    expect(merged.layoutVariant).toBe("split-text-image");
    expect(merged.cta).toEqual({
      mode: "redirect",
      label: "Nouveau CTA",
      url: "https://example.com",
    });
  });

  it("conserve l'ordre et la structure d'une page existante", () => {
    const previous: FunnelSection[] = [
      { id: "hero", type: "hero", headline: "Hero actuel" },
      { id: "about", type: "about", headline: "À propos actuel" },
    ];
    const generated: FunnelSection[] = [
      { id: "about-new", type: "about", headline: "À propos réécrit" },
      { id: "faq-new", type: "faq", headline: "FAQ inventée" },
      { id: "hero-new", type: "hero", headline: "Hero réécrit" },
    ];

    const merged = mergeRegeneratedSections(previous, generated);
    expect(merged.map((section) => section.id)).toEqual(["hero", "about"]);
    expect(merged.map((section) => section.type)).toEqual(["hero", "about"]);
    expect(merged.map((section) => section.headline)).toEqual([
      "Hero réécrit",
      "À propos réécrit",
    ]);
  });
});

describe("champ téléphone rétrocompatible", () => {
  it("reconnaît un ancien champ WhatsApp enregistré comme nombre", () => {
    expect(isPhoneField({ name: "whatsapp", label: "WhatsApp", type: "number" })).toBe(true);
  });

  it("assemble l'indicatif et le numéro local", () => {
    expect(combinePhoneNumber("+237", "069 12-34-56")).toBe("+23769123456");
  });
});
