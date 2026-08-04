// tests/css-completeness.test.ts
//
// Garde-fou du clonage : détecter le CSS « fantôme » (CSSOM-only).
//
// Cas réel à l'origine du module — une page systeme.io rendue par
// styled-components v6 : le <style data-styled> sérialisé fait 65 caractères
// alors que la feuille porte 1 145 règles / 132 642 caractères dans le CSSOM.
// Scrapingdog, qui se contente de rendre puis sérialiser, renvoyait donc un
// HTML amputé de 92,7 % de son style. La fonction doit refuser ce HTML pour que
// le fetcher bascule sur ScrapingBee.
//
// La logique est une fonction PURE (lib/clone/css-completeness.ts) : aucun
// réseau, aucun DOM, testable directement.

import { describe, it, expect } from "vitest";
import { assessCssCompleteness } from "@/lib/clone/css-completeness";

/** Reproduit la forme exacte du HTML servi par systeme.io (styled-components v6). */
function systemeIoLikeHtml(): string {
  return [
    "<html><head>",
    '<link rel="stylesheet" href="https://cdn.example.net/sales/page.35370e83.css">',
    // ⬇️ LE COUPABLE : balise vide, ses 1 145 règles vivent dans le CSSOM.
    '<style data-styled="active" data-styled-version="6.3.11"></style>',
    "<style>.hero{color:#111}</style>",
    "</head><body>",
    "<section>".concat("x".repeat(30_000), "</section>"),
    "</body></html>",
  ].join("");
}

describe("assessCssCompleteness", () => {
  it("rejette un HTML dont le CSS styled-components n'est pas matérialisé", () => {
    const report = assessCssCompleteness(systemeIoLikeHtml());

    expect(report.sufficient).toBe(false);
    expect(report.runtimeEngines).toContain("styled-components");
    expect(report.emptyRuntimeStyleTags).toBe(1);
    expect(report.reason).toMatch(/CSSOM/);
  });

  it("accepte le même HTML une fois le CSS matérialisé par ScrapingBee", () => {
    const html = systemeIoLikeHtml().replace(
      "</head>",
      '<style id="__extracted-runtime-css" data-extracted-length="132642">.a{color:red}</style></head>',
    );
    const report = assessCssCompleteness(html);

    expect(report.sufficient).toBe(true);
    expect(report.materialized).toBe(true);
  });

  it("détecte aussi emotion", () => {
    const html = `<html><head><style data-emotion="css"></style></head><body>${"x".repeat(30_000)}</body></html>`;
    const report = assessCssCompleteness(html);

    expect(report.sufficient).toBe(false);
    expect(report.runtimeEngines).toContain("emotion");
  });

  it("laisse passer une page en CSS classique (pas de faux positif)", () => {
    const html = [
      "<html><head>",
      '<link rel="stylesheet" href="https://cdn.example.net/app.css">',
      "<style>body{margin:0;background:#fff}.btn{padding:12px}</style>",
      "</head><body>",
      "x".repeat(50_000),
      "</body></html>",
    ].join("");
    const report = assessCssCompleteness(html);

    expect(report.sufficient).toBe(true);
    expect(report.externalStylesheets).toBe(1);
    expect(report.inlineCssChars).toBeGreaterThan(0);
  });

  it("ne pénalise pas un <style> vide SANS signature CSS-in-JS", () => {
    // Une balise vide anodine (placeholder d'un builder) ne doit pas déclencher
    // une escalade coûteuse vers ScrapingBee.
    const html = [
      "<html><head>",
      '<link rel="stylesheet" href="https://cdn.example.net/app.css">',
      "<style></style>",
      "<style>.x{color:#000}</style>",
      "</head><body>",
      "x".repeat(50_000),
      "</body></html>",
    ].join("");

    expect(assessCssCompleteness(html).sufficient).toBe(true);
  });

  it("rejette une grosse page totalement dépourvue de CSS", () => {
    const html = `<html><head></head><body>${"x".repeat(50_000)}</body></html>`;
    const report = assessCssCompleteness(html);

    expect(report.sufficient).toBe(false);
    expect(report.externalStylesheets).toBe(0);
  });

  it("n'alerte pas sur une page courte sans CSS (fragment, page d'erreur)", () => {
    expect(assessCssCompleteness("<html><body>ok</body></html>").sufficient).toBe(true);
  });

  it("est idempotente — le regex global ne conserve pas d'état entre deux appels", () => {
    const html = systemeIoLikeHtml();
    const a = assessCssCompleteness(html);
    const b = assessCssCompleteness(html);

    expect(b).toEqual(a);
  });
});
