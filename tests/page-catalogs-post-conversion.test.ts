// tests/page-catalogs-post-conversion.test.ts
//
// Verrou sur la SOBRIÉTÉ DES PAGES POST-CONVERSION.
//
// ── L'INCIDENT ─────────────────────────────────────────────────────────────
// Les pages de remerciement générées arrivaient garnies de témoignages et
// d'une présentation de l'auteur. Le réflexe était d'ajouter un filtre après
// génération — il en existait déjà un (`filterSectionsByBlueprint` puis
// `removeOrFillEmptySections`), et il fonctionnait parfaitement. Il appliquait
// simplement une liste qui autorisait "testimonials".
//
// La cause tenait donc entièrement dans les données de ce catalogue :
//   • `allowedSectionTypes` listait "testimonials" sur 5 pages post-conversion ;
//   • `minSections` (lu par lib/ai/prompts.ts, où il devient « minimum N
//     sections riches ») en réclamait 3 à 4.
// Le modèle remplissait parce qu'on lui demandait de remplir.
//
// ── CE QUE CE FICHIER PROTÈGE ──────────────────────────────────────────────
// Une régression ici est SILENCIEUSE : rien ne casse, aucune erreur n'est
// levée, les tunnels se génèrent — ils redeviennent juste bavards là où ils
// devraient être sobres. Personne ne s'en aperçoit avant de regarder une page
// merci. D'où ces assertions sur la donnée elle-même.

import { describe, expect, it } from "vitest";
import { FUNNEL_BLUEPRINTS } from "@/lib/funnels/pageCatalogs";
import type { FunnelSectionType, PageRole } from "@/lib/funnels/types";

const POST_CONVERSION_ROLES: ReadonlySet<PageRole> = new Set<PageRole>([
  "thankyou",
  "confirmation",
  "delivery",
  "access",
]);

/**
 * Sections de PERSUASION. Après conversion, elles ne servent plus la vente :
 * elles retardent l'action utile et réintroduisent le doute chez quelqu'un qui
 * vient précisément de décider.
 */
const PERSUASION_SECTIONS: readonly FunnelSectionType[] = [
  "testimonials",
  "proof",
  "faq",
  "pricing",
  "guarantee",
  "urgency",
  "problem",
  "agitation",
  "benefits",
  "bonus",
];

type Entry = {
  kind: string;
  role: PageRole;
  allowed: readonly FunnelSectionType[];
  defaults: readonly FunnelSectionType[];
  minSections: number | undefined;
};

const allPages: Entry[] = Object.entries(FUNNEL_BLUEPRINTS).flatMap(
  ([kind, bp]) =>
    bp.pages.map((p) => ({
      kind,
      role: p.role,
      allowed: p.allowedSectionTypes ?? [],
      defaults: p.defaultSectionTypes ?? [],
      minSections: p.minSections,
    })),
);

const postConversionPages = allPages.filter((p) =>
  POST_CONVERSION_ROLES.has(p.role),
);

describe("catalogue de pages — sobriété post-conversion", () => {
  it("couvre bien plusieurs pages (le filtre du test lui-même doit rester valide)", () => {
    // Sans ce garde-fou, renommer un rôle viderait `postConversionPages` et
    // TOUS les tests ci-dessous passeraient au vert sans rien vérifier.
    expect(postConversionPages.length).toBeGreaterThanOrEqual(5);
  });

  it("n'autorise aucune section de persuasion après conversion", () => {
    for (const page of postConversionPages) {
      for (const forbidden of PERSUASION_SECTIONS) {
        expect(
          page.allowed,
          `${page.kind}/${page.role} ne doit pas autoriser "${forbidden}"`,
        ).not.toContain(forbidden);
      }
    }
  });

  it("ne réclame pas au modèle de remplir ces pages", () => {
    // C'est cette valeur, pas la liste des sections, qui pousse le modèle à
    // inventer du contenu : elle devient « minimum N sections riches » dans le
    // prompt. Au-delà de 3, on commande du remplissage.
    for (const page of postConversionPages) {
      expect(
        page.minSections ?? 0,
        `${page.kind}/${page.role} exige ${page.minSections} sections`,
      ).toBeLessThanOrEqual(3);
    }
  });

  it("garde la confirmation comme section obligatoire", () => {
    for (const page of postConversionPages) {
      expect(page.defaults, `${page.kind}/${page.role}`).toContain("hero");
    }
  });
});

describe("catalogue de pages — cohérence structurelle", () => {
  it("ne propose par défaut que des sections qu'il autorise", () => {
    // Une section présente dans `defaultSectionTypes` mais absente de
    // `allowedSectionTypes` est générée puis immédiatement supprimée par
    // `filterSectionsByBlueprint` : la page arrive plus pauvre que prévu, sans
    // le moindre signal. Vaut pour TOUTES les pages, pas seulement post-conversion.
    for (const page of allPages) {
      if (page.allowed.length === 0) continue;
      for (const def of page.defaults) {
        expect(
          page.allowed,
          `${page.kind}/${page.role} propose "${def}" par défaut sans l'autoriser`,
        ).toContain(def);
      }
    }
  });

  it("laisse aux pages de vente leur arsenal complet", () => {
    // Contre-épreuve : la sobriété ne doit PAS avoir débordé sur les pages où
    // la persuasion est le travail à faire.
    const salesPages = allPages.filter(
      (p) => !POST_CONVERSION_ROLES.has(p.role) && p.allowed.length > 0,
    );
    const withTestimonials = salesPages.filter((p) =>
      p.allowed.includes("testimonials"),
    );
    expect(withTestimonials.length).toBeGreaterThan(0);
  });
});
