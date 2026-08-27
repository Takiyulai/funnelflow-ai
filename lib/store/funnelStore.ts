// lib/store/funnelStore.ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { Funnel, FunnelBrief, FunnelPage } from "@/lib/funnels/types";
import { FUNNEL_SCHEMA_VERSION, makePageId } from "@/lib/funnels/types";
import { migrateAllSections } from "@/lib/funnels/sectionItems";
import { normalizeFunnelKind } from "@/lib/funnels/kinds";
import {
  externalizeMediasSync,
  hasIdbRefs,
  resolveMedias,
} from "./mediaStore";
// 🆕 SUPABASE — couche d'accès distant
import {
  saveRemote,
  loadRemote,
  listRemote,
  deleteRemote as deleteRemoteFn,
  publishRemote,
  getCurrentUserId,
  type RemoteFunnelSummary,
} from "./funnelRepository";
import { normalizeFunnel } from "./normalizeFunnel";
import { compressToUTF16, decompressFromUTF16 } from "lz-string";


// ─────────────────────────────────────────────────────────────────────────────
// Compression du cache localStorage
// ─────────────────────────────────────────────────────────────────────────────
//
// 🆕 Les tunnels CLONÉS embarquent du HTML brut volumineux. En clair, quelques
// tunnels saturaient le quota localStorage (~5 Mo) → `safeSetItem` purgeait les
// AUTRES tunnels → ils disparaissaient du dashboard (puis réapparaissaient via
// l'hydratation Supabase = effet « clignotant »). On compresse donc le JSON des
// tunnels (lz-string, synchrone) : le HTML se compresse ~6-10×, ce qui multiplie
// la capacité effective et supprime quasiment les purges destructives.
//
// Rétro-compatibilité : les entrées NON compressées (legacy) restent lisibles
// (on ne décompresse que les valeurs préfixées par LZ_PREFIX).

const LZ_PREFIX = "LZ1:";

function serializeStored(stored: StoredFunnel): string {
  try {
    return LZ_PREFIX + compressToUTF16(JSON.stringify(stored));
  } catch {
    // Compression impossible : on retombe sur le JSON brut (toujours lisible).
    return JSON.stringify(stored);
  }
}

