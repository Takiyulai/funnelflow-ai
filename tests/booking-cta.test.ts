// tests/booking-cta.test.ts
//
// Destination des CTA d'un tunnel « booking » — les trois branches.
//
// ── POURQUOI CES TESTS EXISTENT ────────────────────────────────────────────
// `harmonizeCTAsByFunnelKind` décide où pointent TOUS les boutons du tunnel, et
// n'avait aucune couverture. Elle a causé coup sur coup deux régressions
// silencieuses :
//   1. les CTA menaient à une page de réservation décorative, incapable de
//      réserver quoi que ce soit ;
//   2. après retrait de cette page, ils ancraient vers un `#lead-form`
//      inexistant — un bouton qui ne fait rien, sans la moindre erreur.
// Les deux fois, rien ne se voyait avant un test manuel de bout en bout.
//
// Les trois branches verrouillées ici : natif, externe, et repli.

import { describe, it, expect } from "vitest";
import { harmonizeCTAsByFunnelKind } from "@/lib/ai/generate";
import {
  bookingExternalUrlMissing,
  externalCalendarUrl,
  isAbsoluteHttpUrl,
  resolveBookingMode,
  usesNativeBookingEngine,
} from "@/lib/booking/mode";
import type { Funnel, FunnelBrief, FunnelPage, FunnelSection } from "@/lib/funnels/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function section(type: string, withCta = true): FunnelSection {
  return {
    id: `sec-${type}`,
    type: type as FunnelSection["type"],
    headline: `Titre ${type}`,
    ...(withCta ? { cta: { label: "Bouton", mode: "anchor", anchorId: "x" } } : {}),
  } as FunnelSection;
}

function page(role: string, types: string[], isHome = false): FunnelPage {
  return {
    id: `page-${role}`,
    slug: role,
    name: role,
    role: role as FunnelPage["role"],
    sections: types.map((t) => section(t)),
    visible: true,
    isHome,
  } as FunnelPage;
}

function bookingFunnel(meta: Record<string, unknown> = {}): Funnel {
  const home = page("landing", ["hero", "benefits", "cta"], true);
  return {
    funnelName: "Test",
    language: "fr",
    pages: [home, page("confirmation", ["hero", "cta"])],
    sections: home.sections,
    design: {} as any,
    meta: { funnelKind: "booking", ...meta },
  } as unknown as Funnel;
}

function brief(over: Partial<FunnelBrief> = {}): FunnelBrief {
  return {
    brandName: "Marque",
    offerName: "Appel découverte",
    price: "Gratuit",
    targetAudience: "Solopreneurs",
    mainPain: "Manque de clients",
    promise: "Un plan clair",
    tone: "direct",
    funnelType: "booking",
    designStyle: "modern",
    language: "fr",
    funnelKind: "booking",
    ...over,
  } as FunnelBrief;
}

/** CTA de la page d'accueil après harmonisation. */
function homeCtas(f: Funnel) {
  const home = f.pages!.find((p) => p.isHome)!;
  return home.sections.map((s) => s.cta).filter(Boolean) as NonNullable<FunnelSection["cta"]>[];
}

describe("mode de réservation", () => {
  it("défaut = natif", () => {
    expect(resolveBookingMode({})).toBe("native");
    expect(resolveBookingMode(undefined)).toBe("native");
    expect(resolveBookingMode({ bookingMode: "native" })).toBe("native");
  });

  it("mode externe explicite", () => {
    expect(resolveBookingMode({ bookingMode: "external" })).toBe("external");
  });

  it("rétrocompat : une URL seule vaut mode externe", () => {
    // Avant `bookingMode`, renseigner un lien Calendly SUFFISAIT à choisir
    // l'externe. Sans ce repli, les tunnels existants basculeraient sur le
    // natif et leurs CTA pointeraient vers un /rdv/ qui n'existe pas chez eux.
    expect(resolveBookingMode({ calendarEmbedUrl: "https://calendly.com/moi" })).toBe("external");
  });

  it("une URL blanche ne vaut pas une URL", () => {
    expect(externalCalendarUrl({ calendarEmbedUrl: "   " })).toBeNull();
    expect(resolveBookingMode({ calendarEmbedUrl: "   " })).toBe("native");
  });

  it("le moteur natif n'est sollicité que pour un booking natif", () => {
    expect(usesNativeBookingEngine({ funnelKind: "booking" })).toBe(true);
    expect(usesNativeBookingEngine({ funnelKind: "booking", bookingMode: "external" })).toBe(false);
    expect(
      usesNativeBookingEngine({ funnelKind: "booking", calendarEmbedUrl: "https://cal.com/x" }),
    ).toBe(false);
    expect(usesNativeBookingEngine({ funnelKind: "lead-magnet" })).toBe(false);
  });
});

