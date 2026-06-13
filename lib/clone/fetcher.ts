// lib/clone/fetcher.ts
/**
 * Fetcher HTTP pour le clonage de funnels.
 *
 * Stratégie :
 * 1. Si SCRAPINGBEE_API_KEY est définie → utilise ScrapingBee (rendu JS, bypass Cloudflare).
 *    Utilise js_scenario pour extraire les CSS runtime (styled-components, emotion, etc.)
 *    et les injecter dans le <head> avant la sérialisation.
 * 2. Sinon → fallback fetch() natif (limité aux pages statiques).
 *
 * Timeout global : 45s (l'extraction CSS runtime ajoute ~3-5s).
 *
 * Note : le scroll automatique pour déclencher le lazy-load a été retiré car
 * il causait des explosions de taille de DOM (300+ KB HTML, 500+ KB CSS) qui
 * faisaient ramer l'éditeur React (>5 min de chargement). Les sections
 * lazy-loaded ne sont pas capturées en V1 — à réintroduire via Playwright
 * avec un meilleur contrôle.
 */

import type { FetchedPage, CloneErrorCode } from "./types";

const SCRAPINGBEE_ENDPOINT = "https://app.scrapingbee.com/api/v1/";
const FETCH_TIMEOUT_MS = 45_000;
const MIN_HTML_LENGTH = 500;

export class CloneFetchError extends Error {
  code: CloneErrorCode;
  constructor(code: CloneErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CloneFetchError";
  }
}

/**
 * Valide qu'une URL est bien formée et utilise http/https.
 */
