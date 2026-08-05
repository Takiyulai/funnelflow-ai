// tests/share-template.test.ts
//
// Partage d'un tunnel IMPORTÉ dans la galerie communautaire.
//
// Contexte du bug remonté par un bêta-testeur (« je n'arrive pas à partager le
// tunnel importé ») :
//   - la route lit le tunnel dans Supabase, mais /api/clone-funnel ne persiste
//     RIEN côté serveur : un tunnel importé peut n'exister qu'en localStorage ;
//   - elle répondait alors `not_found` sec, affiché tel quel dans la modale ;
//   - et elle exigeait un abonnement actif, alors que le partage ALIMENTE la
//     galerie (contribution, pas consommation).
//
// Ces tests verrouillent les deux décisions et la désinfection du contenu, qui
// devient critique dès lors que n'importe quel compte peut publier.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeFunnelForSharing } from "@/lib/templates/shareable";

// `process.cwd()` = racine du projet sous vitest (`__dirname` n'existe pas en ESM).
const ROUTE_SRC = readFileSync(
  path.resolve(process.cwd(), "app/api/templates/share/route.ts"),
  "utf8",
);

describe("route de partage — contrat", () => {
  it("n'exige plus d'abonnement actif", () => {
    // Décision produit : contribuer à la galerie est ouvert à tout compte
    // connecté. Réintroduire guardApiAccess ici rebloquerait les bêta-testeurs.
    expect(ROUTE_SRC).not.toContain("guardApiAccess");
  });

  it("exige malgré tout une session valide", () => {
    expect(ROUTE_SRC).toContain("auth.getUser()");
    expect(ROUTE_SRC).toContain("unauthorized");
  });

  it("compense la levée du garde par une limite de débit", () => {
    expect(ROUTE_SRC).toContain("rateLimit(");
  });

  it("distingue « pas encore synchronisé » de « pas propriétaire »", () => {
    // Les deux renvoyaient un `not_found` indifférencié : l'utilisateur ne
    // pouvait pas savoir qu'il lui suffisait d'enregistrer son tunnel.
    expect(ROUTE_SRC).toContain("funnel_not_synced");
    expect(ROUTE_SRC).toContain("not_owner");
    expect(ROUTE_SRC).not.toContain('error: "not_found"');
  });

  it("accompagne chaque refus d'un message lisible", () => {
    for (const code of ["funnel_not_synced", "not_owner", "content_too_large"]) {
      const idx = ROUTE_SRC.indexOf(code);
      expect(idx, `code ${code} absent`).toBeGreaterThan(-1);
      expect(ROUTE_SRC.slice(idx, idx + 400)).toContain("message:");
    }
  });
});

/** Tunnel cloné représentatif : <head> capturé + section raw-html hostile. */
function clonedFunnel() {
  return {
    funnelName: "Tunnel importé",
    language: "fr",
    customCodeHead: "<script>alert(1)</script>",
    meta: {
      clonedHead: '<style>.a{}</style><script>fetch("//evil")</script>',
      logoUrl: "https://exemple.test/logo.png",
      deliveryEmail: "moi@exemple.test",
      customDomain: "mondomaine.test",
    },
    pages: [
      {
        sections: [
          {
            kind: "raw-html",
            body: '<div onclick="steal()"><a href="javascript:alert(1)">x</a><iframe srcdoc="<script>x</script>"></iframe></div>',
            cta: { mode: "redirect", url: "https://wa.me/33600000000", chariow: { id: "abc" } },
          },
        ],
      },
    ],
  };
}

describe("désinfection avant publication", () => {
  it("retire tout JavaScript du HTML cloné", () => {
    const out = sanitizeFunnelForSharing(clonedFunnel());
    const html = out.pages[0].sections[0].body as string;

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("srcdoc");
  });

  it("désinfecte aussi le <head> cloné, injecté dans l'iframe de l'éditeur", () => {
    const out = sanitizeFunnelForSharing(clonedFunnel());
    expect(out.meta.clonedHead).not.toContain("<script");
    // Le CSS légitime, lui, doit survivre : c'est tout l'intérêt du modèle.
    expect(out.meta.clonedHead).toContain("<style>");
  });

  it("supprime le code personnalisé et les données personnelles", () => {
    const out = sanitizeFunnelForSharing(clonedFunnel());
    expect(out.customCodeHead).toBeUndefined();
    expect(out.meta.logoUrl).toBeUndefined();
    expect(out.meta.deliveryEmail).toBeUndefined();
    expect(out.meta.customDomain).toBeUndefined();
  });

  it("neutralise les liens personnels des CTA", () => {
    const out = sanitizeFunnelForSharing(clonedFunnel());
    const cta = out.pages[0].sections[0].cta;
    expect(cta.url).toBe("");
    expect(cta.chariow).toBeUndefined();
  });

  it("ne mute pas le tunnel d'origine", () => {
    // La route partage une COPIE ; muter la source corromprait le tunnel de
    // l'utilisateur au moment même où il le partage.
    const source = clonedFunnel();
    sanitizeFunnelForSharing(source);
    expect(source.customCodeHead).toBe("<script>alert(1)</script>");
    expect(source.meta.logoUrl).toBe("https://exemple.test/logo.png");
  });

  it("conserve la structure réutilisable du modèle", () => {
    const out = sanitizeFunnelForSharing(clonedFunnel());
    expect(out.funnelName).toBe("Tunnel importé");
    expect(out.pages[0].sections).toHaveLength(1);
  });
});
