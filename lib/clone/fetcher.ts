// lib/clone/fetcher.ts
/**
 * Fetcher HTTP pour le clonage de funnels.
 *
 * Stratégie (chaîne de repli, dans l'ordre) :
 * 1. Scrapingdog (PRINCIPAL) — rendu JS via `dynamic=true`, temporisation
 *    d'hydratation via `wait`.
 * 2. ScrapingBee (REPLI) — rendu JS + `js_scenario` : extraction des CSS
 *    runtime (styled-components, emotion…) et capture des fonds calculés,
 *    injectées dans le DOM avant sérialisation.
 * 3. fetch() natif (DERNIER RECOURS) — pages statiques uniquement, pas de JS.
 *
 * Chaque fournisseur non configuré (clé absente) est simplement sauté ; un
 * échec bascule sur le suivant. L'ordre est surchargeable sans redéploiement
 * via `CLONE_SCRAPER_ORDER` (ex. "scrapingbee,scrapingdog").
 *
 * ⚠️ ÉCART FONCTIONNEL ASSUMÉ : le `js_scenario` (CSS runtime + capture des
 * fonds) est propre à ScrapingBee. Scrapingdog n'expose pas d'exécution de
 * script arbitraire : un clone servi par Scrapingdog garde le HTML hydraté et
 * les <style>/<link> du document, mais PERD les CSS injectées en mémoire par
 * styled-components/emotion ainsi que les fonds recalculés. Sur un site bâti
 * en CSS-in-JS, le repli ScrapingBee reste qualitativement supérieur.
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
const SCRAPINGDOG_ENDPOINT = "https://api.scrapingdog.com/scrape";
const FETCH_TIMEOUT_MS = 45_000;
const MIN_HTML_LENGTH = 500;

/** Fournisseurs de scraping utilisables par le clonage. */
type CloneScraperName = "scrapingdog" | "scrapingbee";

const DEFAULT_SCRAPER_ORDER: CloneScraperName[] = ["scrapingdog", "scrapingbee"];

const SCRAPER_ENV_KEY: Record<CloneScraperName, string> = {
  scrapingdog: "SCRAPINGDOG_API_KEY",
  scrapingbee: "SCRAPINGBEE_API_KEY",
};

/**
 * Ordre d'essai des fournisseurs. Surchargeable via `CLONE_SCRAPER_ORDER`
 * (liste séparée par des virgules) pour repasser sur ScrapingBee en principal
 * sans toucher au code. Toute valeur inconnue est ignorée ; une liste vide ou
 * invalide retombe sur l'ordre par défaut.
 */
function resolveScraperOrder(): CloneScraperName[] {
  const raw = (process.env.CLONE_SCRAPER_ORDER ?? "").trim().toLowerCase();
  if (!raw) return DEFAULT_SCRAPER_ORDER;
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is CloneScraperName => s === "scrapingdog" || s === "scrapingbee");
  return parsed.length > 0 ? parsed : DEFAULT_SCRAPER_ORDER;
}

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
 * Point d'entrée principal : récupère le HTML rendu d'une URL, en essayant les
 * fournisseurs dans l'ordre puis, en dernier recours, le fetch natif.
 *
 * Une erreur d'URL invalide n'est JAMAIS masquée par la chaîne de repli : elle
 * est levée avant toute tentative réseau.
 */
