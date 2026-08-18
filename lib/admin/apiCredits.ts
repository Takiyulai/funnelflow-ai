// lib/admin/apiCredits.ts
// 🆕 Onglet « Clés API » du dashboard admin — consommation et solde par clé.
//
// ⚠️ RÈGLE DE CONCEPTION : on n'invente JAMAIS un solde. Chaque fournisseur est
// classé selon ce qu'il expose RÉELLEMENT :
//
//   • balance  → le fournisseur publie un solde/quota vérifiable (OpenRouter,
//                Scrapingdog, ScrapingBee, Cloudinary). On l'affiche tel quel.
//   • counted  → le fournisseur publie ses envois mais pas son plafond
//                (Resend) : on compte les envois réels et on n'affiche de
//                jauge que si l'exploitant a renseigné le plafond de son
//                forfait. Libellé comme un comptage, pas comme une facturation.
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
/*  Resend — envoi d'emails                                            */
/* ------------------------------------------------------------------ */
//
// ── POURQUOI CETTE CARTE A CHANGÉ ───────────────────────────────────────────
// Elle comptait `scheduled_emails`, donc UNIQUEMENT les séquences. Or trois
// familles d'emails partent par la même clé Resend, et donc sur le même quota :
//   • séquences et workflows        → table scheduled_emails ;
//   • confirmations de rendez-vous  → lib/booking/emails.ts, envoi direct ;
//   • email de bienvenue            → lib/platform/emails.ts, envoi direct.
// Les deux dernières ne passent par aucune table d'envois : le chiffre affiché
// SOUS-ESTIMAIT donc la consommation réelle — exactement l'erreur à ne pas
// faire sur la ressource la plus contrainte de la plateforme.
//
// Resend expose bien la liste de ses envois (GET /emails). On compte donc
// depuis LA SOURCE, toutes familles confondues. Le comptage local reste en
// repli si l'endpoint est injoignable, et le dit alors clairement.
//
// ── SUR LE QUOTA ────────────────────────────────────────────────────────────
// Resend ne renvoie pas le forfait du compte. Afficher « 100/jour » d'office
// reviendrait à inventer un plafond — ce que ce fichier s'interdit. Le plafond
// est donc lu dans RESEND_DAILY_LIMIT / RESEND_MONTHLY_LIMIT si l'exploitant
// les renseigne ; sinon, on affiche les consommations sans jauge.

type ResendEmail = { id?: unknown; created_at?: unknown };

/**
 * Compte les envois Resend sur une fenêtre, en paginant.
 *
 * Déduplication par id : la sémantique exacte du curseur `after` n'est pas
 * garantie stable d'une version d'API à l'autre, et un curseur mal interprété
 * ferait recompter la même page. Un Set rend le double comptage impossible,
 * quoi que fasse la pagination.
 */
async function countResendSends(
  key: string,
  sinceMs: number,
): Promise<{ total: number; last24h: number; truncated: boolean; error?: string }> {
  const MAX_PAGES = 30; // 30 × 100 = 3 000, le plafond mensuel du forfait gratuit.
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const seen = new Set<string>();
  let last24h = 0;
  let cursor: string | null = null;
  let reachedWindowEdge = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `https://api.resend.com/emails?limit=100` +
      (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
    const res = await timedJson(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      return {
        total: seen.size,
        last24h,
        truncated: true,
        error: res.error ?? `HTTP ${res.status}`,
      };
    }

    const items = (res.json as { data?: unknown } | null)?.data;
    if (!Array.isArray(items) || items.length === 0) {
      reachedWindowEdge = true;
      break;
    }

    let added = 0;
    let oldestMs = Infinity;
    for (const raw of items as ResendEmail[]) {
      const id = typeof raw.id === "string" ? raw.id : null;
      const at =
        typeof raw.created_at === "string" ? new Date(raw.created_at).getTime() : NaN;
      if (!id || Number.isNaN(at)) continue;
      oldestMs = Math.min(oldestMs, at);
      if (at < sinceMs) continue; // hors fenêtre : ignoré, mais sert de borne d'arrêt
      if (seen.has(id)) continue;
      seen.add(id);
      added++;
      if (at >= dayAgo) last24h++;
    }

    // Sortie propre : soit la page déborde déjà de la fenêtre, soit la
    // pagination n'apporte plus rien (curseur qui n'avance pas).
    if (oldestMs < sinceMs || added === 0) {
      reachedWindowEdge = true;
      break;
    }

    const lastItem = items[items.length - 1] as ResendEmail;
    const next = typeof lastItem?.id === "string" ? lastItem.id : null;
    if (!next || next === cursor) {
      reachedWindowEdge = true;
      break;
    }
    cursor = next;
  }

  return { total: seen.size, last24h, truncated: !reachedWindowEdge };
}

