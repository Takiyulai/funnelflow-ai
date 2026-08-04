// lib/clone/css-completeness.ts
/**
 * Détection du CSS « fantôme » (CSSOM-only) dans un HTML sérialisé.
 *
 * ── LE PROBLÈME ────────────────────────────────────────────────────────────
 * Les moteurs CSS-in-JS (styled-components, emotion, goober, stitches…) créent
 * une balise `<style>` VIDE dans le DOM, puis y insèrent leurs règles via
 * `CSSStyleSheet.insertRule()`. Ces règles vivent uniquement dans le CSSOM :
 * elles ne sont JAMAIS écrites dans le `textContent` du noeud.
 *
 * Conséquence : toute sérialisation HTML (`outerHTML`, `document.body.innerHTML`,
 * ou le HTML renvoyé par un scraper qui ne fait que rendre + sérialiser) produit
 * un `<style data-styled="active"></style>` VIDE. Le CSS est perdu.
 *
 * Exemple mesuré sur une page systeme.io (styled-components v6.3.11) :
 *   - <style data-styled> sérialisé  →      65 caractères (tag vide)
 *   - même feuille dans le CSSOM     → 132 642 caractères (1 145 règles)
 *   → 92 % du CSS de la page invisible dans le HTML récupéré.
 *
 * ── LA PARADE ──────────────────────────────────────────────────────────────
 * Il faut exécuter du JS DANS le navigateur du scraper pour parcourir
 * `document.styleSheets` et matérialiser `cssText` dans un vrai `<style>`.
 * ScrapingBee le permet (`js_scenario` / `evaluate`), Scrapingdog NON
 * (son endpoint /scrape n'expose que `api_key`, `url`, `dynamic`).
 *
 * Ce module ne corrige rien à lui seul : il DÉTECTE le cas pour que
 * `fetcher.ts` bascule automatiquement sur un fournisseur capable.
 */

/**
 * Attributs qui signent une feuille de style pilotée par un moteur CSS-in-JS.
 * On matche l'attribut, pas sa valeur — les versions changent.
 */
const RUNTIME_CSS_ENGINES: Array<{ engine: string; attr: RegExp }> = [
  { engine: "styled-components", attr: /\bdata-styled(?:-version)?\b/i },
  { engine: "emotion", attr: /\bdata-emotion\b/i },
  { engine: "styled-jsx", attr: /\bid=["']__jsx-/i },
  { engine: "goober", attr: /\bdata-goober\b/i },
  { engine: "stitches", attr: /\bdata-stitches\b/i },
  { engine: "jss", attr: /\bdata-jss\b/i },
  { engine: "linaria", attr: /\bdata-linaria\b/i },
];

/** Capture chaque <style …>…</style> avec ses attributs et son contenu. */
const STYLE_TAG_RE = /<style([^>]*)>([\s\S]*?)<\/style>/gi;

/**
 * Le `<style>` que ScrapingBee injecte via son js_scenario. Sa présence prouve
 * que le CSS runtime A ÉTÉ matérialisé : on ne doit alors jamais escalader.
 */
const MATERIALIZED_MARKER = /id=["']__extracted-runtime-css["']/i;

export type CssCompletenessReport = {
  /** false → le HTML est amputé de son CSS runtime, il faut un autre fournisseur. */
  sufficient: boolean;
  /** Message lisible, destiné aux logs et au message d'erreur. */
  reason?: string;
  /** Total des caractères de CSS réellement présents dans les <style>. */
  inlineCssChars: number;
  /** Nombre de <link rel="stylesheet"> (CSS externe, non affecté par le bug). */
  externalStylesheets: number;
  /** Nombre de <style> vides portant une signature CSS-in-JS. */
  emptyRuntimeStyleTags: number;
  /** Moteurs CSS-in-JS détectés (dédupliqués). */
  runtimeEngines: string[];
  /** True si le <style> matérialisé par ScrapingBee est présent. */
  materialized: boolean;
};

/**
 * Analyse un HTML sérialisé et dit si son CSS est exploitable tel quel.
 *
 * Fonction PURE — aucun accès réseau, testable unitairement.
 */
export function assessCssCompleteness(html: string): CssCompletenessReport {
  const materialized = MATERIALIZED_MARKER.test(html);

  let inlineCssChars = 0;
  let emptyRuntimeStyleTags = 0;
  const engines = new Set<string>();

  STYLE_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STYLE_TAG_RE.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    inlineCssChars += body.length;

    if (body.length > 0) continue;

    // Balise vide : porte-t-elle une signature CSS-in-JS ?
    for (const { engine, attr } of RUNTIME_CSS_ENGINES) {
      if (attr.test(attrs)) {
        engines.add(engine);
        emptyRuntimeStyleTags++;
        break;
      }
    }
  }

  const externalStylesheets = (html.match(/<link[^>]+rel=["']?stylesheet/gi) ?? []).length;
  const runtimeEngines = Array.from(engines);

  if (materialized) {
    return {
      sufficient: true,
      inlineCssChars,
      externalStylesheets,
      emptyRuntimeStyleTags,
      runtimeEngines,
      materialized,
    };
  }

  if (emptyRuntimeStyleTags > 0) {
    return {
      sufficient: false,
      reason:
        `CSS runtime non matérialisé : ${emptyRuntimeStyleTags} balise(s) <style> vide(s) ` +
        `signée(s) ${runtimeEngines.join(", ")}. Les règles vivent dans le CSSOM et sont ` +
        `absentes du HTML sérialisé — le clone serait rendu sans style.`,
      inlineCssChars,
      externalStylesheets,
      emptyRuntimeStyleTags,
      runtimeEngines,
      materialized,
    };
  }

  // Garde-fou générique : une page volumineuse sans la moindre source de CSS
  // est presque toujours le symptôme d'un rendu incomplet.
  if (externalStylesheets === 0 && inlineCssChars < 500 && html.length > 20_000) {
    return {
      sufficient: false,
      reason:
        `Aucune source de CSS exploitable (${inlineCssChars} caractères inline, ` +
        `0 feuille externe) pour ${html.length} caractères de HTML.`,
      inlineCssChars,
      externalStylesheets,
      emptyRuntimeStyleTags,
      runtimeEngines,
      materialized,
    };
  }

  return {
    sufficient: true,
    inlineCssChars,
    externalStylesheets,
    emptyRuntimeStyleTags,
    runtimeEngines,
    materialized,
  };
}
