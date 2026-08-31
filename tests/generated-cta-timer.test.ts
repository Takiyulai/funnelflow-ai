import { describe, expect, it } from "vitest";
import {
  ensureEditableCtaPatternTimer,
  harmonizeCTAsByFunnelKind,
} from "@/lib/ai/generate";
import type {
  Funnel,
  FunnelBrief,
  FunnelPage,
  FunnelSection,
} from "@/lib/funnels/types";

function ctaSection(id: string, type: FunnelSection["type"] = "cta"): FunnelSection {
  return {
    id,
    type,
    headline: `Titre ${id}`,
    cta: { label: "Libellé généré", mode: "anchor", anchorId: "ancienne-ancre" },
    visible: true,
  } as FunnelSection;
}

function page(
  id: string,
  role: FunnelPage["role"],
  sections: FunnelSection[],
  isHome = false,
): FunnelPage {
  return {
    id,
    slug: id,
    name: id,
    role,
    sections,
    visible: true,
    isHome,
  };
}

describe("timer des patterns CTA générés", () => {
  it("ajoute un vrai TimerItem éditable au pattern glow", () => {
    const section = ctaSection("cta-glow");
    section.pattern = "cta-final-glow-countdown";

    ensureEditableCtaPatternTimer(section);

    const timers = section.items?.filter((item) => item.kind === "timer") ?? [];
    expect(timers).toHaveLength(1);
    expect(timers[0].data.mode).toBe("countdown-duration");
    expect(timers[0].data.durationHours).toBe(24);
  });

  it("ne duplique pas un timer métier déjà présent", () => {
    const section = ctaSection("cta-glow-existing");
    section.pattern = "cta-final-glow-countdown";
    section.items = [
      {
        kind: "timer",
        data: {
          id: "timer-existing",
          mode: "seats-counter",
          seatsTotal: 20,
          seatsRemaining: 3,
        },
      },
    ];

    ensureEditableCtaPatternTimer(section);
    expect(section.items).toHaveLength(1);
    expect(section.items?.[0]).toMatchObject({
      kind: "timer",
      data: { id: "timer-existing", mode: "seats-counter" },
    });
  });

  it("ne touche pas aux autres patterns CTA", () => {
    const section = ctaSection("cta-centered");
    section.pattern = "cta-final-centered-urgency";

    ensureEditableCtaPatternTimer(section);
    expect(section.items).toBeUndefined();
  });
});

describe("libellé CTA saisi dans le wizard", () => {
  it("est conservé sur les CTA de conversion principaux", () => {
    const landing = page(
      "accueil",
      "landing",
      [ctaSection("hero", "hero"), ctaSection("cta-final")],
      true,
    );
    const optin = page(
      "inscription",
      "optin",
      [ctaSection("form", "form"), ctaSection("cta-optin")],
    );
    const offer = page(
      "offre",
      "oto",
      [ctaSection("pricing", "pricing")],
    );
    const funnel = {
      funnelName: "Test",
      language: "fr",
      pages: [landing, optin, offer],
      sections: landing.sections,
      design: {},
      meta: { funnelKind: "lead-magnet" },
    } as Funnel;
    const brief = {
      language: "fr",
      funnelKind: "lead-magnet",
      price: "Gratuit",
      primaryCta: {
        label: "Je reçois mon programme gratuit",
        mode: "anchor",
        anchorId: "lead-form",
      },
    } as FunnelBrief;

    const result = harmonizeCTAsByFunnelKind(funnel, brief);
    const conversionLabels = result.pages!
      .filter((candidate) => candidate.role === "landing" || candidate.role === "optin")
      .flatMap((candidate) => candidate.sections)
      .map((section) => section.cta?.label)
      .filter(Boolean);

    expect(conversionLabels).not.toHaveLength(0);
    expect(conversionLabels.every((label) => label === "Je reçois mon programme gratuit")).toBe(true);
    // Une offre secondaire conserve son vocabulaire d'achat spécifique.
    expect(result.pages!.find((candidate) => candidate.role === "oto")?.sections[0].cta?.label)
      .toBe("Je profite de l'offre");
  });
});
