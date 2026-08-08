// tests/clone-section-split.test.ts
//
// « Clonage réussi, page blanche » — en réalité : page COUPÉE À 25 PIXELS.
//
// ── L'INCIDENT ─────────────────────────────────────────────────────────────
// Sur delta360.io (application monopage Nuxt), le clone rendait deux sections
// de 41 px et 25 px. Toute la page de vente était présente dans le DOM, mais
// invisible. L'inspection a montré :
//
//   Section 0 : <section><button>Go To Step #2</button></section>
//   Section 1 : <section class="order-form-footer">…</section>
//               + <div data-ff-overlays style="width:0;height:0">
//                    <div id="__nuxt">  ← TOUTE LA PAGE
//
// Enchaînement du défaut :
//   1. Le body d'une appli monopage contient UN conteneur applicatif (#__nuxt)
//      qui porte 100 % du contenu. Les seules <section> top-level sont des
//      fragments de popups rendus par téléportation HORS de ce conteneur.
//   2. Le découpage a pris ces fragments pour le squelette de la page.
//   3. #__nuxt, devenu orphelin, a été soumis à isOverlayOrphan() — qui teste
//      par SOUS-CHAÎNE. Une page entière contient forcément « popup » ou
//      « position:fixed » quelque part → faux positif garanti.
//   4. Classé « overlay », il a été enfermé dans le conteneur hors-flux 0×0.
//   5. measureContentHeight() saute délibérément data-ff-overlays → hauteur
//      remontée : 25 px. overflow:hidden a coupé les 2800 px restants.
//
// Deux barrières sont posées : un gate de TAILLE dans isOverlayOrphan, et un
// garde-fou global qui abandonne le découpage quand les orphelins portent
// plus de texte que les <section> extraites.

import { describe, it, expect } from "vitest";
import { parsePage } from "@/lib/clone/parser";
import { mapToFunnel } from "@/lib/clone/section-mapper";

/**
 * Reproduit la structure exacte relevée : deux <section> top-level minuscules
 * issues de popups téléportés, et tout le contenu dans #__nuxt.
 */
function singlePageAppHtml(): string {
  return `<!DOCTYPE html><html><head><title>The Fully Booked Airbnb System</title></head><body>
<section><button class="form-btn"><span class="main-text">Go To Step #2</span></button></section>
<section class="order-form-footer"><span>We Respect Your Privacy &amp; Information.</span></section>
<div id="__nuxt">
  <div class="bgCover bg-fixed"></div>
  <div id="nav-menu-popup" style="display:none;position:fixed"><ul class="nav-menu"></ul></div>
  <div id="preview-container" class="hl_page-preview--content">
    <div class="c-section section-header">
      <h1>For Airbnb hosts who want to maximize their occupancy</h1>
    </div>
    <div class="c-section section-headline">
      <h1>Install this 5-step listing optimization framework and get more bookings for your Airbnb in 7 days</h1>
      <p>Stop guessing what works. Use this proven framework to tweak your photos, copy, and positioning
      for maximum visibility and immediate results. Everything is delivered instantly after checkout, and
      you keep lifetime access to every update we publish for the system.</p>
      <img src="https://images.example.com/hero.png" alt="Hero">
    </div>
    <div class="c-section section-offer">
      <h2>Join Now For $7.00</h2>
      <p>Get access to the complete system for just seven dollars instead of ninety-seven. You are
      instantly saving ninety dollars, and the whole thing is delivered to your inbox immediately.</p>
    </div>
    <div class="drawer__overlay"></div>
  </div>
</div>
</body></html>`;
}

describe("découpage en sous-sections — applications monopage", () => {
  const parsed = parsePage(singlePageAppHtml(), "https://delta360.io/offer");
  const funnel = mapToFunnel(parsed, "fr", "https://delta360.io/offer");
  const sections = funnel.pages?.[0]?.sections ?? [];
  const allBodies = sections.map((s) => s.body ?? "").join("\n");

  it("ne découpe PAS sur des <section> qui ne portent pas le contenu", () => {
    // Le découpage produisait 2 sous-sections de 41 px et 25 px.
    expect(sections).toHaveLength(1);
  });

  it("conserve le conteneur applicatif dans le flux normal", () => {
    expect(allBodies).toContain('id="__nuxt"');
    // Le symptôme : tout le contenu relégué dans le conteneur 0×0.
    expect(allBodies).not.toContain("data-ff-overlays");
  });

  it("préserve le contenu réel de la page", () => {
    expect(allBodies).toContain("5-step listing optimization framework");
    expect(allBodies).toContain("Join Now For $7.00");
  });
});

describe("découpage en sous-sections — page classique", () => {
  /** Vraies <section> porteuses de contenu : le découpage doit rester actif. */
  function classicPageHtml(): string {
    return `<!DOCTYPE html><html><head></head><body>
<section class="hero">
  <h1>Transformez votre activité en machine de vente</h1>
  <p>Un premier bloc de contenu suffisamment substantiel pour que la section soit
  retenue comme porteuse, avec plusieurs phrases de texte visible réel.</p>
</section>
<section class="pricing">
  <h2>Nos tarifs</h2>
  <p>Un deuxième bloc, tout aussi substantiel, décrivant les offres disponibles
  et les garanties associées à chacune d'entre elles pour le client final.</p>
</section>
<a href="https://wa.me/33600000000" style="position:fixed;bottom:20px">Discuter</a>
</body></html>`;
  }

  const parsed = parsePage(classicPageHtml(), "https://exemple.fr/offre");
  const funnel = mapToFunnel(parsed, "fr", "https://exemple.fr/offre");
  const sections = funnel.pages?.[0]?.sections ?? [];
  const allBodies = sections.map((s) => s.body ?? "").join("\n");

  it("découpe bien quand les <section> portent le contenu", () => {
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it("préserve toujours le bouton flottant en hors-flux", () => {
    // Le comportement d'origine (bug #5) ne doit pas régresser : un vrai
    // overlay, court et positionné en fixed, reste rattaché hors du flux.
    expect(allBodies).toContain("data-ff-overlays");
    expect(allBodies).toContain("wa.me");
  });
});
