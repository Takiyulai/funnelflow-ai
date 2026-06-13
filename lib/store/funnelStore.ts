// lib/store/funnelStore.ts
"use client";

import { useEffect, useState } from "react";
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
} from "./funnelRepository";
import { normalizeFunnel } from "./normalizeFunnel";


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
};

const STORAGE_PREFIX = "ff:funnel:";
const PUBLISHED_PREFIX = "ff:public:";
const INDEX_KEY = "ff:funnel-index";

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
      const parsed = JSON.parse(raw) as Partial<StoredFunnel>;
      out.push({
        id,
        updatedAt: parsed.updatedAt ?? "",
        size: raw.length,
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
  const existing = remoteSaveTimers.get(stored.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    remoteSaveTimers.delete(stored.id);
    saveRemote(stored).catch((e) =>
      console.warn(
        "[funnelStore] saveRemote échoué (cache local conservé):",
        e,
      ),
    );
  }, REMOTE_DEBOUNCE_MS);
  remoteSaveTimers.set(stored.id, timer);
}

/**
 * Écrit une version distante dans le cache local SANS émettre de changement
 * (évite la boucle). Utilisé par l'hydratation au load.
 */
function hydrateLocalFromRemote(remote: StoredFunnel): void {
  if (typeof window === "undefined") return;
  try {
    safeSetItem(
      STORAGE_PREFIX + remote.id,
      JSON.stringify(remote),
      remote.id,
    );
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
        JSON.stringify(migrated),
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
    const parsed = JSON.parse(raw) as StoredFunnel;
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
  const items: StoredFunnel[] = [];
  for (const id of ids) {
    const f = loadFunnel(id);
    if (f) items.push(f);
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Sauvegarde un tunnel.
 * Avant écriture, externalise tous les data:image/...;base64,... vers IndexedDB
 * et les remplace dans le payload par des références `idb-media://{id}`,
 * ce qui ramène le poids du JSON localStorage de ~15 Mo à quelques Ko.
 */
export function saveFunnel(stored: StoredFunnel): void {
  if (typeof window === "undefined") return;

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
  safeSetItem(STORAGE_PREFIX + stored.id, JSON.stringify(synced), stored.id);

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
  emitChange(id);

  // 🆕 SUPABASE — miroir distant best-effort
  deleteRemoteFn(id).catch((e) =>
    console.warn("[funnelStore] deleteRemote échoué:", e),
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

  const baseSlug = slugify(
    funnel.funnelName || `${brief.brandName}-${brief.offerName}`,
  );
  const existingSlugs = new Set(listFunnels().map((f) => f.slug));
  const slug = uniqueSlug(baseSlug || "tunnel", existingSlugs);

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

export function publishFunnel(id: string): StoredFunnel | null {
  const stored = loadFunnel(id);
  if (!stored || typeof window === "undefined") return null;

  const updated: StoredFunnel = {
    ...stored,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ✅ Écriture sécurisée pour les deux entrées
  safeSetItem(STORAGE_PREFIX + id, JSON.stringify(updated), id);
  safeSetItem(PUBLISHED_PREFIX + stored.slug, JSON.stringify(updated), id);

  emitChange(id);

  // 🆕 SUPABASE — publication distante : on pousse d'abord le draft à jour
  // (json_content + médias externalisés), PUIS on fige le snapshot publié
  // (published_content + published_slug + status='published'). Séquentiel
  // pour garantir que le snapshot contient bien la dernière version.
  (async () => {
    try {
      await saveRemote(updated);
      await publishRemote(id);
    } catch (e) {
      console.warn("[funnelStore] publication distante échouée:", e);
    }
  })();

  return updated;
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

export function useFunnelList(): StoredFunnel[] {
  const [list, setList] = useState<StoredFunnel[]>([]);
  useEffect(() => {
    let cancelled = false;

    // 1) Affichage instantané depuis le cache local
    setList(listFunnels());

    // 2) 🆕 SUPABASE — source de vérité : on récupère la liste distante,
    //    on hydrate le cache local, puis on rafraîchit l'affichage.
    listRemote()
      .then((remoteList) => {
        if (cancelled || remoteList.length === 0) return;
        for (const remote of remoteList) {
          hydrateLocalFromRemote(remote);
        }
        if (!cancelled) setList(listFunnels());
      })
      .catch((e) => console.warn("[useFunnelList] listRemote:", e));

    const unsub = subscribe(() => {
      if (!cancelled) setList(listFunnels());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return list;
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