describe("validation du calendrier externe (wizard)", () => {
  // Ces règles sont partagées entre le wizard et le générateur : les tester ici
  // garantit qu'un tunnel bloqué à la saisie est exactement celui qui, sinon,
  // serait généré sans bouton de réservation.

  it("mode externe sans URL → manquant", () => {
    expect(bookingExternalUrlMissing({ funnelKind: "booking", bookingMode: "external" })).toBe(true);
  });

  it("des espaces ne valent pas une URL", () => {
    expect(
      bookingExternalUrlMissing({
        funnelKind: "booking",
        bookingMode: "external",
        calendarEmbedUrl: "   ",
      }),
    ).toBe(true);
  });

  it("URL renseignée → plus rien de manquant", () => {
    expect(
      bookingExternalUrlMissing({
        funnelKind: "booking",
        bookingMode: "external",
        calendarEmbedUrl: "https://calendly.com/moi",
      }),
    ).toBe(false);
  });

  it("le mode natif n'exige jamais d'URL", () => {
    expect(bookingExternalUrlMissing({ funnelKind: "booking" })).toBe(false);
    expect(bookingExternalUrlMissing({ funnelKind: "booking", bookingMode: "native" })).toBe(false);
    // Bascule externe → natif avec un champ vide : l'erreur doit tomber.
    expect(
      bookingExternalUrlMissing({
        funnelKind: "booking",
        bookingMode: "native",
        calendarEmbedUrl: "",
      }),
    ).toBe(false);
  });

  it("ne contraint aucun autre type de tunnel", () => {
    expect(bookingExternalUrlMissing({ funnelKind: "webinar", bookingMode: "external" })).toBe(false);
    expect(bookingExternalUrlMissing({ funnelKind: "lead-magnet" })).toBe(false);
    expect(bookingExternalUrlMissing(undefined)).toBe(false);
  });

  it("détecte une URL sans schéma (avertissement, pas blocage)", () => {
    // Sans schéma, le lien devient RELATIF et mène à un 404 silencieux.
    expect(isAbsoluteHttpUrl("calendly.com/moi")).toBe(false);
    expect(isAbsoluteHttpUrl("https://calendly.com/moi")).toBe(true);
    expect(isAbsoluteHttpUrl("http://cal.com/x")).toBe(true);
    expect(isAbsoluteHttpUrl("  https://cal.com/x  ")).toBe(true);
    expect(isAbsoluteHttpUrl("")).toBe(false);
    expect(isAbsoluteHttpUrl(undefined)).toBe(false);
    // Une URL sans schéma reste ACCEPTÉE : elle n'est pas « manquante ».
    expect(
      bookingExternalUrlMissing({
        funnelKind: "booking",
        bookingMode: "external",
        calendarEmbedUrl: "calendly.com/moi",
      }),
    ).toBe(false);
  });
});

describe("CTA booking — mode NATIF", () => {
  it("pointe vers /rdv/{slug} en navigation interne", () => {
    const out = harmonizeCTAsByFunnelKind(
      bookingFunnel({ bookingSlug: "appel-decouverte" }),
      brief(),
    );
    const ctas = homeCtas(out);
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta.mode).toBe("redirect");
      expect(cta.url).toBe("/rdv/appel-decouverte");
      expect(cta.target).toBe("_self");
      // Un pageId résiduel l'emporterait sur l'URL dans resolveNextDestination.
      expect(cta.pageId).toBeUndefined();
    }
  });

  it("encode un slug contenant des caractères spéciaux", () => {
    const out = harmonizeCTAsByFunnelKind(
      bookingFunnel({ bookingSlug: "appel decouverte" }),
      brief(),
    );
    expect(homeCtas(out)[0].url).toBe("/rdv/appel%20decouverte");
  });
});