export async function fetchPageHtml(rawUrl: string): Promise<FetchedPage> {
  const url = validateUrl(rawUrl);
  const order = resolveScraperOrder();
  const failures: string[] = [];
  let sawConfiguredProvider = false;

  console.log(`[clone-fetcher] Fetching ${url.toString()}`);
  console.log(`[clone-fetcher] Ordre des fournisseurs : ${order.join(" → ")} → natif`);

  for (const name of order) {
    const apiKey = process.env[SCRAPER_ENV_KEY[name]];
    if (!apiKey) {
      console.log(`[clone-fetcher] ${name} ignoré (${SCRAPER_ENV_KEY[name]} absente).`);
      continue;
    }
    sawConfiguredProvider = true;

    try {
      return name === "scrapingdog"
        ? await fetchViaScrapingdog(url, apiKey)
        : await fetchViaScrapingBee(url, apiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${name} → ${message}`);
      console.warn(`[clone-fetcher] ❌ ${name} a échoué, bascule sur le suivant. ${message}`);
      continue;
    }
  }

  // Dernier recours : fetch natif (pages statiques uniquement).
  try {
    if (sawConfiguredProvider) {
      console.warn("[clone-fetcher] ⚠️ Tous les fournisseurs ont échoué → tentative en fetch natif (sans rendu JS).");
    }
    return await fetchViaNative(url);
  } catch (nativeErr) {
    if (failures.length > 0) {
      // On remonte le détail de CHAQUE fournisseur : sans ça, l'utilisateur ne
      // voyait qu'un « HTTP 400 » sec, sans savoir lequel ni pourquoi.
      throw new CloneFetchError(
        "scraping-blocked",
        `Aucun fournisseur n'a pu récupérer la page. ${failures.join(" | ")}`,
      );
    }
    if (!sawConfiguredProvider) {
      throw new CloneFetchError(
        "scraper-missing-key",
        "Aucune clé de scraping configurée (SCRAPINGDOG_API_KEY ou SCRAPINGBEE_API_KEY) et le fetch natif a échoué.",
      );
    }
    throw nativeErr;
  }
}

/**
 * Récupération via Scrapingdog (fournisseur PRINCIPAL).
 *
 * `dynamic=true` déclenche le rendu JS (facturé plus cher que le statique) et
 * `wait` laisse le temps à l'hydratation React de s'achever — l'équivalent du
 * `{ wait: 3000 }` en tête du js_scenario ScrapingBee.
 *
 * ⚠️ Pas d'exécution de script arbitraire côté Scrapingdog : ni extraction des
 * CSS runtime, ni capture des fonds calculés (voir l'en-tête du fichier).
 */
