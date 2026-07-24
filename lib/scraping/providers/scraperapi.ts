// lib/scraping/providers/scraperapi.ts
// 🆕 MODULE 2 — Connecteur ScraperAPI (fallback n°2).
// Doc : https://docs.scraperapi.com/ — vérifier les paramètres exacts si
// l'API évolue (implémentation non testée en direct : pas d'accès réseau/clé
// dans cet environnement).

import type { ScraperProvider, ScrapeOptions, ScrapeResult } from "../types";
import { assertHtmlLooksValid, throwProviderError, timedFetch } from "../httpHelper";

const ENDPOINT = "https://api.scraperapi.com/";
const NAME = "scraperapi" as const;

export const scraperApiProvider: ScraperProvider = {
  name: NAME,
  envKey: "SCRAPERAPI_API_KEY",

  isConfigured(): boolean {
    return Boolean(process.env.SCRAPERAPI_API_KEY);
  },

  async scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
    const apiKey = process.env.SCRAPERAPI_API_KEY;
    if (!apiKey) throwProviderError(NAME, "missing-key", "SCRAPERAPI_API_KEY absente.");

    const params = new URLSearchParams({
      api_key: apiKey,
      url,
      render: options.renderJs === false ? "false" : "true",
    });
    if (options.countryCode) params.set("country_code", options.countryCode.toLowerCase());
    if (options.premiumProxy) params.set("premium", "true");

    const endpoint = `${ENDPOINT}?${params.toString()}`;
    const { response, networkError, timedOut } = await timedFetch(endpoint, options.timeoutMs);

    if (!response) {
      throwProviderError(
        NAME,
        timedOut ? "timeout" : "unavailable",
        timedOut ? "Délai dépassé." : `Erreur réseau : ${networkError?.message ?? "inconnue"}.`,
      );
    }

    if (!response.ok) {
      const bodyPreview = await response.text().catch(() => "");
      if (response.status === 401) {
        throwProviderError(NAME, "auth", "Clé API invalide ou expirée.", response.status);
      }
      if (response.status === 403) {
        // ScraperAPI renvoie souvent 403 à la fois pour une clé invalide ET
        // pour un quota de crédits épuisé — on affine via le corps si possible.
        const looksLikeQuota = /credit|quota|limit|concurren/i.test(bodyPreview);
        throwProviderError(
          NAME,
          looksLikeQuota ? "quota" : "auth",
          looksLikeQuota ? "Quota de crédits (ou limite de requêtes simultanées) épuisé." : "Clé API invalide ou expirée.",
          response.status,
        );
      }
      if (response.status === 429) {
        throwProviderError(NAME, "rate-limit", "Limite de débit atteinte.", response.status);
      }
      if (response.status >= 500) {
        throwProviderError(NAME, "unavailable", `Service indisponible (HTTP ${response.status}).`, response.status);
      }
      throwProviderError(
        NAME,
        "bad-request",
        `HTTP ${response.status}${bodyPreview ? ` — ${bodyPreview.slice(0, 200)}` : ""}`,
        response.status,
      );
    }

    const html = await response.text();
    assertHtmlLooksValid(NAME, html, url);

    return {
      html,
      finalUrl: response.url || url,
      provider: NAME,
      renderedWithJs: options.renderJs !== false,
      statusCode: response.status,
      fetchedAt: new Date().toISOString(),
    };
  },
};
