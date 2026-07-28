// lib/admin/apiCredits.ts
// 🆕 Onglet « Clés API » du dashboard admin — consommation et solde par clé.
//
// ⚠️ RÈGLE DE CONCEPTION : on n'invente JAMAIS un solde. Chaque fournisseur est
// classé selon ce qu'il expose RÉELLEMENT :
//
//   • balance  → le fournisseur publie un solde/quota vérifiable (OpenRouter,
//                Scrapingdog, ScrapingBee). On l'affiche tel quel.
//   • counted  → aucun endpoint de solde public (Resend). On mesure la
//                consommation DEPUIS NOS PROPRES DONNÉES (table
//                `scheduled_emails`) — c'est explicitement libellé comme un
//                comptage AutoFunnel, pas comme une facturation fournisseur.
//   • unknown  → clé absente, ou fournisseur interrogeable mais injoignable.
//
// Aucune clé n'est jamais renvoyée au client : uniquement un aperçu masqué
// (4 derniers caractères) pour permettre d'identifier la clé sans l'exposer.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Fiabilité de la donnée affichée — conditionne le libellé côté UI. */
export type CreditSourceKind = "balance" | "counted" | "unknown";

export type ApiKeyStatus = {
  /** Identifiant technique stable (clé de tri/rendu). */
  id: string;
  /** Nom affiché du fournisseur. */
  label: string;
  /** Rôle du fournisseur dans la plateforme. */
  role: string;
  /** Variable d'environnement qui porte la clé. */
  envKey: string;
  /** La clé est-elle présente côté serveur ? */
  configured: boolean;
  /** Aperçu masqué (ex. « ••••a1b2 »), jamais la clé complète. */
  keyPreview: string | null;
  sourceKind: CreditSourceKind;
  /** Crédits/unités consommés. `null` si inconnu. */
  used: number | null;
  /** Crédits/unités restants. `null` si le fournisseur n'expose pas de solde. */
  remaining: number | null;
  /** Total alloué. `null` si non plafonné ou inconnu. */
  total: number | null;
  /** 🆕 Libellé de la colonne « total ». Tous les fournisseurs n'ont pas la
   *  même sémantique : OpenRouter expose un CUMUL DE CRÉDITS ACHETÉS (prépayé,
   *  qui ne se réinitialise jamais), là où ScrapingBee expose un quota mensuel
   *  qui, lui, repart à zéro. Parler de « quota » dans les deux cas laisserait
   *  croire à une remise à zéro qui n'arrivera pas. */
  totalLabel?: string;
  /** Unité affichée (« crédits », « $ », « emails »…). */
  unit: string;
  /** Message d'erreur si l'interrogation a échoué. */
  error: string | null;
  /** Précision affichée sous la carte (source de la donnée). */
  note: string;
};

const FETCH_TIMEOUT_MS = 8_000;

/** Aperçu masqué d'une clé : jamais plus que les 4 derniers caractères. */
function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  const tail = key.slice(-4);
  return `••••${tail}`;
}

