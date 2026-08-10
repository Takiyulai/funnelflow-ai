// tests/copy-rewrite.test.ts
//
// Tests du noyau de réécriture de copy (lib/clone/copy-rewrite.ts).
//
// Aucun DOM n'est requis : les spots sont fabriqués à la main avec un
// `element` nul, jamais déréférencé par le module. C'est précisément la
// propriété qu'on veut préserver — si un futur changement lisait `.element`,
// ces tests tomberaient.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_COPY_LIMITS,
  chunkCopyItems,
  collectCopyItems,
  isFrozenCopy,
  lengthBudget,
  mergeCopyPatch,
  reviewCopyRewrite,
  toRawHtmlCopyPatch,
  type CopyItem,
} from "@/lib/clone/copy-rewrite";
import type { Spot } from "@/lib/clone/raw-html-walker";

// ───────────────────────────────────────────────────────────────────────────
// Fabriques
// ───────────────────────────────────────────────────────────────────────────

const NO_ELEMENT = null as unknown as Element;

function textSpot(id: string, original: string, tag = "p"): Spot {
  return {
    kind: "text",
    id,
    element: NO_ELEMENT,
    subKind: tag === "h1" ? "title" : "paragraph",
    original,
    tag,
    hasInlineStyles: false,
    styledFragments: [],
  };
}

function linkSpot(id: string, label: string, href = "https://x.test"): Spot {
  return {
    kind: "link",
    id,
    element: NO_ELEMENT,
    href,
    label,
    isExternal: true,
    isCta: true,
  };
}

function imageSpot(id: string, src: string): Spot {
  return {
    kind: "image",
    id,
    element: NO_ELEMENT,
    src,
    alt: "",
    mediaType: "image",
  };
}

