// lib/scraping/types.ts
// 🆕 MODULE 2 — Abstraction scraping multi-fournisseurs.
//
// Interface commune : quel que soit le fournisseur réellement appelé, l'appelant
// reçoit toujours un ScrapeResult normalisé. Objectif : robustesse (rotation
// automatique entre fournisseurs DIFFÉRENTS si l'un est en panne/quota dépassé),
// pas juste plusieurs comptes du même fournisseur.

export type ScraperProviderName = "scrapingbee" | "scrapingdog" | "scraperapi";

export type ScrapeOptions = {
  /** Active le rendu JavaScript (navigateur headless côté fournisseur). Défaut : true. */
  renderJs?: boolean;
  /** Code pays ISO-2 pour le proxy géolocalisé (ex. "us", "fr"). Optionnel. */
  countryCode?: string;
  /** Utilise un proxy premium/résidentiel si le fournisseur le supporte (coût plus élevé). */
  premiumProxy?: boolean;
  /** Timeout par tentative, en ms. Défaut : 45000. */
  timeoutMs?: number;
};

export type ScrapeResult = {
  /** HTML brut renvoyé par le fournisseur. */
  html: string;
  /** URL réellement chargée (après redirections éventuelles). */
  finalUrl: string;
  /** Fournisseur qui a effectivement servi la requête. */
  provider: ScraperProviderName;
  /** true si le rendu JS a été appliqué côté fournisseur. */
  renderedWithJs: boolean;
  /** Code HTTP renvoyé par le fournisseur (quand disponible). */
  statusCode?: number;
  fetchedAt: string;
};

/** Catégorie d'échec — sert au logging/suivi de consommation, pas à bloquer le fallback :
 *  quel que soit le kind, l'orchestrateur bascule sur le fournisseur suivant. */
export type ScrapeErrorKind =
  | "missing-key"
  | "auth"
  | "quota"
  | "rate-limit"
  | "unavailable"
  | "timeout"
  | "bad-request"
  | "other";

export class ScrapeProviderError extends Error {
  readonly provider: ScraperProviderName;
  readonly kind: ScrapeErrorKind;
  readonly statusCode?: number;

  constructor(
    provider: ScraperProviderName,
    kind: ScrapeErrorKind,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = "ScrapeProviderError";
    this.provider = provider;
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

/** Levée quand TOUS les fournisseurs ont échoué (ou qu'aucun n'est configuré). */
export class AllScrapingProvidersFailedError extends Error {
  readonly attempts: { provider: ScraperProviderName; kind: ScrapeErrorKind; message: string }[];

  constructor(attempts: AllScrapingProvidersFailedError["attempts"]) {
    const summary = attempts
      .map((a) => `${a.provider} (${a.kind})`)
      .join(", ");
    super(
      attempts.length === 0
        ? "Aucun fournisseur de scraping n'est configuré (aucune clé API trouvée)."
        : `Tous les fournisseurs de scraping ont échoué : ${summary}.`,
    );
    this.name = "AllScrapingProvidersFailedError";
    this.attempts = attempts;
  }
}

export interface ScraperProvider {
  readonly name: ScraperProviderName;
  /** Nom de la variable d'env attendue (pour messages d'erreur/diagnostics, jamais loguée en clair). */
  readonly envKey: string;
  /** true si la clé API est présente dans l'environnement. */
  isConfigured(): boolean;
  /** Effectue le scraping. Lève ScrapeProviderError en cas d'échec (jamais un crash silencieux). */
  scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult>;
}