function deserializeStored(raw: string): StoredFunnel {
  if (raw.startsWith(LZ_PREFIX)) {
    const json = decompressFromUTF16(raw.slice(LZ_PREFIX.length)) || "";
    return JSON.parse(json) as StoredFunnel;
  }
  // Entrée legacy (JSON brut, écrite avant la compression).
  return JSON.parse(raw) as StoredFunnel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StoredFunnel = {
  id: string;
  slug: string;
  funnel: Funnel;
  brief: FunnelBrief;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  /** Slug public réellement attribué à la publication (peut différer du slug
   *  brouillon si celui-ci était déjà pris globalement). Sert au lien Aperçu. */
  publishedSlug?: string;
};

const STORAGE_PREFIX = "ff:funnel:";
const PUBLISHED_PREFIX = "ff:public:";
const INDEX_KEY = "ff:funnel-index";
// 🆕 Tombstones : ids de tunnels supprimés localement dont la suppression
// distante n'est peut-être pas (encore) confirmée. Empêche l'hydratation
// Supabase de les faire « réapparaître » dans le dashboard.
const DELETED_KEY = "ff:funnel-deleted";

// 🆕 Propriétaire du cache local : id de l'utilisateur à qui appartiennent les
// tunnels en localStorage. Sur le MÊME navigateur, deux comptes différents
// partageraient sinon le même cache → un utilisateur verrait les tunnels d'un
// autre. On purge le cache dès que le propriétaire change (cf. useFunnelList).
const CACHE_OWNER_KEY = "ff:funnel-cache-owner";

function getCacheOwner(): string | null {
  try {
    return window.localStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

function setCacheOwner(userId: string): void {
  try {
    window.localStorage.setItem(CACHE_OWNER_KEY, userId);
  } catch {
    /* non bloquant */
  }
}

/**
 * Purge TOUT le cache local des tunnels (index, entrées, snapshots publics,
 * tombstones). Appelé au changement de compte et à la déconnexion pour éviter
 * toute fuite de données entre utilisateurs sur un même navigateur.
 */
export function clearFunnelCache(): void {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (
        k === INDEX_KEY ||
        k === DELETED_KEY ||
        k.startsWith(STORAGE_PREFIX) ||
        k.startsWith(PUBLISHED_PREFIX)
      ) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* non bloquant */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Erreur typée pour quota localStorage
// ─────────────────────────────────────────────────────────────────────────────

export class FunnelStorageQuotaError extends Error {
  constructor(message = "Le stockage du navigateur est plein") {
    super(message);
    this.name = "FunnelStorageQuotaError";
  }
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    const legacyCode = (err as DOMException & { code?: number }).code;
    return (
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      legacyCode === 22 ||
      legacyCode === 1014
    );
  }
  return /quota|exceeded the quota/i.test(err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event bus
// ─────────────────────────────────────────────────────────────────────────────

const bus = typeof window !== "undefined" ? new EventTarget() : null;

function emitChange(id?: string) {
  if (!bus) return;
  bus.dispatchEvent(new CustomEvent("ff:funnel-changed", { detail: { id } }));
}

function subscribe(handler: () => void): () => void {
  if (!bus) return () => {};
  const wrapped = () => handler();
  bus.addEventListener("ff:funnel-changed", wrapped);
  const onStorage = (e: StorageEvent) => {
    if (e.key && (e.key.startsWith(STORAGE_PREFIX) || e.key === INDEX_KEY)) {
      handler();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    bus.removeEventListener("ff:funnel-changed", wrapped);
    window.removeEventListener("storage", onStorage);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug helper
// ─────────────────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// \ud83c\udd95 Mots vides (FR/EN/ES) + jargon de tunnel \u00e0 EXCLURE du slug public : le
// slug appara\u00eet dans l'URL vue par le prospect (autofunnel.app/tunnel/<slug>),
// il doit \u00eatre court et orient\u00e9 b\u00e9n\u00e9fice, jamais donner l'impression d'une
// \u00ab page de capture / de vente \u00bb.
const SLUG_STOPWORDS = new Set([
  // articles / pr\u00e9positions / liaisons FR
  "le","la","les","un","une","des","du","de","d","l","et","ou","a","au","aux","en","dans","pour","par","sur","avec","sans","vos","votre","ton","ta","tes","mon","ma","mes","ce","cette","ces",
  // EN
  "the","a","an","of","for","to","in","on","with","your","my","and","or",
  // ES
  "el","los","las","una","unos","unas","y","o","para","por","con","tu","tus","su","sus",
  // jargon tunnel \u00e0 \u00e9viter dans l'URL publique. NB : \u00ab webinaire \u00bb/\u00ab inscription \u00bb
  // sont VOLONTAIREMENT gard\u00e9s (mots d'entr\u00e9e utiles, orient\u00e9s prospect) ; on
  // bannit en revanche \u00ab vente \u00bb, \u00ab remerciement/merci \u00bb et \u00ab page \u00bb.
  "tunnel","funnel","page","landing","capture","vente","sales","remerciement","merci","offre","offer","checkout","commande","paiement","gratuit","free",
]);

/** \ud83c\udd95 Mot-cl\u00e9 d'entr\u00e9e selon le TYPE de tunnel, pr\u00e9fix\u00e9 au slug pour qu'il soit
 *  complet et parlant (ex : webinaire \u2192 \u00ab webinaire-\u2026 \u00bb, lead-magnet \u2192
 *  \u00ab inscription-\u2026 \u00bb). Vide si le type ne s'y pr\u00eate pas. */
function kindSlugKeyword(kind?: string): string {
  switch (kind) {
    case "webinar":
      return "webinaire";
    case "lead-magnet":
      return "inscription";
    case "booking":
    case "coaching-high-ticket":
      return "reservation";
    case "challenge":
      return "challenge";
    default:
      return "";
  }
}

/**
 * \ud83c\udd95 Slug public CONCIS et orient\u00e9 b\u00e9n\u00e9fice (1 \u00e0 3 mots). On part de la promesse
 * / du nom d'offre plut\u00f4t que du nom complet du tunnel (souvent \u00ab Marque \u2014 Offre
 * \u2026 \u00bb), on retire les mots vides et le jargon de tunnel, et on garde au plus
 * 3 mots signifiants. Ex : \u00ab Webinaire : g\u00e9n\u00e9rer des revenus en ligne \u00bb \u2192
 * \u00ab generer-revenus-ligne \u00bb.
 */
function conciseSlug(...candidates: (string | undefined)[]): string {
  for (const raw of candidates) {
    if (!raw) continue;
    const words = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length > 1 && !SLUG_STOPWORDS.has(w));
    const picked = words.slice(0, 3).join("-").slice(0, 32).replace(/-+$/g, "");
    if (picked.length >= 3) return picked;
  }
  return "";
}

function uniqueSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base;
  let i = 2;
  while (existingSlugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Index
// ─────────────────────────────────────────────────────────────────────────────

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {
    // Silent : l'index sera reconstruit au prochain load si nécessaire
  }
}

// ─── Tombstones (suppressions) ───────────────────────────────────────────────

function readDeleted(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function isDeleted(id: string): boolean {
  return readDeleted().includes(id);
}

function addDeleted(id: string): void {
  if (typeof window === "undefined") return;
  const set = new Set(readDeleted());
  set.add(id);
  try {
    window.localStorage.setItem(DELETED_KEY, JSON.stringify([...set]));
  } catch {
    /* quota : non bloquant */
  }
}

function clearDeleted(id: string): void {
  if (typeof window === "undefined") return;
  const next = readDeleted().filter((x) => x !== id);
  try {
    window.localStorage.setItem(DELETED_KEY, JSON.stringify(next));
  } catch {
    /* non bloquant */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quota helpers
// ─────────────────────────────────────────────────────────────────────────────

function getStoredFunnelsMeta(): Array<{
  id: string;
  updatedAt: string;
  size: number;
}> {
  if (typeof window === "undefined") return [];
  const ids = readIndex();
  const out: Array<{ id: string; updatedAt: string; size: number }> = [];
  for (const id of ids) {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
      if (!raw) continue;
      const parsed = deserializeStored(raw) as Partial<StoredFunnel>;
      out.push({
        id,
        updatedAt: parsed.updatedAt ?? "",
        size: raw.length, // taille STOCKÉE (compressée) → pertinente pour le quota
      });
    } catch {
      out.push({ id, updatedAt: "", size: 0 });
    }
  }
  return out;
}

function safeSetItem(key: string, value: string, protectedId?: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
    return;
  } catch (err) {
    if (!isQuotaError(err)) throw err;

    console.warn(
      "[funnelStore] Quota localStorage dépassé, purge des anciens tunnels...",
    );

    const others = getStoredFunnelsMeta()
      .filter((m) => m.id !== protectedId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

    for (const meta of others) {
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + meta.id);
        window.localStorage.removeItem(PUBLISHED_PREFIX + meta.id);
        const remainingIds = readIndex().filter((x) => x !== meta.id);
        writeIndex(remainingIds);
        console.warn(`[funnelStore] Tunnel ancien supprimé : ${meta.id}`);
      } catch {
        // ignore
      }

      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (retryErr) {
        if (!isQuotaError(retryErr)) throw retryErr;
      }
    }

    throw new FunnelStorageQuotaError(
      "Le stockage du navigateur est plein et la purge des anciens tunnels n'a pas suffi. Videz le cache du site (ou supprimez manuellement des tunnels) puis réessayez.",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 SUPABASE — Sync distante (source de vérité = Supabase, local = cache)
// ─────────────────────────────────────────────────────────────────────────────

const remoteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const REMOTE_DEBOUNCE_MS = 1200;

/**
 * Pousse un funnel vers Supabase en arrière-plan (debounce par id).
 * N'émet AUCUN changement local → ne déclenche pas de re-render →
 * ne casse pas l'anti-boucle d'auto-save. Best-effort : si offline ou
 * déconnecté, le cache local conserve la donnée jusqu'au prochain save.
 */
function scheduleRemoteSave(stored: StoredFunnel): void {
  if (typeof window === "undefined") return;
  // 🆕 Anti-résurrection : un tunnel SUPPRIMÉ (tombstone) ne doit JAMAIS être
  // ré-poussé vers Supabase — sinon un onglet éditeur resté ouvert (autosave)
  // le recrée côté distant et il réapparaît dans le dashboard.
  if (isDeleted(stored.id)) return;
  const existing = remoteSaveTimers.get(stored.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    remoteSaveTimers.delete(stored.id);
    // 🆕 Sauvegarde distante FIABILISÉE : 3 tentatives (backoff court). En cas
    // d'échec PERSISTANT, on PRÉVIENT l'éditeur via un événement `ff:remote-save`
    // {ok:false}. Auparavant l'échec était SILENCIEUX (console.warn) : l'éditeur
    // affichait quand même « Enregistré ✓ » alors que le tunnel restait LOCAL
    // (jamais dans Supabase) → 404 à la publication / à l'ouverture du slug.
    void (async () => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const saved = await saveRemote(stored);
          if (saved?.slug && saved.slug !== stored.slug) {
            reconcileLocalSlug(stored.id, saved.slug);
          }
          window.dispatchEvent(
            new CustomEvent("ff:remote-save", {
              detail: { id: stored.id, ok: true },
            }),
          );
          return;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      console.warn(
        "[funnelStore] saveRemote échoué après 3 tentatives (cache local conservé):",
        lastErr,
      );
      window.dispatchEvent(
        new CustomEvent("ff:remote-save", {
          detail: {
            id: stored.id,
            ok: false,
            error: lastErr instanceof Error ? lastErr.message : String(lastErr),
          },
        }),
      );
    })();
  }, REMOTE_DEBOUNCE_MS);
  remoteSaveTimers.set(stored.id, timer);
}

/** Met à jour le slug local d'un tunnel (après résolution de collision distante). */
function reconcileLocalSlug(id: string, newSlug: string): void {
  if (typeof window === "undefined") return;
  const stored = loadFunnel(id);
  if (!stored || stored.slug === newSlug) return;
  const updated: StoredFunnel = { ...stored, slug: newSlug };
  safeSetItem(STORAGE_PREFIX + id, serializeStored(updated), id);
  emitChange(id);
}

/**
 * Écrit une version distante dans le cache local SANS émettre de changement
 * (évite la boucle). Utilisé par l'hydratation au load.
 */
function hydrateLocalFromRemote(remote: StoredFunnel): void {
  if (typeof window === "undefined") return;
  // 🆕 Ne PAS ressusciter un tunnel supprimé localement (tombstone) tant que
  // sa suppression distante n'est pas confirmée.
  if (isDeleted(remote.id)) return;

  // 🆕 PROTECTION ANTI-PERTE D'ÉDITIONS : si la version LOCALE est plus récente
  // que la distante (ex. l'utilisateur vient d'ajouter une section mais
  // l'autosave distant est en retard ou avait échoué), on NE l'écrase PAS.
  // On garde le local ET on pousse le local vers Supabase pour qu'il rattrape.
  const localRaw = window.localStorage.getItem(STORAGE_PREFIX + remote.id);
  if (localRaw) {
    try {
      const local = deserializeStored(localRaw);
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      if (localTime > remoteTime) {
        const ids = readIndex();
        if (!ids.includes(remote.id)) writeIndex([remote.id, ...ids]);
        scheduleRemoteSave(local); // le distant rattrape le local plus récent
        return;
      }
    } catch {
      // JSON local illisible : on laissera le distant écraser ci-dessous
    }
  }

  try {
    // 🆕 FIX « tunnels disparus du dashboard » : l'hydratation est un simple
    // REMPLISSAGE DE CACHE, pas une sauvegarde utilisateur → on n'utilise PAS
    // safeSetItem. safeSetItem, en cas de quota plein, PURGE les AUTRES tunnels
    // (et les retire de l'index d'affichage) pour faire de la place : hydrater
    // N tunnels distants trop lourds évinçait donc les précédents un par un,
    // et la liste du dashboard se vidait. Ici : si ça ne rentre pas, on ignore
    // — Supabase reste la source de vérité et l'affichage de la liste passe
    // par la fusion distant+local dans useFunnelList (plus par le seul cache).
    window.localStorage.setItem(STORAGE_PREFIX + remote.id, serializeStored(remote));
    const ids = readIndex();
    if (!ids.includes(remote.id)) writeIndex([remote.id, ...ids]);
  } catch {
    // quota : pas grave, Supabase reste la source de vérité
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Migration multi-pages
// ─────────────────────────────────────────────────────────────────────────────

function migrateFunnelToMultiPage(funnel: Funnel): Funnel {
  if (funnel.pages && funnel.pages.length > 0) {
    return funnel;
  }

  const legacySections = funnel.sections ?? [];

  const homePage: FunnelPage = {
    id: makePageId(),
    slug: "/",
    name: "Accueil",
    role: "landing",
    sections: legacySections,
    visible: true,
    isHome: true,
    seo: {
      title: funnel.seo?.title,
      description: funnel.seo?.description,
    },
    meta: {
      createdAt: new Date().toISOString(),
    },
  };

  return {
    ...funnel,
    pages: [homePage],
    sections: legacySections,
    meta: {
      ...(funnel.meta ?? {}),
      schemaVersion: FUNNEL_SCHEMA_VERSION,
    },
  };
}

function syncLegacySections(funnel: Funnel): Funnel {
  if (!funnel.pages || funnel.pages.length === 0) return funnel;
  const home = funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
  if (!home) return funnel;
  return { ...funnel, sections: home.sections };
}

function normalizeLegacyKind(funnel: Funnel): Funnel {
  if (!funnel.meta?.funnelKind) return funnel;
  const normalized = normalizeFunnelKind(funnel.meta.funnelKind);
  if (normalized === funnel.meta.funnelKind) return funnel;
  return {
    ...funnel,
    meta: { ...funnel.meta, funnelKind: normalized },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration globale (chaînée)
// ─────────────────────────────────────────────────────────────────────────────

function applyMigrations(stored: StoredFunnel): StoredFunnel {
  if (!stored.funnel) return stored;

  let funnel = stored.funnel;

  if (Array.isArray(funnel.sections)) {
    const migratedSections = migrateAllSections(funnel.sections);
    const hasChanged = migratedSections.some(
      (s, i) => s !== funnel.sections![i],
    );
    if (hasChanged) {
      funnel = { ...funnel, sections: migratedSections };
    }
  }

  const beforePages = funnel.pages;
  funnel = migrateFunnelToMultiPage(funnel);
  const wasMigratedToMultiPage = beforePages !== funnel.pages;

  funnel = normalizeLegacyKind(funnel);
  funnel = syncLegacySections(funnel);
  funnel = normalizeFunnel(funnel);
  if (funnel === stored.funnel) return stored;

  const migrated = { ...stored, funnel };

  if (wasMigratedToMultiPage && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + stored.id,
        serializeStored(migrated),
      );
    } catch {
      // Ignore les erreurs de stockage (quota, etc.) — pas critique ici
    }
  }

  return migrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Charge un tunnel depuis le localStorage.
 * NB : les médias référencés via `idb-media://` ne sont PAS résolus ici
 * (lecture synchrone). Pour récupérer les images, utiliser `loadFunnelWithMedia`.
 */
export function loadFunnel(id: string): StoredFunnel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const parsed = deserializeStored(raw);
    return applyMigrations(parsed);
  } catch {
    return null;
  }
}

/**
 * Version async qui résout en plus les références idb-media:// → data:image/...
 * À utiliser pour l'aperçu / éditeur visuel.
 */
export async function loadFunnelWithMedia(
  id: string,
): Promise<StoredFunnel | null> {
  const stored = loadFunnel(id);
  if (!stored) return null;
  if (hasIdbRefs(stored.funnel)) {
    try {
      await resolveMedias(stored.funnel);
    } catch (e) {
      console.warn("[funnelStore] resolveMedias a échoué:", e);
    }
  }
  return stored;
}

export function loadFunnelBySlug(slug: string): StoredFunnel | null {
  if (typeof window === "undefined") return null;
  for (const id of readIndex()) {
    const f = loadFunnel(id);
    if (f && f.slug === slug) return f;
  }
  return null;
}

export function listFunnels(): StoredFunnel[] {
  if (typeof window === "undefined") return [];
  const ids = readIndex();
  // 🆕 Filet de sécurité : ne jamais afficher un tunnel supprimé (tombstone),
  // même si une écriture tardive l'avait laissé dans l'index local.
  const deleted = new Set(readDeleted());
  const items: StoredFunnel[] = [];
  for (const id of ids) {
    if (deleted.has(id)) continue;
    const f = loadFunnel(id);
    if (f) items.push(f);
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 🆕 Purge les snapshots `ff:public:` hérités du localStorage. Ils étaient
 * énormes (full funnel + base64), jamais nettoyés et inutiles (la page publique
 * lit Supabase). Leur accumulation saturait le quota et provoquait des purges
 * destructives (brouillons supprimés → tunnels qui disparaissent/réapparaissent).
 * Idempotent : ne fait rien s'il n'y en a plus.
 */
export function purgeLegacyPublicSnapshots(): number {
  if (typeof window === "undefined") return 0;
  let freed = 0;
  for (const k of Object.keys(window.localStorage)) {
    if (k.startsWith(PUBLISHED_PREFIX)) {
      try {
        window.localStorage.removeItem(k);
        freed++;
      } catch {
        /* ignore */
      }
    }
  }
  return freed;
}

/**
 * Sauvegarde un tunnel.
 * Avant écriture, externalise tous les data:image/...;base64,... vers IndexedDB
 * et les remplace dans le payload par des références `idb-media://{id}`,
 * ce qui ramène le poids du JSON localStorage de ~15 Mo à quelques Ko.
 */
export function saveFunnel(stored: StoredFunnel): void {
  if (typeof window === "undefined") return;

  // 🆕 Anti-résurrection : ne JAMAIS ré-écrire (ni ré-indexer) un tunnel
  // supprimé. Sans ce garde-fou, un onglet éditeur resté ouvert sur un tunnel
  // qu'on vient de supprimer le recrée via son autosave (local + distant).
  if (isDeleted(stored.id)) return;

  // 1) Cloner profondément pour ne pas muter l'objet d'origine en mémoire
  let clonedFunnel: Funnel;
  try {
    clonedFunnel = JSON.parse(JSON.stringify(stored.funnel)) as Funnel;
  } catch {
    clonedFunnel = stored.funnel;
  }

  // 2) Externaliser les data-URLs lourdes vers IndexedDB (best-effort sync)
  //    Les promesses sont déclenchées en arrière-plan ; le clone est muté
  //    immédiatement avec les références `idb-media://` à la place des base64.
  try {
    externalizeMediasSync(clonedFunnel);
  } catch (e) {
    console.warn("[funnelStore] externalizeMediasSync a échoué:", e);
  }

  const synced: StoredFunnel = {
    ...stored,
    funnel: syncLegacySections(clonedFunnel),
    updatedAt: new Date().toISOString(),
  };

  // 3) Écriture sécurisée avec purge automatique en cas de quota dépassé
  safeSetItem(STORAGE_PREFIX + stored.id, serializeStored(synced), stored.id);

  const ids = readIndex();
  const isNew = !ids.includes(stored.id);
  if (isNew) {
    ids.unshift(stored.id);
    writeIndex(ids);
  }

  // 🆕 SUPABASE — push distant en arrière-plan (debounce). N'affecte PAS
  // emitChange, donc pas de re-render → pas de boucle. Le funnel envoyé est
  // `synced` ; funnelRepository externalise les médias idb-media:// /data: vers
  // Supabase Storage avant écriture (le JSON distant ne contient que des URLs).
  scheduleRemoteSave(synced);

  // 🔑 N'émet de changement QUE pour un nouveau tunnel (apparition dans la
  // liste). Pour une simple mise à jour, on évite la notification qui ferait
  // re-déclencher useFunnel → loadFunnel → setStored → re-render → auto-save
  // → boucle infinie.
  if (isNew) {
    emitChange(stored.id);
  }
}

export function deleteFunnel(id: string): void {
  if (typeof window === "undefined") return;
  const stored = loadFunnel(id);
  window.localStorage.removeItem(STORAGE_PREFIX + id);
  if (stored?.slug) {
    window.localStorage.removeItem(PUBLISHED_PREFIX + stored.slug);
  }
  const ids = readIndex().filter((x) => x !== id);
  writeIndex(ids);
  // 🆕 Tombstone : empêche la réapparition par hydratation tant que la
  // suppression distante n'est pas confirmée.
  addDeleted(id);
  emitChange(id);

  // 🆕 SUPABASE — miroir distant. Si OK → on retire le tombstone (ménage fait).
  // Si échec (souvent RLS) → on GARDE le tombstone (reste masqué) et on logge
  // la cause précise (code PostgREST) pour diagnostic.
  deleteRemoteFn(id)
    .then(() => clearDeleted(id))
    .catch((e) =>
      console.warn(
        "[funnelStore] deleteRemote échoué (tunnel masqué localement) :",
        e instanceof Error ? e.message : e,
      ),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Création depuis une génération IA
// ─────────────────────────────────────────────────────────────────────────────

export function createFunnelFromAi(
  funnel: Funnel,
  brief: FunnelBrief,
): StoredFunnel {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 🆕 Slug public = UN SEUL mot, le plus important (demande utilisateur) :
  //  1) le mot-clé de TYPE quand il existe (webinar→« webinaire », lead-magnet
  //     →« inscription », booking→« reservation », challenge→« challenge ») ;
  //  2) sinon le 1er mot signifiant du sujet (offre/promesse/marque) ;
  //  3) sinon le 1er mot signifiant du nom du tunnel ; 4) repli « tunnel ».
  // Ex : un webinaire → « autofunnelai.cloud/tunnel/webinaire ». Les collisions
  // (2 webinaires) sont gérées par uniqueSlug (« webinaire », « webinaire-2 »…).
  const kindWord = kindSlugKeyword(brief.funnelKind);
  const topicWord = conciseSlug(brief.offerName, brief.promise, brief.brandName)
    .split("-")
    .filter(Boolean)[0];
  const nameWord = slugify(
    funnel.funnelName || `${brief.brandName ?? ""} ${brief.offerName ?? ""}`,
  )
    .split("-")
    .filter((w) => w.length > 1 && !SLUG_STOPWORDS.has(w))[0];
  const baseSlug = kindWord || topicWord || nameWord || "tunnel";
  const existingSlugs = new Set(listFunnels().map((f) => f.slug));
  const slug = uniqueSlug(baseSlug, existingSlugs);

  // 🆕 Auto-tag : on pose un tag de capture par défaut (nom de l'offre) sur les
  // formulaires, pour que les leads soumis soient taggés automatiquement.
  const captureTag = (brief.offerName || brief.brandName || "").trim();
  if (captureTag) {
    const tagForms = (secs?: Funnel["sections"]) => {
      secs?.forEach((s) => {
        if (s.type !== "form") return;
        const existing = s.formConfig?.captureTags;
        s.formConfig = {
          provider: s.formConfig?.provider ?? "internal",
          ...s.formConfig,
          captureTags: existing && existing.length ? existing : [captureTag],
        };
      });
    };
    tagForms(funnel.sections);
    funnel.pages?.forEach((p) => tagForms(p.sections));
  }

  const now = new Date().toISOString();
  const stored: StoredFunnel = {
    id,
    slug,
    funnel,
    brief,
    createdAt: now,
    updatedAt: now,
  };

  const migrated = applyMigrations(stored);
  saveFunnel(migrated);
  return migrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Helpers de manipulation des pages
// ─────────────────────────────────────────────────────────────────────────────

export function updatePageSections(
  funnel: Funnel,
  pageId: string,
  sections: Funnel["sections"],
): Funnel {
  if (!funnel.pages) return funnel;
  const pages = funnel.pages.map((p) =>
    p.id === pageId ? { ...p, sections: sections ?? [] } : p,
  );
  return syncLegacySections({ ...funnel, pages });
}

export function addPage(
  funnel: Funnel,
  page: Omit<FunnelPage, "id">,
  position?: number,
): Funnel {
  const newPage: FunnelPage = { ...page, id: makePageId() };
  const pages = [...(funnel.pages ?? [])];
  if (typeof position === "number") {
    pages.splice(position, 0, newPage);
  } else {
    pages.push(newPage);
  }
  return { ...funnel, pages };
}

export function removePage(funnel: Funnel, pageId: string): Funnel {
  if (!funnel.pages || funnel.pages.length <= 1) return funnel;
  const target = funnel.pages.find((p) => p.id === pageId);
  if (!target || target.isHome) return funnel;
  const pages = funnel.pages.filter((p) => p.id !== pageId);
  return syncLegacySections({ ...funnel, pages });
}

export function reorderPages(funnel: Funnel, orderedIds: string[]): Funnel {
  if (!funnel.pages) return funnel;
  const byId = new Map(funnel.pages.map((p) => [p.id, p]));
  const reordered = orderedIds
    .map((id) => byId.get(id))
    .filter((p): p is FunnelPage => Boolean(p));
  const missing = funnel.pages.filter((p) => !orderedIds.includes(p.id));
  return syncLegacySections({ ...funnel, pages: [...reordered, ...missing] });
}

// ─────────────────────────────────────────────────────────────────────────────
// Publication
// ─────────────────────────────────────────────────────────────────────────────

export type PublishResult = {
  /** Tunnel local mis à jour (publishedAt posé) — null si introuvable. */
  stored: StoredFunnel | null;
  /** true si le snapshot a bien été figé dans Supabase (sinon 404 en ligne). */
  remoteOk: boolean;
  /** Slug public réel attribué par Supabase (peut différer du slug brouillon). */
  publishedSlug?: string;
  /** Message d'erreur distant à afficher si remoteOk = false. */
  error?: string;
};

/**
 * Publie un tunnel. L'écriture LOCALE est immédiate ; l'écriture DISTANTE
 * (Supabase) est désormais AWAITÉE et son résultat remonté, pour ne plus
 * afficher un faux « publié ✓ » alors que la page publique renverrait un 404.
 */
export async function publishFunnel(id: string): Promise<PublishResult> {
  const stored = loadFunnel(id);
  if (!stored || typeof window === "undefined") {
    return { stored: null, remoteOk: false, error: "Tunnel introuvable." };
  }

  const updated: StoredFunnel = {
    ...stored,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ✅ Écriture locale du brouillon (UX instantanée). On N'écrit PLUS de
  // snapshot `ff:public:` en localStorage : il était énorme (full funnel +
  // base64), jamais nettoyé, et inutile (la page publique lit Supabase). Ces
  // snapshots saturaient le quota → purges destructives → tunnels qui
  // disparaissent/réapparaissent dans le dashboard.
  safeSetItem(STORAGE_PREFIX + id, serializeStored(updated), id);
  emitChange(id);

  // 🆕 SUPABASE — publication distante séquentielle : on pousse d'abord le
  // draft à jour (json_content + médias), PUIS on fige le snapshot publié.
  // Toute erreur (session, RLS, colonne manquante) est REMONTÉE à l'appelant.
  try {
    const saved = await saveRemote(updated);
    // 🆕 Si une collision de slug a été résolue côté distant, on aligne le local
    // AVANT de figer le snapshot publié (sinon slug local ≠ slug distant).
    if (saved?.slug && saved.slug !== updated.slug) {
      reconcileLocalSlug(id, saved.slug);
    }
    // 🆕 Publication distante avec 1 NOUVELLE TENTATIVE : le plan gratuit Supabase
    // fait des « cold starts » (~15s) qui provoquent des erreurs réseau
    // transitoires → la publication ne « prenait » pas (published_content restait
    // figé sur l'ancien instantané) sans raison persistante. On réessaie une fois
    // après une courte pause avant de considérer l'échec.
    let published = await publishRemote(id).catch((e) => {
      console.warn("[funnelStore] publishRemote tentative 1 échouée:", e);
      return null as Awaited<ReturnType<typeof publishRemote>>;
    });
    if (!published) {
      await new Promise((r) => setTimeout(r, 1200));
      published = await publishRemote(id);
    }

    // 🆕 FIX 404 « faux publié » : publishRemote renvoie NULL quand l'UPDATE
    // Supabase n'a touché aucune ligne (session expirée, RLS, id absent). On
    // remontait quand même remoteOk:true → l'utilisateur voyait « Publié ✓ »
    // alors que status restait 'draft' et published_content NULL → la page
    // /tunnel/<slug> renvoyait 404. On traite désormais ce cas comme un ÉCHEC
    // explicite pour ne plus jamais mentir sur l'état de publication.
    if (!published) {
      return {
        stored: updated,
        remoteOk: false,
        error:
          "Le serveur n'a pas confirmé la publication (aucune ligne mise à jour). " +
          "Ta session a peut-être expiré : recharge la page, reconnecte-toi si besoin, puis réessaie.",
      };
    }

    const publishedSlug = published.publishedSlug;

    // On persiste le slug public RÉEL pour que le lien Aperçu pointe juste.
    if (publishedSlug) {
      const fresh = loadFunnel(id) ?? updated;
      const withSlug: StoredFunnel = { ...fresh, publishedSlug };
      safeSetItem(STORAGE_PREFIX + id, serializeStored(withSlug), id);
      emitChange(id);
      return { stored: withSlug, remoteOk: true, publishedSlug };
    }

    return { stored: updated, remoteOk: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Publication distante échouée.";
    console.warn("[funnelStore] publication distante échouée:", error);
    return { stored: updated, remoteOk: false, error };
  }
}

export function loadPublishedFunnel(slug: string): StoredFunnel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PUBLISHED_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFunnel;
    return applyMigrations(parsed);
  } catch {
    return null;
  }
}

/**
 * Version async qui résout aussi les médias IndexedDB.
 * À privilégier pour le rendu de la page publique.
 */
export async function loadPublishedFunnelWithMedia(
  slug: string,
): Promise<StoredFunnel | null> {
  const stored = loadPublishedFunnel(slug);
  if (!stored) return null;
  if (hasIdbRefs(stored.funnel)) {
    try {
      await resolveMedias(stored.funnel);
    } catch (e) {
      console.warn("[funnelStore] resolveMedias a échoué:", e);
    }
  }
  return stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic / maintenance
// ─────────────────────────────────────────────────────────────────────────────

export function getStorageUsage(): {
  totalBytes: number;
  totalMB: number;
  count: number;
} {
  if (typeof window === "undefined")
    return { totalBytes: 0, totalMB: 0, count: 0 };
  const metas = getStoredFunnelsMeta();
  const totalBytes = metas.reduce((sum, m) => sum + m.size, 0);
  return {
    totalBytes,
    totalMB: +(totalBytes / 1024 / 1024).toFixed(2),
    count: metas.length,
  };
}

export function clearAllFunnels(): void {
  if (typeof window === "undefined") return;
  const ids = readIndex();
  for (const id of ids) {
    const stored = loadFunnel(id);
    window.localStorage.removeItem(STORAGE_PREFIX + id);
    if (stored?.slug) {
      window.localStorage.removeItem(PUBLISHED_PREFIX + stored.slug);
    }
  }
  writeIndex([]);
  emitChange();
  // NB : ne touche PAS au distant (action de maintenance locale uniquement).
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks React
// ─────────────────────────────────────────────────────────────────────────────

export type FunnelListItem = RemoteFunnelSummary & {
  /** Disponibles seulement quand une copie complète existe déjà dans le cache. */
  pageCount?: number;
  sectionCount?: number;
};

export type FunnelListState = {
  funnels: FunnelListItem[];
  status: "loading" | "loaded" | "error";
  error: string | null;
};

function storedToListItem(stored: StoredFunnel): FunnelListItem {
  const pages = stored.funnel.pages ?? [];
  const sectionCount =
    pages.length > 0
      ? pages.reduce((sum, page) => sum + (page.sections?.length ?? 0), 0)
      : stored.funnel.sections?.length ?? 0;
  return {
    id: stored.id,
    name: stored.funnel.funnelName || stored.slug,
    slug: stored.slug,
    language: stored.funnel.language || "fr",
    status: stored.publishedAt ? "published" : "draft",
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    publishedAt: stored.publishedAt,
    publishedSlug: stored.publishedSlug,
    pageCount: pages.length || undefined,
    sectionCount,
  };
}

/** Fusionne les métadonnées DISTANTES avec les brouillons LOCAUX complets.
 *  Règles inchangées : tombstones exclus ; en doublon, la version la plus
 *  récente gagne. Un résumé distant n'est jamais écrit dans le cache. */
function mergeRemoteAndLocal(remoteList: RemoteFunnelSummary[]): FunnelListItem[] {
  const deleted = new Set(readDeleted());
  const byId = new Map<string, FunnelListItem>();
  for (const r of remoteList) {
    if (!deleted.has(r.id)) byId.set(r.id, r);
  }
  for (const l of listFunnels()) {
    // listFunnels() exclut déjà les tombstones.
    const localItem = storedToListItem(l);
    const existing = byId.get(l.id);
    if (!existing || (l.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      byId.set(l.id, localItem);
    } else if (existing) {
      // Conserve les compteurs disponibles dans le cache sans remplacer les
      // métadonnées distantes plus récentes.
      byId.set(l.id, {
        ...existing,
        pageCount: localItem.pageCount,
        sectionCount: localItem.sectionCount,
      });
    }
  }
  return [...byId.values()].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

export function useFunnelList(): FunnelListState {
  const [list, setList] = useState<FunnelListItem[]>([]);
  const [status, setStatus] = useState<FunnelListState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  // 🆕 Dernière liste distante connue, pour que les mises à jour locales
  // (subscribe) n'écrasent pas l'affichage avec le seul cache localStorage.
  const remoteRef = useRef<RemoteFunnelSummary[]>([]);
  useEffect(() => {
    let cancelled = false;

    // 🆕 Purge les anciens snapshots ff:public:* (full funnel + images base64
    // inline, parfois 3+ Mo, jamais nettoyés). Ils saturaient le quota localStorage
    // → purges destructives → brouillons effacés → tunnels qui disparaissent /
    // réapparaissent. La page publique lit Supabase ; ces snapshots sont inutiles.
    // Idempotent : sans effet si déjà purgés.
    const freed = purgeLegacyPublicSnapshots();
    if (freed > 0) {
      console.info(
        `[useFunnelList] ${freed} snapshot(s) ff:public:* purgé(s) du localStorage.`,
      );
    }

    // 2) SUPABASE — source de vérité pour les MÉTADONNÉES de liste. Le contenu
    //    complet reste chargé à la demande par loadRemote(id).
    function hydrateFromRemote() {
      listRemote()
        .then((remoteList) => {
          if (cancelled) return;

          // 🆕 Réconciliation des tombstones (suppressions) :
          //  - un tunnel supprimé ABSENT du distant → suppression confirmée,
          //    on retire le tombstone (ménage, évite l'accumulation) ;
          //  - un tunnel supprimé ENCORE présent (orphelin/RLS) → on GARDE le
          //    tombstone (hydratation le saute) et on RE-TENTE la suppression
          //    distante, pour finir par nettoyer la ligne fantôme.
          const remoteIds = new Set(remoteList.map((r) => r.id));
          for (const deletedId of readDeleted()) {
            if (!remoteIds.has(deletedId)) {
              clearDeleted(deletedId);
            } else {
              deleteRemoteFn(deletedId)
                .then(() => clearDeleted(deletedId))
                .catch(() => {
                  /* toujours bloqué : reste masqué via tombstone */
                });
            }
          }

          // L'affichage vient de la fusion des résumés distants et du cache
          // local. Ne jamais hydrater le cache avec ces objets partiels.
          remoteRef.current = remoteList;
          if (!cancelled) {
            setList(mergeRemoteAndLocal(remoteList));
            setStatus("loaded");
            setError(null);
          }
        })
        .catch((e) => {
          console.warn("[useFunnelList] listRemote:", e);
          if (cancelled) return;
          setStatus("error");
          setError(
            "Impossible de charger vos tunnels depuis le serveur. Réessayez dans un instant.",
          );
        });
    }

    // 1) 🆕 Garde anti-fuite inter-comptes : si le cache local appartient à un
    //    AUTRE utilisateur, on le purge AVANT tout affichage. Sinon affichage
    //    instantané depuis le cache local du bon compte.
    getCurrentUserId()
      .then((userId) => {
        if (cancelled) return;
        if (userId && getCacheOwner() !== userId) {
          clearFunnelCache();
          setCacheOwner(userId);
          setList([]); // rien tant que le remote du bon compte n'est pas chargé
        } else {
          setList(listFunnels().map(storedToListItem));
        }
        hydrateFromRemote();
      })
      .catch(() => {
        if (cancelled) return;
        setList(listFunnels().map(storedToListItem));
        hydrateFromRemote();
      });

    const unsub = subscribe(() => {
      // 🆕 FIX : une mise à jour locale (save/suppression) re-fusionne avec la
      // dernière liste distante connue au lieu de retomber sur le seul cache.
      if (!cancelled) setList(mergeRemoteAndLocal(remoteRef.current));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return { funnels: list, status, error };
}

export function useFunnel(id: string | undefined): StoredFunnel | null {
  const [stored, setStored] = useState<StoredFunnel | null>(null);
  useEffect(() => {
    if (!id) {
      setStored(null);
      return;
    }
    let cancelled = false;

    // 1) Affichage immédiat depuis le cache local (UX : pas d'écran blanc)
    loadFunnelWithMedia(id).then((localResolved) => {
      if (cancelled) return;
      if (localResolved) {
        setStored(localResolved);
      } else {
        // Fallback sync si la résolution échoue
        setStored(loadFunnel(id));
      }
    });

    // 2) 🆕 SUPABASE — source de vérité. Hydrate le local puis re-résout
    //    les médias (les URLs Supabase sont déjà des https : no-op pour eux).
    loadRemote(id)
      .then((remote) => {
        if (cancelled || !remote) return;
        hydrateLocalFromRemote(remote);
        loadFunnelWithMedia(id).then((merged) => {
          if (!cancelled && merged) setStored(merged);
        });
      })
      .catch((e) => console.warn("[useFunnel] loadRemote:", e));

    const unsub = subscribe(() => {
      if (cancelled) return;
      loadFunnelWithMedia(id).then((resolved) => {
        if (!cancelled && resolved) setStored(resolved);
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [id]);
  return stored;
}

export type FunnelLoadStatus = "loading" | "loaded" | "not-found";

export function useFunnelWithStatus(
  id: string | undefined,
): { stored: StoredFunnel | null; status: FunnelLoadStatus } {
  const [stored, setStored] = useState<StoredFunnel | null>(null);
  const [status, setStatus] = useState<FunnelLoadStatus>("loading");

  useEffect(() => {
    if (!id) {
      setStored(null);
      setStatus("not-found");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    // 1) Affichage immédiat depuis le cache local
    loadFunnelWithMedia(id).then((resolved) => {
      if (cancelled) return;
      if (resolved) {
        setStored(resolved);
        setStatus("loaded");
      } else {
        const fallback = loadFunnel(id);
        if (fallback) {
          setStored(fallback);
          setStatus("loaded");
        }
        // Pas de "not-found" ici : on attend la réponse distante (étape 2)
        // avant de conclure à l'absence, sinon un funnel présent uniquement
        // côté Supabase (autre appareil, cache vidé) serait déclaré introuvable.
      }
    });

    // 2) 🆕 SUPABASE — source de vérité + résolution du statut final.
    loadRemote(id)
      .then((remote) => {
        if (cancelled) return;
        if (remote) {
          hydrateLocalFromRemote(remote);
          loadFunnelWithMedia(id).then((merged) => {
            if (cancelled) return;
            if (merged) {
              setStored(merged);
              setStatus("loaded");
            }
          });
        } else {
          // Absent côté distant : si rien en local non plus → not-found.
          const local = loadFunnel(id);
          if (!local) {
            setStored(null);
            setStatus("not-found");
          }
        }
      })
      .catch((e) => {
        console.warn("[useFunnelWithStatus] loadRemote:", e);
        // En cas d'erreur réseau, on retombe sur le local pour décider.
        if (cancelled) return;
        const local = loadFunnel(id);
        if (!local) {
          setStored(null);
          setStatus("not-found");
        }
      });

    const unsub = subscribe(() => {
      if (cancelled) return;
      loadFunnelWithMedia(id).then((resolved) => {
        if (cancelled) return;
        if (resolved) {
          setStored(resolved);
          setStatus("loaded");
        }
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [id]);

  return { stored, status };
}
