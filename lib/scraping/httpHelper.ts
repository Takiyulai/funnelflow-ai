// lib/scraping/httpHelper.ts
// 🆕 MODULE 2 — Utilitaires HTTP partagés par les connecteurs de scraping.
// Ne loggue JAMAIS de clé API — uniquement le nom du fournisseur et le statut.

import { ScrapeProviderError, type ScrapeErrorKind, type ScraperProviderName } from "./types";

const DEFAULT_TIMEOUT_MS = 45_000;
const MIN_HTML_LENGTH = 200;

/** GET avec timeout, renvoie la réponse brute (ne lève PAS sur HTTP non-2xx —
 *  laisse chaque connecteur interpréter les codes selon les conventions de son
 *  fournisseur, qui diffèrent d'un service à l'autre). */
export async function timedFetch(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ response?: Response; networkError?: Error; timedOut: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    return { response, timedOut: false };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return { networkError: err instanceof Error ? err : new Error(String(err)), timedOut: isAbort };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Classe un code HTTP générique en ScrapeErrorKind (les cas spécifiques à un
 *  fournisseur précis sont affinés dans son propre connecteur). */
export function classifyStatus(status: number): ScrapeErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "quota";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "unavailable";
  if (status >= 400) return "bad-request";
  return "other";
}

export function throwProviderError(
  provider: ScraperProviderName,
  kind: ScrapeErrorKind,
  message: string,
  statusCode?: number,
): never {
  // 🔒 Jamais de clé API dans le message d'erreur (celui-ci finit potentiellement en log).
  throw new ScrapeProviderError(provider, kind, message, statusCode);
}

/** Garde-fou commun : une page anormalement courte est presque toujours un
 *  blocage (captcha, mur anti-bot) plutôt qu'un vrai contenu. */
export function assertHtmlLooksValid(
  provider: ScraperProviderName,
  html: string,
  sourceUrl: string,
): void {
  if (!html || html.length < MIN_HTML_LENGTH) {
    throwProviderError(
      provider,
      "bad-request",
      `Page trop petite ou vide (${html?.length ?? 0} caractères) pour "${sourceUrl}" — probable blocage.`,
    );
  }
}