describe("CTA booking — mode EXTERNE", () => {
  const externalBrief = brief({
    bookingMode: "external",
    calendarEmbedUrl: "https://calendly.com/moi/30min",
  });

  it("pointe vers l'URL absolue, dans un nouvel onglet", () => {
    const out = harmonizeCTAsByFunnelKind(bookingFunnel(), externalBrief);
    for (const cta of homeCtas(out)) {
      expect(cta.mode).toBe("redirect");
      expect(cta.url).toBe("https://calendly.com/moi/30min");
      expect(cta.target).toBe("_blank");
    }
  });

  it("l'URL reste ABSOLUE — condition de survie à un export Systeme.io", () => {
    // Un chemin relatif type /rdv/... serait mort une fois le tunnel hébergé
    // ailleurs. C'est tout l'intérêt du mode externe.
    const url = homeCtas(harmonizeCTAsByFunnelKind(bookingFunnel(), externalBrief))[0].url!;
    expect(url.startsWith("https://")).toBe(true);
  });

  it("ignore un slug natif présent : le mode choisi fait autorité", () => {
    const out = harmonizeCTAsByFunnelKind(
      bookingFunnel({ bookingSlug: "appel-decouverte" }),
      externalBrief,
    );
    const url = homeCtas(out)[0].url!;
    expect(url).toBe("https://calendly.com/moi/30min");
    expect(url).not.toContain("/rdv/");
  });

  it("mode externe sans URL saisie → repli, jamais de CTA vers le vide", () => {
    const out = harmonizeCTAsByFunnelKind(
      bookingFunnel(),
      brief({ bookingMode: "external", calendarEmbedUrl: "  " }),
    );
    for (const cta of homeCtas(out)) {
      expect(cta.url).not.toBe("");
      expect(cta.url).not.toBe("  ");
    }
  });
});

describe("CTA — garde anti-ancre-morte (B2, tous types)", () => {
  it("n'ancre jamais vers #lead-form si la page n'a pas de section form", () => {
    // Sans destination ET sans formulaire, l'ancien code produisait
    // `mode: "anchor", anchorId: "lead-form"` → un bouton parfaitement inerte.
    const out = harmonizeCTAsByFunnelKind(bookingFunnel(), brief());
    const home = out.pages!.find((p) => p.isHome)!;
    for (const s of home.sections) {
      expect(s.cta?.anchorId).not.toBe("lead-form");
    }
  });

  it("conserve l'ancre quand la page contient bien un formulaire", () => {
    const home = page("landing", ["hero", "form", "cta"], true);
    const f = {
      funnelName: "T",
      language: "fr",
      pages: [home],
      sections: home.sections,
      design: {} as any,
      meta: { funnelKind: "booking" },
    } as unknown as Funnel;

    const out = harmonizeCTAsByFunnelKind(f, brief());
    const ctas = out.pages![0].sections.map((s) => s.cta).filter(Boolean);
    expect(ctas.some((c) => c!.anchorId === "lead-form")).toBe(true);
  });

  it("le garde protège aussi les autres types de tunnel", () => {
    const home = page("landing", ["hero", "cta"], true);
    const f = {
      funnelName: "T",
      language: "fr",
      pages: [home],
      sections: home.sections,
      design: {} as any,
      meta: { funnelKind: "lead-magnet" },
    } as unknown as Funnel;

    const out = harmonizeCTAsByFunnelKind(f, brief({ funnelKind: "lead-magnet" }));
    for (const s of out.pages![0].sections) {
      expect(s.cta?.anchorId).not.toBe("lead-form");
    }
  });
});

describe("rétrocompatibilité", () => {
  it("un tunnel booking sans slug ni URL ne plante pas", () => {
    expect(() => harmonizeCTAsByFunnelKind(bookingFunnel(), brief())).not.toThrow();
  });

  it("ne touche pas aux CTA d'un tunnel non-booking sans raison", () => {
    const home = page("landing", ["hero", "form", "cta"], true);
    const f = {
      funnelName: "T",
      language: "fr",
      pages: [home],
      sections: home.sections,
      design: {} as any,
      meta: { funnelKind: "digital-product" },
    } as unknown as Funnel;

    const out = harmonizeCTAsByFunnelKind(f, brief({ funnelKind: "digital-product" }));
    for (const cta of out.pages![0].sections.map((s) => s.cta).filter(Boolean)) {
      expect(cta!.url).not.toContain("/rdv/");
    }
  });
});
