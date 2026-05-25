// lib/store/funnelStore.ts
"use client";

import { useEffect, useState } from "react";
import type { Funnel, FunnelBrief, FunnelPage } from "@/lib/funnels/types";
import { FUNNEL_SCHEMA_VERSION, makePageId } from "@/lib/funnels/types";
import { migrateAllSections } from "@/lib/funnels/sectionItems";
import { normalizeFunnelKind } from "@/lib/funnels/kinds";

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
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 LOT B1 — Migration multi-pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convertit un funnel ancien format (sections[] à la racine, pas de pages[])
 * vers le nouveau format multi-pages (1 page "Accueil" contenant les sections).
 *
 * Idempotente : si le funnel a déjà pages[], retourne tel quel.
 *
 * Cette migration est transparente pour l'utilisateur et préserve toutes
 * les données existantes (sections, design, meta, etc.).
 */
function migrateFunnelToMultiPage(funnel: Funnel): Funnel {
  // Déjà migré ?
  if (funnel.pages && funnel.pages.length > 0) {
    return funnel;
  }

  const legacySections = funnel.sections ?? [];

  // Crée une page "Accueil" qui contient toutes les sections existantes
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
    // ✅ On conserve sections[] pour la rétrocompat (alias de pages[0].sections)
    sections: legacySections,
    meta: {
      ...(funnel.meta ?? {}),
      schemaVersion: FUNNEL_SCHEMA_VERSION,
    },
  };
}

/**
 * Synchronise funnel.sections avec funnel.pages[home].sections.
 * Garantit la cohérence du champ legacy après modification des pages.
 */
function syncLegacySections(funnel: Funnel): Funnel {
  if (!funnel.pages || funnel.pages.length === 0) return funnel;
  const home = funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
  if (!home) return funnel;
  return { ...funnel, sections: home.sections };
}

/**
 * Normalise les FunnelKind legacy (vsl → digital-product, etc.).
 */
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

  // Migration 1 : sections items (Livraison B)
  if (Array.isArray(funnel.sections)) {
    const migratedSections = migrateAllSections(funnel.sections);
    const hasChanged = migratedSections.some((s, i) => s !== funnel.sections[i]);
    if (hasChanged) {
      funnel = { ...funnel, sections: migratedSections };
    }
  }

  // 🆕 Migration 2 : multi-pages (Lot B1)
  const beforePages = funnel.pages;
  funnel = migrateFunnelToMultiPage(funnel);
  const wasMigratedToMultiPage = beforePages !== funnel.pages;

  // 🆕 Migration 3 : normalisation des FunnelKind legacy
  funnel = normalizeLegacyKind(funnel);

  // Sync legacy sections (au cas où pages[home].sections a été modifié ailleurs)
  funnel = syncLegacySections(funnel);

  // Si rien n'a changé, retourne l'original (référence stable)
  if (funnel === stored.funnel) return stored;

  const migrated = { ...stored, funnel };

  // 🆕 Si on vient de migrer en multi-pages, on persiste immédiatement
  // pour éviter de re-migrer à chaque load (perf + cohérence)
  if (wasMigratedToMultiPage && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + stored.id, JSON.stringify(migrated));
    } catch {
      // Ignore les erreurs de stockage (quota, etc.)
    }
  }

  return migrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

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

export function saveFunnel(stored: StoredFunnel): void {
  if (typeof window === "undefined") return;
  // 🆕 On synchronise toujours legacy sections avant sauvegarde
  const synced: StoredFunnel = {
    ...stored,
    funnel: syncLegacySections(stored.funnel),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_PREFIX + stored.id, JSON.stringify(synced));

  const ids = readIndex();
  if (!ids.includes(stored.id)) {
    ids.unshift(stored.id);
    writeIndex(ids);
  }
  emitChange(stored.id);
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Création depuis une génération IA
// ─────────────────────────────────────────────────────────────────────────────

export function createFunnelFromAi(funnel: Funnel, brief: FunnelBrief): StoredFunnel {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const baseSlug = slugify(funnel.funnelName || `${brief.brandName}-${brief.offerName}`);
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

  // Migration appliquée immédiatement (transforme sections[] en pages[home])
  const migrated = applyMigrations(stored);
  saveFunnel(migrated);
  return migrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 LOT B1 — Helpers de manipulation des pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Met à jour les sections d'une page spécifique d'un funnel.
 * Synchronise automatiquement legacy sections si c'est la page d'accueil.
 */
export function updatePageSections(
  funnel: Funnel,
  pageId: string,
  sections: Funnel["sections"]
): Funnel {
  if (!funnel.pages) return funnel;
  const pages = funnel.pages.map((p) =>
    p.id === pageId ? { ...p, sections } : p
  );
  return syncLegacySections({ ...funnel, pages });
}

/**
 * Ajoute une page à un funnel. La page est insérée à la position spécifiée
 * (ou à la fin si position non fournie).
 */
export function addPage(
  funnel: Funnel,
  page: Omit<FunnelPage, "id">,
  position?: number
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

/**
 * Supprime une page d'un funnel. Refuse de supprimer la page d'accueil.
 */
export function removePage(funnel: Funnel, pageId: string): Funnel {
  if (!funnel.pages) return funnel;
  const target = funnel.pages.find((p) => p.id === pageId);
  if (!target || target.isHome) return funnel;
  const pages = funnel.pages.filter((p) => p.id !== pageId);
  return syncLegacySections({ ...funnel, pages });
}

/**
 * Réordonne les pages d'un funnel.
 */
export function reorderPages(funnel: Funnel, orderedIds: string[]): Funnel {
  if (!funnel.pages) return funnel;
  const byId = new Map(funnel.pages.map((p) => [p.id, p]));
  const reordered = orderedIds
    .map((id) => byId.get(id))
    .filter((p): p is FunnelPage => Boolean(p));
  // Préserver les pages absentes de la liste (sécurité)
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
  window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(updated));
  window.localStorage.setItem(PUBLISHED_PREFIX + stored.slug, JSON.stringify(updated));
  emitChange(id);
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

// ─────────────────────────────────────────────────────────────────────────────
// Hooks React
// ─────────────────────────────────────────────────────────────────────────────

export function useFunnelList(): StoredFunnel[] {
  const [list, setList] = useState<StoredFunnel[]>([]);
  useEffect(() => {
    setList(listFunnels());
    const unsub = subscribe(() => setList(listFunnels()));
    return unsub;
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
    setStored(loadFunnel(id));
    const unsub = subscribe(() => setStored(loadFunnel(id)));
    return unsub;
  }, [id]);
  return stored;
}