/** fetch avec délai maximal — un fournisseur lent ne doit pas figer la page. */
async function timedJson(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: unknown; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `Délai dépassé (${FETCH_TIMEOUT_MS / 1000}s)`
        : err instanceof Error
          ? err.message
          : "erreur inconnue";
    return { ok: false, status: 0, json: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* ------------------------------------------------------------------ */
/*  OpenRouter — fournisseur de génération IA                          */
/* ------------------------------------------------------------------ */
//
// ⚠️ Subtilité de ce projet : quand `AI_PROVIDER=openrouter`, la clé OpenRouter
// est stockée dans OPENAI_API_KEY (cf. lib/ai/generate.ts, qui se contente de
// changer le baseURL). On lit donc la même variable.
//
// OpenRouter expose GET /api/v1/credits → { data: { total_credits, total_usage } }
// (en dollars). C'est un vrai solde, contrairement à OpenAI.

function aiProviderIsOpenRouter(): boolean {
  const p = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  return p === "openrouter" || p === "open-router" || p === "or";
}

async function readOpenRouter(): Promise<ApiKeyStatus> {
  const isOR = aiProviderIsOpenRouter();
  const key = process.env.OPENAI_API_KEY;
  const base: ApiKeyStatus = {
    id: "openrouter",
    label: isOR ? "OpenRouter (génération IA)" : "OpenAI (génération IA)",
    role: "Génération des tunnels et du copywriting",
    envKey: "OPENAI_API_KEY",
    configured: Boolean(key),
    keyPreview: maskKey(key),
    sourceKind: "unknown",
    used: null,
    remaining: null,
    total: null,
    unit: "$",
    error: null,
    note: "",
  };

  if (!key) {
    return { ...base, note: "Clé absente — aucune génération IA possible." };
  }
  if (!isOR) {
    // OpenAI n'expose plus de solde public depuis la fermeture des endpoints
    // de facturation : on le dit franchement plutôt que d'afficher un chiffre.
    return {
      ...base,
      note: "OpenAI n'expose pas de solde via l'API — à consulter sur platform.openai.com.",
    };
  }

  const res = await timedJson("https://openrouter.ai/api/v1/credits", {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    return {
      ...base,
      error: res.error ?? `HTTP ${res.status}`,
      note: "Solde OpenRouter injoignable.",
    };
  }

  // Sémantique OpenRouter : `total_credits` = cumul des crédits ACHETÉS depuis
  // la création du compte (prépayé, jamais réinitialisé) ; `total_usage` =
  // cumul dépensé. Le solde est donc la différence — et il peut devenir
  // NÉGATIF : le coût exact d'une requête n'est connu qu'à la fin de la
  // réponse, si bien qu'un dernier appel peut franchir la ligne.
  const data = (res.json as { data?: Record<string, unknown> } | null)?.data ?? {};
  const total = num(data.total_credits);
  const used = num(data.total_usage);
  const remaining = total !== null && used !== null ? total - used : null;
  const depleted = remaining !== null && remaining <= 0;

  return {
    ...base,
    sourceKind: "balance",
    used,
    total,
    remaining,
    totalLabel: "Crédits achetés",
    note: depleted
      ? "⚠️ Solde épuisé. OpenRouter renvoie une erreur 402 sur TOUS les appels — " +
        "y compris les modèles gratuits — tant que le solde n'est pas repassé au-dessus de 0. " +
        "La génération de tunnels est donc à l'arrêt. Recharger sur openrouter.ai/credits."
      : "Solde réel renvoyé par OpenRouter (/api/v1/credits). Il s'agit d'un prépayé " +
        "cumulé, pas d'un quota mensuel : il ne se réinitialise pas.",
  };
}

/* ------------------------------------------------------------------ */
/*  Scrapingdog — scraping PRINCIPAL                                   */
/* ------------------------------------------------------------------ */

async function readScrapingdog(): Promise<ApiKeyStatus> {
  const key = process.env.SCRAPINGDOG_API_KEY;
  const base: ApiKeyStatus = {
    id: "scrapingdog",
    label: "Scrapingdog (scraping principal)",
    role: "Import/clonage de tunnels — fournisseur principal",
    envKey: "SCRAPINGDOG_API_KEY",
    configured: Boolean(key),
    keyPreview: maskKey(key),
    sourceKind: "unknown",
    used: null,
    remaining: null,
    total: null,
    unit: "crédits",
    error: null,
    note: "",
  };

  if (!key) return { ...base, note: "Clé absente — l'import bascule sur ScrapingBee." };

  const res = await timedJson(
    `https://api.scrapingdog.com/account?api_key=${encodeURIComponent(key)}`,
  );
  if (!res.ok) {
    return {
      ...base,
      error: res.error ?? `HTTP ${res.status}`,
      note: "Solde Scrapingdog injoignable (endpoint /account).",
    };
  }

  // Les noms de champs de Scrapingdog ont évolué selon les versions : on tente
  // les variantes connues plutôt que de supposer une seule forme.
  const d = (res.json ?? {}) as Record<string, unknown>;
  const used = num(d.requestUsed) ?? num(d.requests_used) ?? num(d.used);
  const total =
    num(d.requestLimit) ?? num(d.requests_limit) ?? num(d.limit) ?? num(d.pack_limit);
  return {
    ...base,
    sourceKind: used !== null || total !== null ? "balance" : "unknown",
    used,
    total,
    remaining: total !== null && used !== null ? total - used : null,
    note:
      used !== null || total !== null
        ? "Solde réel renvoyé par Scrapingdog (/account)."
        : "Réponse Scrapingdog reçue mais sans champ de quota reconnu.",
  };
}

/* ------------------------------------------------------------------ */
/*  ScrapingBee — scraping de REPLI                                    */
/* ------------------------------------------------------------------ */

async function readScrapingBee(): Promise<ApiKeyStatus> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  const base: ApiKeyStatus = {
    id: "scrapingbee",
    label: "ScrapingBee (scraping de repli)",
    role: "Import/clonage — repli, seul à extraire les CSS runtime",
    envKey: "SCRAPINGBEE_API_KEY",
    configured: Boolean(key),
    keyPreview: maskKey(key),
    sourceKind: "unknown",
    used: null,
    remaining: null,
    total: null,
    unit: "crédits",
    error: null,
    note: "",
  };

  if (!key) return { ...base, note: "Clé absente — aucun repli si Scrapingdog échoue." };

  const res = await timedJson(
    `https://app.scrapingbee.com/api/v1/usage?api_key=${encodeURIComponent(key)}`,
  );
  if (!res.ok) {
    return {
      ...base,
      error: res.error ?? `HTTP ${res.status}`,
      note: "Solde ScrapingBee injoignable (endpoint /usage).",
    };
  }

  const d = (res.json ?? {}) as Record<string, unknown>;
  const used = num(d.used_api_credit);
  const total = num(d.max_api_credit);
  return {
    ...base,
    sourceKind: "balance",
    used,
    total,
    remaining: total !== null && used !== null ? total - used : null,
    note: "Solde réel renvoyé par ScrapingBee (/usage).",
  };
}

// ScraperAPI a été retiré de la plateforme : seuls Scrapingdog (principal) et
// ScrapingBee (repli) sont utilisés pour le scraping. Le connecteur subsiste
// dans lib/scraping/providers/scraperapi.ts mais n'est plus dans la chaîne ni
// suivi ici.

/* ------------------------------------------------------------------ */
/*  Resend — envoi d'emails (COMPTAGE LOCAL)                           */
/* ------------------------------------------------------------------ */
//
// Resend ne publie aucun endpoint de quota : le plafond dépend du forfait et se
// consulte sur leur tableau de bord. On mesure donc la consommation depuis NOS
// données — la table `scheduled_emails`, qui porte déjà chaque envoi.
// C'est un comptage AutoFunnel, PAS une facturation Resend : l'UI le dit.

async function readResend(sb: SupabaseClient): Promise<ApiKeyStatus> {
  const key = process.env.RESEND_API_KEY;
  const base: ApiKeyStatus = {
    id: "resend",
    label: "Resend (emails)",
    role: "Séquences, workflows et emails de livraison",
    envKey: "RESEND_API_KEY",
    configured: Boolean(key),
    keyPreview: maskKey(key),
    sourceKind: "counted",
    used: null,
    remaining: null,
    total: null,
    unit: "emails",
    error: null,
    note: "",
  };

  if (!key) return { ...base, sourceKind: "unknown", note: "Clé absente — aucun email ne part." };

  // Emails réellement envoyés sur les 30 derniers jours.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { count, error } = await sb
    .from("scheduled_emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since);

  if (error) {
    return {
      ...base,
      sourceKind: "unknown",
      error: error.message,
      note: "Comptage local impossible (lecture de scheduled_emails en échec).",
    };
  }

  return {
    ...base,
    used: count ?? 0,
    note:
      "Comptage AutoFunnel sur 30 jours (table scheduled_emails). Resend n'expose " +
      "pas de quota par API — le plafond du forfait se vérifie sur resend.com.",
  };
}

/* ------------------------------------------------------------------ */
/*  Agrégat                                                            */
/* ------------------------------------------------------------------ */

/**
 * Interroge tous les fournisseurs EN PARALLÈLE. Un fournisseur en échec ne
 * bloque jamais les autres : son erreur est portée par sa propre carte.
 */
export async function getApiKeyStatuses(sb: SupabaseClient): Promise<ApiKeyStatus[]> {
  const results = await Promise.allSettled([
    readOpenRouter(),
    readScrapingdog(),
    readScrapingBee(),
    readResend(sb),
  ]);

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const fallbackIds = ["openrouter", "scrapingdog", "scrapingbee", "resend"];
    return {
      id: fallbackIds[i] ?? `provider-${i}`,
      label: fallbackIds[i] ?? "Fournisseur",
      role: "",
      envKey: "",
      configured: false,
      keyPreview: null,
      sourceKind: "unknown" as const,
      used: null,
      remaining: null,
      total: null,
      unit: "",
      error: r.reason instanceof Error ? r.reason.message : "erreur inconnue",
      note: "Interrogation du fournisseur en échec.",
    };
  });
}
