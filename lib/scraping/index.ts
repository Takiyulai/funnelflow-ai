// lib/scraping/index.ts
// 🆕 MODULE 2 — Point d'entrée unique de l'abstraction scraping.
//
// scrape(url, options) essaie les fournisseurs dans l'ORDRE de
// `PROVIDER_ORDER` (constante ci-dessous, facilement réordonnable) et bascule
// automatiquement sur le suivant en cas d'échec — quota épuisé, rate limit,
// service indisponible, clé manquante, ou toute autre erreur. Le but est la
// ROBUSTESSE par rotation entre fournisseurs DIFFÉRENTS (pas plusieurs
// comptes du même). Si TOUS échouent (ou qu'aucun n'est configuré), on lève
// une erreur claire — jamais de crash silencieux.

import { scrapingBeeProvider } from "./providers/scrapingbee";
import { scrapingdogProvider } from "./providers/scrapingdog";
import { scraperApiProvider } from "./providers/scraperapi";
import {
  AllScrapingProvidersFailedError,
  ScrapeProviderError,
  type ScrapeErrorKind,
  type ScrapeOptions,
  type ScrapeResult,
  type ScraperProvider,
  type ScraperProviderName,
} from "./types";

export * from "./types";

/** Ordre d'essai — ScrapingBee en principal, puis Scrapingdog, puis ScraperAPI.
 *  Pour changer la priorité, réordonne simplement ce tableau. */
export const PROVIDER_ORDER: ScraperProvider[] = [
  scrapingBeeProvider,
  scrapingdogProvider,
  scraperApiProvider,
];

/** 🆕 Suivi de consommation (in-memory, best-effort) : compte les tentatives
 *  et succès par fournisseur depuis le dernier redémarrage du process. Un
 *  suivi persistant (table dédiée) pourra remplacer ceci plus tard sans
 *  changer l'API de `scrape()`. */
type ProviderStats = { attempts: number; successes: number; failures: number };
const consumptionStats = new Map<string, ProviderStats>();

function bumpStat(provider: string, kind: "attempt" | "success" | "failure") {
  const s = consumptionStats.get(provider) ?? { attempts: 0, successes: 0, failures: 0 };
  if (kind === "attempt") s.attempts++;
  else if (kind === "success") s.successes++;
  else s.failures++;
  consumptionStats.set(provider, s);
}

/** Lecture du suivi de consommation courant (pour une future UI/monitoring). */
export function getScrapingConsumptionStats(): Record<string, ProviderStats> {
  return Object.fromEntries(consumptionStats.entries());
}

/**
 * Scrape une URL en essayant chaque fournisseur configuré, dans l'ordre,
 * jusqu'au premier succès. Ne loggue JAMAIS de clé API — uniquement le nom du
 * fournisseur, le statut de la tentative, et la catégorie d'erreur.
 */
export async function scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const attempts: { provider: ScraperProviderName; kind: ScrapeErrorKind; message: string }[] = [];

  for (const provider of PROVIDER_ORDER) {
    if (!provider.isConfigured()) {
      console.log(`[scraping] ${provider.name} ignoré (clé ${provider.envKey} absente).`);
      continue;
    }

    bumpStat(provider.name, "attempt");
    console.log(`[scraping] Tentative via ${provider.name}…`);

    try {
      const result = await provider.scrape(url, options);
      bumpStat(provider.name, "success");
      console.log(`[scraping] ✅ ${provider.name} a servi la requête (${result.html.length} caractères).`);
      return result;
    } catch (err) {
      bumpStat(provider.name, "failure");
      if (err instanceof ScrapeProviderError) {
        console.warn(`[scraping] ❌ ${err.provider} a échoué (${err.kind}) : ${err.message}`);
        attempts.push({ provider: err.provider, kind: err.kind, message: err.message });
      } else {
        const message = err instanceof Error ? err.message : "erreur inconnue";
        console.warn(`[scraping] ❌ ${provider.name} a échoué (other) : ${message}`);
        attempts.push({ provider: provider.name, kind: "other", message });
      }
      // Bascule automatique sur le fournisseur suivant.
      continue;
    }
  }

  // Tous les fournisseurs configurés ont échoué (ou aucun n'est configuré).
  throw new AllScrapingProvidersFailedError(attempts);
}
