// lib/scraping/providers/scrapingbee.ts
// 🆕 MODULE 2 — Connecteur ScrapingBee (fournisseur PRINCIPAL).
// Doc : https://www.scrapingbee.com/documentation/ — vérifier les paramètres
// exacts si l'API évolue (implémentation non testée en direct : pas d'accès
// réseau/clé dans cet environnement).

import type { ScraperProvider, ScrapeOptions, ScrapeResult } from "../types";
import { assertHtmlLooksValid, throwProviderError, timedFetch } from "../httpHelper";

const ENDPOINT = "https://app.scrapingbee.com/api/v1/";
const NAME = "scrapingbee" as const;

export const scrapingBeeProvider: ScraperProvider = {
  name: NAME,
  envKey: "SCRAPINGBEE_API_KEY",

  isConfigured(): boolean {
    return Boolean(process.env.SCRAPINGBEE_API_KEY);
  },

  async scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) throwProviderError(NAME, "missing-key", "SCRAPINGBEE_API_KEY absente.");

    const params = new URLSearchParams({
      api_key: apiKey,
      url,
      render_js: options.renderJs === false ? "false" : "true",
      premium_proxy: options.premiumProxy ? "true" : "false",
      block_resources: "false",
    });
    if (options.countryCode) params.set("country_code", options.countryCode.toLowerCase());

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
      if (response.status === 401 || response.status === 403) {
        throwProviderError(NAME, "auth", "Clé API invalide ou expirée.", response.status);
      }
      // ScrapingBee renvoie 402 quand le quota mensuel de crédits est épuisé.
      if (response.status === 402) {
        throwProviderError(NAME, "quota", "Quota de crédits épuisé.", response.status);
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

    const finalUrl = (response.headers.get("spb-resolved-url") || "").trim() || url;

    return {
      html,
      finalUrl,
      provider: NAME,
      renderedWithJs: options.renderJs !== false,
      statusCode: response.status,
      fetchedAt: new Date().toISOString(),
    };
  },
};