async function readResend(sb: SupabaseClient): Promise<ApiKeyStatus> {
  const key = process.env.RESEND_API_KEY;
  const base: ApiKeyStatus = {
    id: "resend",
    label: "Resend (emails)",
    role: "Séquences, rendez-vous et emails de compte — tous sur la même clé",
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

  // Variable vide ou non numérique → aucun plafond, pas un plafond de 0
  // (`Number("")` vaut 0, ce qui afficherait une jauge saturée en permanence).
  const envLimit = (name: string): number | null => {
    const raw = process.env[name]?.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const dailyLimit = envLimit("RESEND_DAILY_LIMIT");
  const monthlyLimit = envLimit("RESEND_MONTHLY_LIMIT");
  const since = Date.now() - 30 * 24 * 3600 * 1000;

  const counted = await countResendSends(key, since);

  if (counted.error && counted.total === 0) {
    // Repli : le comptage local, en disant qu'il est PARTIEL. Un chiffre
    // présenté comme complet alors qu'il ignore les emails de rendez-vous
    // donnerait une fausse sécurité sur le quota.
    const { count, error } = await sb
      .from("scheduled_emails")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", new Date(since).toISOString());

    if (error) {
      return {
        ...base,
        sourceKind: "unknown",
        error: `${counted.error} — repli local en échec : ${error.message}`,
        note: "Ni l'API Resend ni le comptage local ne sont exploitables.",
      };
    }

    return {
      ...base,
      used: count ?? 0,
      total: monthlyLimit,
      remaining: monthlyLimit !== null ? monthlyLimit - (count ?? 0) : null,
      totalLabel: "Quota / mois",
      error: `API Resend injoignable : ${counted.error}`,
      note:
        "⚠️ Chiffre PARTIEL : comptage local sur 30 jours (scheduled_emails), qui " +
        "ignore les emails de rendez-vous et de bienvenue. La consommation réelle " +
        "est supérieure.",
    };
  }

  // Le forfait gratuit se heurte au plafond QUOTIDIEN bien avant le mensuel :
  // c'est donc lui qu'on met en avant dans la jauge.
  const used = counted.last24h;
  const suffix = counted.truncated ? " (au moins)" : "";

  const notes = [
    `Envois réels lus depuis Resend (GET /emails), toutes familles confondues : ` +
      `séquences, rendez-vous et emails de compte. ${counted.total}${suffix} sur 30 jours.`,
  ];
  if (!dailyLimit && !monthlyLimit) {
    notes.push(
      "Plafond non renseigné : Resend ne publie pas le forfait du compte. " +
        "Renseigner RESEND_DAILY_LIMIT (100 sur le forfait gratuit) et " +
        "RESEND_MONTHLY_LIMIT (3 000) pour activer la jauge.",
    );
  }
  if (monthlyLimit !== null && counted.total >= monthlyLimit * 0.8) {
    notes.push(
      `⚠️ ${counted.total} envois sur 30 jours pour un plafond mensuel de ${monthlyLimit}.`,
    );
  }
  if (counted.error) {
    // Panne survenue APRÈS avoir déjà compté des envois : on garde le chiffre
    // obtenu, mais il faut dire qu'il s'arrête là. Le présenter comme complet
    // masquerait une consommation supérieure.
    notes.push(`⚠️ Comptage interrompu (${counted.error}) : chiffres partiels.`);
  } else if (counted.truncated) {
    notes.push("Comptage arrêté à 3 000 envois : le total sur 30 jours est un minimum.");
  }

  return {
    ...base,
    used,
    total: dailyLimit,
    remaining: dailyLimit !== null ? dailyLimit - used : null,
    totalLabel: "Quota / jour",
    note: notes.join(" "),
  };
}

/* ------------------------------------------------------------------ */
/*  Cloudinary — hébergement des médias                                */
/* ------------------------------------------------------------------ */
//
// Ajouté après l'incident de saturation du stockage : les médias des tunnels
// clonés vivent ici depuis l'abandon de Supabase Storage, et rien dans
// l'application ne montrait ce qu'ils consomment. Un quota qui sature sans
// témoin, c'est précisément ce qui s'est déjà produit une fois.
//
// Cloudinary expose un vrai relevé : GET /v1_1/{cloud}/usage (auth Basic
// clé:secret). Le compteur qui compte est `credits` — un crédit ≈ 1 000
// transformations, ou 1 Go de stockage, ou 1 Go de bande passante. Le forfait
// gratuit en accorde 25 par mois.

async function readCloudinary(): Promise<ApiKeyStatus> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const base: ApiKeyStatus = {
    id: "cloudinary",
    label: "Cloudinary (médias)",
    role: "Images et vidéos des tunnels — hébergement et transformations",
    envKey: "CLOUDINARY_API_KEY",
    configured: Boolean(cloud && apiKey && apiSecret),
    keyPreview: maskKey(apiKey),
    sourceKind: "unknown",
    used: null,
    remaining: null,
    total: null,
    unit: "crédits",
    error: null,
    note: "",
  };

  if (!cloud || !apiKey || !apiSecret) {
    return {
      ...base,
      note:
        "Configuration incomplète (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, " +
        "CLOUDINARY_API_SECRET) — aucun média ne peut être hébergé.",
    };
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await timedJson(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    return {
      ...base,
      error: res.error ?? `HTTP ${res.status}`,
      note:
        res.status === 401
          ? "Cloudinary refuse les identifiants (401) — vérifier la paire clé/secret."
          : "Relevé Cloudinary injoignable (endpoint /usage).",
    };
  }

  const d = (res.json ?? {}) as Record<string, unknown>;
  const section = (name: string): Record<string, unknown> =>
    (d[name] as Record<string, unknown> | undefined) ?? {};

  const credits = section("credits");
  const used = num(credits.usage);
  const total = num(credits.limit);
  const storageBytes = num(section("storage").usage);
  const bandwidthBytes = num(section("bandwidth").usage);
  const transformations = num(section("transformations").usage);
  const plan = typeof d.plan === "string" ? d.plan : null;

  const mb = (bytes: number | null) =>
    bytes === null ? "?" : `${(bytes / 1024 / 1024).toFixed(0)} Mo`;

  const detail = [
    plan ? `Forfait ${plan}.` : null,
    `Stockage ${mb(storageBytes)}`,
    `bande passante ${mb(bandwidthBytes)}`,
    transformations !== null ? `${transformations.toLocaleString("fr-FR")} transformations` : null,
    num(d.resources) !== null ? `${num(d.resources)} fichiers` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ...base,
    sourceKind: used !== null || total !== null ? "balance" : "unknown",
    used,
    total,
    remaining: total !== null && used !== null ? total - used : null,
    totalLabel: "Crédits / mois",
    note:
      `Relevé réel Cloudinary (/usage). ${detail}. Un crédit ≈ 1 000 ` +
      "transformations, ou 1 Go stocké, ou 1 Go de bande passante. Le compteur " +
      "se réinitialise chaque mois, sauf le stockage, qui est cumulatif : c'est " +
      "lui qui finit par saturer si les médias des tunnels supprimés ne sont " +
      "jamais purgés.",
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
    readCloudinary(),
  ]);

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const fallbackIds = [
      "openrouter",
      "scrapingdog",
      "scrapingbee",
      "resend",
      "cloudinary",
    ];
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