async function fetchViaScrapingdog(url: URL, apiKey: string): Promise<FetchedPage> {
  const params = new URLSearchParams({
    api_key: apiKey,
    url: url.toString(),
    dynamic: "true",
    wait: "3000",
  });

  const endpoint = `${SCRAPINGDOG_ENDPOINT}?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, { method: "GET", signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new CloneFetchError(
        "scraping-timeout",
        `Scrapingdog a dépassé ${FETCH_TIMEOUT_MS / 1000}s pour "${url.toString()}"`,
      );
    }
    throw new CloneFetchError("internal", `Erreur réseau Scrapingdog : ${(err as Error).message}`);
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    // Le corps de la réponse est la SEULE façon de savoir ce que le fournisseur
    // reproche réellement (paramètre refusé, crédits, domaine bloqué…).
    console.error(
      `[clone-fetcher] Scrapingdog HTTP ${response.status} : ${errorBody.slice(0, 300)}`,
    );

    if (response.status === 401) {
      throw new CloneFetchError("scraper-missing-key", "Clé Scrapingdog invalide ou expirée");
    }
    if (response.status === 403) {
      // Scrapingdog renvoie parfois 403 pour des crédits épuisés plutôt qu'un
      // vrai problème d'authentification : on tranche via le corps.
      const looksLikeQuota = /credit|quota|limit|exhaust/i.test(errorBody);
      throw new CloneFetchError(
        looksLikeQuota ? "scraper-quota" : "scraper-missing-key",
        looksLikeQuota
          ? "Crédits Scrapingdog épuisés"
          : "Clé Scrapingdog invalide ou expirée",
      );
    }
    if (response.status === 429) {
      throw new CloneFetchError("scraper-quota", "Limite de débit Scrapingdog atteinte");
    }
    if (response.status >= 500) {
      throw new CloneFetchError("scraping-blocked", `Scrapingdog indisponible (HTTP ${response.status})`);
    }
    throw new CloneFetchError(
      "scraping-blocked",
      `Scrapingdog a renvoyé HTTP ${response.status}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ""}`,
    );
  }

  const html = await response.text();
  validateHtmlSize(html, url.toString());

  console.log(`[clone-fetcher] ✅ Scrapingdog : ${html.length} chars (rendu JS, sans extraction CSS runtime)`);

  return {
    url: url.toString(),
    finalUrl: response.url || url.toString(),
    html,
    renderedWithJs: true,
    fetchedAt: new Date().toISOString(),
  };
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

  // ───────────────────────────────────────────────────────────────────────
  // 🆕 PHASE 1A — Capture des FONDS RÉELS de chaque section.
  //
  // Problème : le fond visible d'une section vient souvent d'un ANCÊTRE
  // (body, wrapper, classe CSS du <head>), pas de l'élément racine de la
  // section. Quand le mapper éclate le body en sous-sections, chaque bloc
  // perd ce fond hérité → fond blanc rendu en noir/transparent.
  //
  // Correctif générique : pendant le scraping (DOM hydraté + CSS runtime
  // matérialisé), on parcourt chaque section candidate et on écrit son fond
  // EFFECTIF (calculé) en style inline, ce qui la rend autonome.
  //
  // Règles de sûreté :
  //  - background-color : on remonte aux ancêtres jusqu'à trouver une couleur
  //    opaque. Si on croise d'abord une background-image, on n'écrit PAS de
  //    couleur (l'image reste visible — on ne peint pas par-dessus).
  //  - background-image : on ne capture QUE l'image propre de l'élément
  //    (jamais héritée) pour éviter qu'une image plein-écran se répète sur
  //    chaque sous-section.
  //  - on ne touche jamais un élément qui a déjà un fond inline explicite.
  // ───────────────────────────────────────────────────────────────────────
  const captureBackgroundsScript = `
    (function() {
      try {
        function isTransparent(c) {
          if (!c) return true;
          c = String(c).trim().toLowerCase();
          if (c === 'transparent' || c === 'none' || c === 'initial' || c === 'inherit') return true;
          var m = c.match(/rgba?\\(([^)]+)\\)/);
          if (m) {
            var parts = m[1].split(',').map(function(s){ return parseFloat(s); });
            if (parts.length >= 4 && parts[3] === 0) return true;
          }
          return false;
        }
        function effectiveBgColor(el) {
          var node = el, hops = 0;
          while (node && node.nodeType === 1 && hops < 12) {
            var cs = window.getComputedStyle(node);
            if (cs) {
              // Une image de fond visible derrière → ne pas écraser avec une couleur.
              if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
              if (!isTransparent(cs.backgroundColor)) return cs.backgroundColor;
            }
            node = node.parentElement;
            hops++;
          }
          return null;
        }
        var els = document.querySelectorAll('body > *, body section');
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (!el || el.nodeType !== 1) continue;
          var tag = el.tagName ? el.tagName.toLowerCase() : '';
          if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'br') continue;

          var inlineStyle = (el.getAttribute('style') || '').toLowerCase();
          var hasInlineBg =
            inlineStyle.indexOf('background:') !== -1 ||
            inlineStyle.indexOf('background-color') !== -1 ||
            inlineStyle.indexOf('background-image') !== -1;
          if (hasInlineBg) { el.setAttribute('data-ff-bg-captured', 'skip'); continue; }

          var cs = window.getComputedStyle(el);

          // 1) Image de fond PROPRE (non héritée)
          if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
            el.style.backgroundImage = cs.backgroundImage;
            if (cs.backgroundSize) el.style.backgroundSize = cs.backgroundSize;
            if (cs.backgroundPosition) el.style.backgroundPosition = cs.backgroundPosition;
            if (cs.backgroundRepeat) el.style.backgroundRepeat = cs.backgroundRepeat;
            el.setAttribute('data-ff-bg-captured', 'image');
            continue;
          }

          // 2) Couleur de fond EFFECTIVE (remonte aux ancêtres)
          var eff = effectiveBgColor(el);
          if (eff && !isTransparent(eff)) {
            el.style.backgroundColor = eff;
            el.setAttribute('data-ff-bg-captured', 'color');
          }
        }

        // 🆕 FIX FOND — le VRAI fond (dégradé/couleur) est souvent sur un wrapper
        // INTERNE de section (div#section-XXX) via un CSS SCOPÉ (#preview-container,
        // #__nuxt…). Extrait en iframe sans cet ancêtre, la règle ne matche plus →
        // fond blanc. On inline donc le fond PROPRE (calculé) des div de section.
        var dv = document.querySelectorAll('body section div');
        for (var d = 0; d < dv.length; d++) {
          var de = dv[d];
          if (de.getAttribute('data-ff-bg-captured')) continue;
          if ((de.getAttribute('style') || '').toLowerCase().indexOf('background') !== -1) continue;
          var dcs = window.getComputedStyle(de);
          if (!dcs) continue;
          if (dcs.backgroundImage && dcs.backgroundImage !== 'none') {
            de.style.backgroundImage = dcs.backgroundImage;
            de.setAttribute('data-ff-bg-captured', 'img2');
          } else if (!isTransparent(dcs.backgroundColor)) {
            de.style.backgroundColor = dcs.backgroundColor;
            de.setAttribute('data-ff-bg-captured', 'col2');
          }
        }

        // ── FOND DE PAGE (html/body) — cause racine principale ──────────────
        // Le parser fait $("body").html() : le <body style> est jeté, et le
        // reset du <head> forçait 'background: transparent'. Le vrai fond de la
        // page (souvent blanc) était donc perdu → rendu noir/transparent.
        // On matérialise le fond calculé de html/body dans un <style> pinné,
        // capturé ensuite via le head et appliqué en !important dans l'iframe.
        function bgDecl(el) {
          var cs = el ? window.getComputedStyle(el) : null;
          if (!cs) return '';
          var out = '';
          if (cs.backgroundImage && cs.backgroundImage !== 'none') {
            out += 'background-image:' + cs.backgroundImage + ' !important;';
            out += 'background-size:' + (cs.backgroundSize || 'auto') + ' !important;';
            out += 'background-position:' + (cs.backgroundPosition || '0% 0%') + ' !important;';
            out += 'background-repeat:' + (cs.backgroundRepeat || 'repeat') + ' !important;';
            out += 'background-attachment:' + (cs.backgroundAttachment || 'scroll') + ' !important;';
          }
          if (!isTransparent(cs.backgroundColor)) {
            out += 'background-color:' + cs.backgroundColor + ' !important;';
          }
          return out;
        }
        var pageDecl = bgDecl(document.body) || bgDecl(document.documentElement);
        if (pageDecl) {
          var bgStyle = document.createElement('style');
          bgStyle.id = '__ff-captured-page-bg';
          bgStyle.textContent = 'html,body{' + pageDecl + '}';
          document.head.appendChild(bgStyle);
        }
      } catch (e) {
        // best-effort
      }
    })();
  `;

  // Scénario : on attend 3s pour l'hydratation React/styled-components, on
  // matérialise les CSS runtime, PUIS on capture les fonds réels (l'ordre
  // importe : la capture lit getComputedStyle après hydratation).
  const jsScenario = JSON.stringify({
    instructions: [
      { wait: 3000 },
      { evaluate: extractCssScript },
      { evaluate: captureBackgroundsScript },
      { wait: 500 },
    ],
  });

  // 🐛 CAUSE DU « HTTP 400 » : `country_code` était envoyé AVEC
  // `premium_proxy: "false"`. ScrapingBee réserve le ciblage géographique aux
  // proxies premium/stealth et rejette la requête avec un 400 dès que
  // `country_code` est présent sans l'un des deux. Le paramètre n'apportait
  // rien ici (on clone la page telle qu'elle est servie) : on le retire.
  // Si un jour un ciblage pays devient nécessaire, il faudra passer
  // `premium_proxy: "true"` EN MÊME TEMPS — les deux vont de pair.
  const params = new URLSearchParams({
    api_key: apiKey,
    url: url.toString(),
    render_js: "true",
    js_scenario: jsScenario,
    block_resources: "false",
    premium_proxy: "false",
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
        "scraper-missing-key",
        "Clé ScrapingBee invalide ou expirée"
      );
    }
    if (response.status === 402 || response.status === 429) {
      throw new CloneFetchError(
        "scraper-quota",
        "Quota ScrapingBee dépassé (1000 crédits/mois gratuit)"
      );
    }
    if (response.status >= 500) {
      throw new CloneFetchError(
        "scraping-blocked",
        `Site cible inaccessible (HTTP ${response.status})`
      );
    }
    // 🆕 Le corps de la réponse est remonté dans le message : un « HTTP 400 »
    // sec était indébogable côté utilisateur (c'est exactement ce qui a masqué
    // le conflit country_code / premium_proxy). ScrapingBee y met la raison
    // exacte du rejet.
    throw new CloneFetchError(
      "scraping-blocked",
      `ScrapingBee a renvoyé HTTP ${response.status}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ""}`
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
        `Site protégé (HTTP ${response.status}) — configurez SCRAPINGDOG_API_KEY (ou SCRAPINGBEE_API_KEY) pour le contourner`
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