export function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new CloneFetchError("invalid-url", `URL invalide : "${rawUrl}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CloneFetchError(
      "invalid-url",
      `Protocole non supporté : "${parsed.protocol}" (seuls http/https sont acceptés)`
    );
  }
  return parsed;
}

/**
 * Point d'entrée principal : récupère le HTML rendu d'une URL.
 */
export async function fetchPageHtml(rawUrl: string): Promise<FetchedPage> {
  const url = validateUrl(rawUrl);
  const apiKey = process.env.SCRAPINGBEE_API_KEY;

  console.log(`[clone-fetcher] Fetching ${url.toString()}`);
  console.log(
    `[clone-fetcher] Mode : ${apiKey ? "ScrapingBee (JS rendering + runtime CSS extraction)" : "Native fetch (no JS)"}`
  );

  if (apiKey) {
    return await fetchViaScrapingBee(url, apiKey);
  }
  return await fetchViaNative(url);
}

/**
 * Récupération via ScrapingBee — gère le rendu JS, le bypass anti-bot, et
 * l'extraction des CSS runtime (styled-components / emotion / etc.).
 *
 * Le js_scenario exécute du JS dans le navigateur ScrapingBee AVANT la
 * sérialisation du HTML, pour parcourir document.styleSheets et matérialiser
 * toutes les règles CSS injectées en mémoire sous forme de <style> visible
 * dans le DOM. Sans ça, les CSS de styled-components sont perdues.
 */
async function fetchViaScrapingBee(url: URL, apiKey: string): Promise<FetchedPage> {
  // Script exécuté dans le navigateur ScrapingBee avant sérialisation.
  // Parcourt document.styleSheets et matérialise toutes les règles CSS en
  // mémoire (styled-components, emotion, runtime injections) sous forme
  // d'un <style id="__extracted-runtime-css"> dans le head.
  const extractCssScript = `
    (function() {
      try {
        var allCss = '';
        var sheets = document.styleSheets;
        for (var i = 0; i < sheets.length; i++) {
          try {
            var rules = sheets[i].cssRules || sheets[i].rules;
            if (!rules) continue;
            for (var j = 0; j < rules.length; j++) {
              allCss += rules[j].cssText + '\\n';
            }
          } catch (e) {
            // CORS bloque la lecture des feuilles cross-origin, on ignore
          }
        }
        var styleEl = document.createElement('style');
        styleEl.id = '__extracted-runtime-css';
        styleEl.setAttribute('data-extracted-length', allCss.length.toString());
        styleEl.textContent = allCss;
        document.head.appendChild(styleEl);
      } catch (e) {
        // best-effort
      }
    })();
  `;

  // Scénario simple : on attend 3s pour l'hydratation React/styled-components,
  // puis on extrait les CSS runtime. Pas de scroll automatique pour éviter
  // l'explosion de taille de DOM (lazy-load).
  const jsScenario = JSON.stringify({
    instructions: [
      { wait: 3000 },
      { evaluate: extractCssScript },
      { wait: 500 },
    ],
  });

  const params = new URLSearchParams({
    api_key: apiKey,
    url: url.toString(),
    render_js: "true",
    js_scenario: jsScenario,
    block_resources: "false",
    premium_proxy: "false",
    country_code: "us",
  });

  const endpoint = `${SCRAPINGBEE_ENDPOINT}?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new CloneFetchError(
        "scraping-timeout",
        `ScrapingBee a dépassé ${FETCH_TIMEOUT_MS / 1000}s pour "${url.toString()}"`
      );
    }
    throw new CloneFetchError(
      "internal",
      `Erreur réseau ScrapingBee : ${(err as Error).message}`
    );
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(
      `[clone-fetcher] ScrapingBee HTTP ${response.status} : ${errorBody.slice(0, 300)}`
    );

    if (response.status === 401 || response.status === 403) {
      throw new CloneFetchError(
        "scrapingbee-missing-key",
        "Clé ScrapingBee invalide ou expirée"
      );
    }
    if (response.status === 402 || response.status === 429) {
      throw new CloneFetchError(
        "scrapingbee-quota",
        "Quota ScrapingBee dépassé (1000 crédits/mois gratuit)"
      );
    }
    if (response.status >= 500) {
      throw new CloneFetchError(
        "scraping-blocked",
        `Site cible inaccessible (HTTP ${response.status})`
      );
    }
    throw new CloneFetchError(
      "scraping-blocked",
      `ScrapingBee a renvoyé HTTP ${response.status}`
    );
  }

  const html = await response.text();
  validateHtmlSize(html, url.toString());

  const resolvedUrl =
    (response.headers.get("spb-resolved-url") || "").trim() || url.toString();

  // Log de l'efficacité de l'extraction CSS runtime
  const extractedMatch = html.match(
    /id="__extracted-runtime-css"\s+data-extracted-length="(\d+)"/
  );
  const extractedLength = extractedMatch ? parseInt(extractedMatch[1], 10) : 0;

  console.log(
    `[clone-fetcher] ✅ ScrapingBee : ${html.length} chars (resolved: ${resolvedUrl}) — runtime CSS extracted: ${extractedLength} chars`
  );

  return {
    url: url.toString(),
    finalUrl: resolvedUrl,
    html,
    renderedWithJs: true,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fallback : fetch() natif. Limité aux pages statiques (pas de rendu JS).
 */
async function fetchViaNative(url: URL): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new CloneFetchError(
        "scraping-timeout",
        `Fetch natif a dépassé ${FETCH_TIMEOUT_MS / 1000}s pour "${url.toString()}"`
      );
    }
    throw new CloneFetchError(
      "scraping-blocked",
      `Erreur réseau : ${(err as Error).message}`
    );
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw new CloneFetchError(
        "scraping-blocked",
        `Site protégé (HTTP ${response.status}) - configurez SCRAPINGBEE_API_KEY pour bypass`
      );
    }
    throw new CloneFetchError(
      "scraping-blocked",
      `HTTP ${response.status} sur ${url.toString()}`
    );
  }

  const html = await response.text();
  validateHtmlSize(html, url.toString());

  console.log(
    `[clone-fetcher] ✅ Native fetch : ${html.length} chars (no JS rendering)`
  );

  return {
    url: url.toString(),
    finalUrl: response.url || url.toString(),
    html,
    renderedWithJs: false,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Garde-fou : refuse les pages trop petites (probablement vides ou bloquées).
 */
function validateHtmlSize(html: string, sourceUrl: string): void {
  if (html.length < MIN_HTML_LENGTH) {
    throw new CloneFetchError(
      "page-too-small",
      `Page trop petite (${html.length} chars < ${MIN_HTML_LENGTH}) pour "${sourceUrl}" — probable blocage ou page vide`
    );
  }
}
