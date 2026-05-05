// lib/store/funnelStore.ts
"use client";

import { useEffect, useState } from "react";
import type { Funnel, FunnelBrief } from "@/lib/funnels/types";

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
// Event bus pour notifier les hooks React des changements
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
  // Synchro entre onglets via storage event natif
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
// Index : on garde une liste plate des ids pour itérer rapidement
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
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function loadFunnel(id: string): StoredFunnel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as StoredFunnel;
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
  // Tri par updatedAt desc
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveFunnel(stored: StoredFunnel): void {
  if (typeof window === "undefined") return;
  const updated = { ...stored, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_PREFIX + stored.id, JSON.stringify(updated));

  // Met à jour l'index si nouvel id
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
  // Supprime aussi la version publiée si elle existe
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

  saveFunnel(stored);
  return stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publication (copie sous ff:public:<slug>)
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
    return JSON.parse(raw) as StoredFunnel;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks React
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook : retourne la liste des funnels stockés, réactif aux changements
 * (création, suppression, mise à jour, synchro inter-onglets via storage event).
 */
export function useFunnelList(): StoredFunnel[] {
  const [list, setList] = useState<StoredFunnel[]>([]);

  useEffect(() => {
    setList(listFunnels());
    const unsub = subscribe(() => setList(listFunnels()));
    return unsub;
  }, []);

  return list;
}

/**
 * Hook : retourne un funnel par id, réactif aux changements externes.
 * Utilisé par la page éditeur pour rester synchro entre onglets.
 */
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
