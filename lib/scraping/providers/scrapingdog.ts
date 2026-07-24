// lib/scraping/providers/scrapingdog.ts
// 🆕 MODULE 2 — Connecteur Scrapingdog (fallback n°1).
// Doc : https://docs.scrapingdog.com/ — vérifier les paramètres exacts si
// l'API évolue (implémentation non testée en direct : pas d'accès réseau/clé
// dans cet environnement).

import type { ScraperProvider, ScrapeOptions, ScrapeResult } from "../types";
import { assertHtmlLooksValid, throwProviderError, timedFetch } from "../httpHelper";

const ENDPOINT = "https://api.scrapingdog.com/scrape";
const NAME = "scrapingdog" as const;

export const scrapingdogProvider: ScraperProvider = {
  name: NAME,
  envKey: "SCRAPINGDOG_API_KEY",

  isConfigured(): boolean {
    return Boolean(process.env.SCRAPINGDOG_API_KEY);
  },

  async scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
    const apiKey = process.env.SCRAPINGDOG_API_KEY;
    if (!apiKey) throwProviderError(NAME, "missing-key", "SCRAPINGDOG_API_KEY absente.");

    const params = new URLSearchParams({
      api_key: apiKey,
      url,
      dynamic: options.renderJs === false ? "false" : "true",
    });
    if (options.countryCode) params.set("country", options.countryCode.toLowerCase());
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
      if (response.status === 401 || response.status === 403) {
        // Scrapingdog renvoie parfois 403 pour un quota épuisé plutôt qu'un
        // vrai problème d'auth — on affine via le corps de la réponse.
        const looksLikeQuota = /credit|quota|limit/i.test(bodyPreview);
        throwProviderError(
          NAME,
          looksLikeQuota ? "quota" : "auth",
          looksLikeQuota ? "Quota de crédits épuisé." : "Clé API invalide ou expirée.",
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