function item(over: Partial<CopyItem> = {}): CopyItem {
  return {
    id: "t-0001",
    kind: "text",
    text: "Un texte de longueur tout à fait ordinaire pour un paragraphe.",
    subKind: "paragraph",
    tag: "p",
    ...over,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// isFrozenCopy
// ───────────────────────────────────────────────────────────────────────────

describe("isFrozenCopy", () => {
  it("gèle ce qui n'est pas du copy", () => {
    for (const frozen of [
      "97 €",
      "$1,997",
      "15000 FCFA",
      "29,90 EUR",
      "00:04:59",
      "—",
      "© 2026 AutoFunnel",
      "Mentions légales",
      "All rights reserved",
    ]) {
      expect(isFrozenCopy(frozen), frozen).not.toBeNull();
    }
  });

  it("motive le gel — le rapport de rejet doit rester lisible", () => {
    // Un prix sans lettre est attrapé par « aucune lettre » avant même le
    // motif tarifaire : les deux règles se recouvrent, et c'est voulu.
    expect(isFrozenCopy("97 €")).toBe("no-letters");
    // Avec une devise alphabétique, c'est bien le motif tarifaire qui tranche.
    expect(isFrozenCopy("15000 FCFA")).toBe("price");
    expect(isFrozenCopy("—")).toBe("too-short");
    expect(isFrozenCopy("Mentions légales")).toBe("legal");
  });

  it("laisse passer du vrai copy, même court ou chiffré", () => {
    expect(isFrozenCopy("Réservez votre place")).toBeNull();
    expect(isFrozenCopy("Oui")).toBeNull();
    // Un prix noyé dans une phrase reste du copy : c'est l'argument, pas le prix.
    expect(isFrozenCopy("Seulement 97 € au lieu de 297 €")).toBeNull();
    expect(isFrozenCopy("3 étapes pour démarrer")).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// collectCopyItems
// ───────────────────────────────────────────────────────────────────────────

describe("collectCopyItems", () => {
  it("retient textes et libellés, jamais les médias", () => {
    const items = collectCopyItems([
      textSpot("t-a", "Devenez indépendant en 90 jours", "h1"),
      imageSpot("img-a", "https://cdn.test/hero.jpg"),
      linkSpot("a-a", "Je réserve ma place"),
    ]);

    expect(items.map((i) => i.id)).toEqual(["t-a", "a-a"]);
    expect(items[1].kind).toBe("link-label");
  });

  it("écarte les emplacements gelés dès la collecte", () => {
    const items = collectCopyItems([
      textSpot("t-a", "97 €"),
      textSpot("t-b", "Une promesse claire et vendeuse"),
      textSpot("t-c", "© 2026"),
    ]);

    expect(items.map((i) => i.id)).toEqual(["t-b"]);
  });

  it("préserve les identifiants suffixés du walker sans les recalculer", () => {
    // Deux textes identiques : le walker a résolu la collision en `-2`.
    // Recalculer un hash ici les confondrait — et la seconde occurrence
    // recevrait le texte de la première.
    const items = collectCopyItems([
      textSpot("t-dup", "En savoir plus"),
      textSpot("t-dup-2", "En savoir plus"),
    ]);

    expect(items.map((i) => i.id)).toEqual(["t-dup", "t-dup-2"]);
  });

  it("normalise les blancs et ignore le vide", () => {
    const items = collectCopyItems([
      textSpot("t-a", "  Trop   d'espaces\n  ici  "),
      textSpot("t-b", "   "),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Trop d'espaces ici");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// lengthBudget
// ───────────────────────────────────────────────────────────────────────────

describe("lengthBudget", () => {
  it("accorde une marge absolue aux libellés courts", () => {
    // « Acheter » = 7 caractères. Un plafond purement proportionnel (×1,15)
    // donnerait 8 : aucune reformulation ne tiendrait.
    const b = lengthBudget(item({ kind: "link-label", text: "Acheter" }));
    expect(b.max).toBe(13);
    expect(b.min).toBe(1);
  });

  it("serre davantage les boutons que les paragraphes", () => {
    const text = "Rejoignez la formation dès aujourd'hui";
    const asText = lengthBudget(item({ kind: "text", text }));
    const asLink = lengthBudget(item({ kind: "link-label", text }));
    expect(asLink.max).toBeLessThan(asText.max);
  });

  it("pose un plancher sur les textes longs seulement", () => {
    const long = "x".repeat(200);
    expect(lengthBudget(item({ text: long })).min).toBe(90);
    // Court : raccourcir est légitime, aucun plancher.
    expect(lengthBudget(item({ text: "Titre court" })).min).toBe(1);
  });

  it("ne dépasse jamais le plafond dur", () => {
    const b = lengthBudget(item({ text: "x".repeat(1190) }));
    expect(b.max).toBe(DEFAULT_COPY_LIMITS.hardMax);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// reviewCopyRewrite
// ───────────────────────────────────────────────────────────────────────────

describe("reviewCopyRewrite", () => {
  const items: CopyItem[] = [
    item({ id: "t-1", text: "Arrêtez de perdre vos prospects", tag: "h1" }),
    item({ id: "t-2", text: "Une méthode simple, testée sur 400 tunnels." }),
    item({ id: "a-1", kind: "link-label", text: "Je commence", tag: "button" }),
  ];

  it("retient une réécriture conforme", () => {
    const review = reviewCopyRewrite(items, {
      "t-1": "Ne laissez plus filer vos prospects",
      "t-2": "Une méthode simple, éprouvée sur 400 tunnels.",
      "a-1": "Je me lance",
    });

    expect(review.stats.accepted).toBe(3);
    expect(review.fatal).toBe(false);
    expect(review.accepted["a-1"]).toBe("Je me lance");
  });

  it("écarte un identifiant inventé sans faire tomber le lot", () => {
    const review = reviewCopyRewrite(items, {
      "t-1": "Ne laissez plus filer vos prospects",
      "t-inexistant": "Texte surgi de nulle part",
    });

    expect(review.stats.accepted).toBe(1);
    expect(review.rejected).toHaveLength(1);
    expect(review.rejected[0].reason).toBe("unknown-id");
    expect(review.fatal).toBe(false);
  });

  it("écarte un texte trop long — la seule vraie menace pour la mise en page", () => {
    const review = reviewCopyRewrite(items, {
      "a-1": "Je démarre immédiatement mon accompagnement complet dès maintenant",
    });

    expect(review.rejected[0]).toMatchObject({ id: "a-1", reason: "too-long" });
    expect(review.rejected[0].budget).toBeDefined();
    expect(review.accepted["a-1"]).toBeUndefined();
  });

  it("écarte tout balisage", () => {
    const review = reviewCopyRewrite(items, {
      "t-1": "<span class='rouge'>Arrêtez</span> de perdre",
      "t-2": "Une méthode {{prenom}} testée sur 400 tunnels.",
    });

    expect(review.rejected.map((r) => r.reason)).toEqual([
      "contains-markup",
      "contains-markup",
    ]);
  });

  it("écarte une valeur non textuelle", () => {
    const review = reviewCopyRewrite(items, { "t-1": { texte: "non" } });
    expect(review.rejected[0].reason).toBe("not-a-string");
  });

  it("distingue inchangé et absent, et n'en met aucun dans le patch", () => {
    const review = reviewCopyRewrite(items, {
      "t-1": "Arrêtez de perdre vos prospects",
    });

    expect(review.unchanged).toEqual(["t-1"]);
    expect(review.missing).toEqual(["t-2", "a-1"]);
    expect(review.accepted).toEqual({});
    // Le modèle a répondu quelque chose d'exploitable : pas d'échec.
    expect(review.fatal).toBe(false);
  });

  it("signale l'échec quand rien n'est exploitable", () => {
    expect(reviewCopyRewrite(items, null).fatal).toBe(true);
    expect(reviewCopyRewrite(items, "du texte brut").fatal).toBe(true);
    expect(reviewCopyRewrite(items, ["a", "b"]).fatal).toBe(true);
    expect(reviewCopyRewrite(items, {}).fatal).toBe(true);
  });

  it("ne signale pas d'échec quand aucun emplacement n'a été soumis", () => {
    expect(reviewCopyRewrite([], {}).fatal).toBe(false);
  });

  it("refuse qu'un prix soit introduit là où il n'y en avait pas", () => {
    const review = reviewCopyRewrite(items, { "a-1": "97 €" });
    expect(review.rejected[0].reason).toBe("frozen");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// toRawHtmlCopyPatch — la garantie structurelle
// ───────────────────────────────────────────────────────────────────────────

describe("toRawHtmlCopyPatch", () => {
  const items: CopyItem[] = [
    item({ id: "t-1", text: "Un titre à retravailler", tag: "h1" }),
    item({ id: "a-1", kind: "link-label", text: "Je commence", tag: "button" }),
  ];

  it("aiguille textes et libellés vers les bonnes clés", () => {
    const review = reviewCopyRewrite(items, {
      "t-1": "Un titre retravaillé",
      "a-1": "Je démarre",
    });
    const patch = toRawHtmlCopyPatch(review, items);

    expect(patch.texts).toEqual({ "t-1": "Un titre retravaillé" });
    expect(patch.links).toEqual({ "a-1": { label: "Je démarre" } });
  });

  it("ne produit JAMAIS de href, d'image, de couleur ni de fond", () => {
    // Le cœur de la promesse faite à l'utilisateur : le design, le squelette et
    // les médias sont hors d'atteinte parce qu'aucun chemin de code ne les
    // écrit — pas parce qu'on l'a demandé au modèle.
    const review = reviewCopyRewrite(items, {
      "t-1": "Un titre retravaillé",
      "a-1": "Je démarre",
    });
    const patch = toRawHtmlCopyPatch(review, items) as Record<string, unknown>;

    expect(Object.keys(patch).sort()).toEqual(["links", "texts"]);
    expect(patch.images).toBeUndefined();
    expect(patch.colors).toBeUndefined();
    expect(patch.background).toBeUndefined();
    for (const link of Object.values(patch.links as Record<string, object>)) {
      expect(Object.keys(link)).toEqual(["label"]);
    }
  });

  it("n'émet aucune clé quand rien n'est retenu", () => {
    const patch = toRawHtmlCopyPatch(reviewCopyRewrite(items, {}), items);
    expect(patch).toEqual({});
  });
});

// ───────────────────────────────────────────────────────────────────────────
// mergeCopyPatch
// ───────────────────────────────────────────────────────────────────────────

describe("mergeCopyPatch", () => {
  it("préserve les retouches manuelles hors copy", () => {
    const existing = {
      texts: { "t-9": "Retouché à la main" },
      images: { "img-1": { src: "https://cdn.test/perso.jpg" } },
      colors: { "c-1": "#ff0000" },
    };

    const merged = mergeCopyPatch(existing, {
      texts: { "t-1": "Nouveau titre" },
    });

    expect(merged.images).toEqual(existing.images);
    expect(merged.colors).toEqual(existing.colors);
    expect(merged.texts).toEqual({
      "t-9": "Retouché à la main",
      "t-1": "Nouveau titre",
    });
  });

  it("remplace le libellé d'un CTA sans toucher au href posé à la main", () => {
    // Le scénario silencieusement destructeur : l'utilisateur a redirigé son
    // bouton vers sa propre page de paiement, puis relance une réécriture.
    const merged = mergeCopyPatch(
      { links: { "a-1": { href: "https://moi.test/paiement", label: "Payer" } } },
      { links: { "a-1": { label: "Régler ma commande" } } },
    );

    expect(merged.links!["a-1"]).toEqual({
      href: "https://moi.test/paiement",
      label: "Régler ma commande",
    });
  });

  it("accepte l'absence de patch préexistant", () => {
    const merged = mergeCopyPatch(undefined, { texts: { "t-1": "Bonjour" } });
    expect(merged).toEqual({ texts: { "t-1": "Bonjour" } });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// chunkCopyItems
// ───────────────────────────────────────────────────────────────────────────

describe("chunkCopyItems", () => {
  it("découpe en préservant l'ordre du document", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      item({ id: `t-${i}`, text: "x".repeat(100) }),
    );
    const chunks = chunkCopyItems(items, 500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat().map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("laisse partir seul un emplacement plus gros que l'enveloppe", () => {
    const chunks = chunkCopyItems(
      [item({ id: "t-1", text: "court" }), item({ id: "t-2", text: "x".repeat(900) })],
      200,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[1][0].id).toBe("t-2");
  });

  it("ne renvoie aucun lot pour une liste vide", () => {
    expect(chunkCopyItems([], 500)).toEqual([]);
  });
});
