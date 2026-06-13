// lib/store/funnelRepository.ts
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Funnel } from "@/lib/funnels/types";
import type { StoredFunnel } from "./funnelStore";
import { isDataUrl, isIdbRef, IDB_MEDIA_PREFIX, getMedia } from "./mediaStore";
import { normalizeFunnel } from "./normalizeFunnel";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nom du bucket Supabase Storage pour les médias des funnels.
 * ⚠️ Doit correspondre EXACTEMENT au bucket existant dans Supabase Storage.
 * Bucket actuel : "cloned-funnels-media" (PUBLIC).
 */
const MEDIA_BUCKET = "cloned-funnels-media";

// ─────────────────────────────────────────────────────────────────────────────
// Mapping ligne Supabase ⇄ StoredFunnel
// ─────────────────────────────────────────────────────────────────────────────

type FunnelRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  language: string;
  funnel_type: string | null;
  brief: unknown;
  json_content: unknown;
  default_cta: unknown;
  status: "draft" | "published" | "archived";
  published_slug: string | null;
  published_content: unknown;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToStored(row: FunnelRow): StoredFunnel {
  return {
    id: row.id,
    slug: row.slug,
    funnel: normalizeFunnel(row.json_content),
    brief: (row.brief ?? {}) as StoredFunnel["brief"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload des médias vers Supabase Storage (bucket MEDIA_BUCKET)
// Remplace data:URL et idb-media:// par des URLs publiques durables.
// Idempotent : une URL https déjà Supabase est laissée telle quelle.
// ─────────────────────────────────────────────────────────────────────────────

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function extFromDataUrl(dataUrl: string): string {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);/.exec(dataUrl);
  const raw = (m?.[1] ?? "png").toLowerCase();
  if (raw === "jpeg") return "jpg";
  if (raw === "svg+xml") return "svg";
  return raw;
}

async function uploadOneMedia(
  userId: string,
  funnelId: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const blob = await dataUrlToBlob(dataUrl);
    const ext = extFromDataUrl(dataUrl);
    // Chemin : <userId>/<funnelId>/<rand>.<ext> — conforme aux policies storage
    const path = `${userId}/${funnelId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, {
        contentType: blob.type || `image/${ext}`,
        upsert: false,
      });
    if (error) {
      console.warn("[funnelRepository] upload média échoué:", error.message);
      return null;
    }
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn("[funnelRepository] uploadOneMedia exception:", e);
    return null;
  }
}

/**
 * Parcourt récursivement le funnel, remplace toute data:URL ou idb-media://
 * par une URL Supabase publique. Mute une COPIE (passée en argument).
 * Cache local pour ne pas ré-uploader deux fois la même source dans un save.
 */
async function externalizeMediaToSupabase(
  funnel: Funnel,
  userId: string,
  funnelId: string,
): Promise<Funnel> {
  const clone: Funnel = JSON.parse(JSON.stringify(funnel));
  const cache = new Map<string, string>(); // source → url Supabase

  async function resolveSource(value: string): Promise<string | null> {
    // idb-media:// → on récupère la data-URL depuis IndexedDB d'abord
    let dataUrl: string | null = null;
    if (isIdbRef(value)) {
      const id = value.slice(IDB_MEDIA_PREFIX.length);
      dataUrl = await getMedia(id);
    } else if (isDataUrl(value)) {
      dataUrl = value;
    }
    if (!dataUrl) return null;

    const cached = cache.get(value);
    if (cached) return cached;

    const url = await uploadOneMedia(userId, funnelId, dataUrl);
    if (url) cache.set(value, url);
    return url;
  }

  async function walk(obj: unknown): Promise<void> {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const v = obj[i];
        if (typeof v === "string" && (isDataUrl(v) || isIdbRef(v))) {
          const url = await resolveSource(v);
          if (url) obj[i] = url;
        } else if (v && typeof v === "object") {
          await walk(v);
        }
      }
      return;
    }
    if (typeof obj === "object") {
      const rec = obj as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        const v = rec[k];
        if (typeof v === "string" && (isDataUrl(v) || isIdbRef(v))) {
          const url = await resolveSource(v);
          if (url) rec[k] = url;
        } else if (v && typeof v === "object") {
          await walk(v);
        }
      }
    }
  }

  await walk(clone);
  return clone;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD distant
// ─────────────────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listRemote(): Promise<StoredFunnel[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("funnels")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[funnelRepository] listRemote:", error.message);
    return [];
  }
  return (data as FunnelRow[]).map(rowToStored);
}

export async function loadRemote(id: string): Promise<StoredFunnel | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("funnels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToStored(data as FunnelRow);
}

/**
 * Upsert du brouillon. Externalise les médias vers Storage avant écriture
 * (le JSON stocké ne contient donc QUE des URLs https, jamais de base64).
 */
export async function saveRemote(stored: StoredFunnel): Promise<StoredFunnel | null> {
  const userId = await getUserId();
  if (!userId) {
    console.warn("[funnelRepository] saveRemote: pas d'utilisateur connecté");
    return null;
  }
  const supabase = createSupabaseBrowserClient();

  const funnelWithUrls = await externalizeMediaToSupabase(
    stored.funnel,
    userId,
    stored.id,
  );

  const row = {
    id: stored.id,
    user_id: userId,
    name: funnelWithUrls.funnelName || stored.slug,
    slug: stored.slug,
    language: funnelWithUrls.language || "fr",
    funnel_type: funnelWithUrls.meta?.funnelKind ?? null,
    brief: stored.brief,
    json_content: funnelWithUrls,
    default_cta: funnelWithUrls.defaultCta ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("funnels")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[funnelRepository] saveRemote:", error.message);
    return null;
  }
  return data ? rowToStored(data as FunnelRow) : null;
}

export async function deleteRemote(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("funnels").delete().eq("id", id);
  if (error) console.warn("[funnelRepository] deleteRemote:", error.message);
}

/**
 * Publication : fige un snapshot dans published_content + published_slug,
 * passe status='published'. Le snapshot est la version servie aux visiteurs.
 */
export async function publishRemote(id: string): Promise<StoredFunnel | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = createSupabaseBrowserClient();

  // On repart du draft courant (déjà à jour côté json_content via saveRemote)
  const current = await loadRemote(id);
  if (!current) return null;

  // published_slug global : on tente le slug draft, sinon suffixe court
  const publishedSlug = await resolvePublishedSlug(current.slug, id);

  const { data, error } = await supabase
    .from("funnels")
    .update({
      status: "published",
      published_content: current.funnel,
      published_slug: publishedSlug,
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[funnelRepository] publishRemote:", error.message);
    return null;
  }
  return data ? rowToStored(data as FunnelRow) : null;
}

/** Trouve un published_slug global libre (unique cross-user). */
async function resolvePublishedSlug(base: string, selfId: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const tryOne = async (candidate: string): Promise<boolean> => {
    const { data } = await supabase
      .from("funnels")
      .select("id")
      .eq("published_slug", candidate)
      .neq("id", selfId)
      .maybeSingle();
    return !data; // libre si aucune autre ligne
  };
  if (await tryOne(base)) return base;
  for (let i = 0; i < 50; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}-${suffix}`;
    if (await tryOne(candidate)) return candidate;
  }
  return `${base}-${selfId.slice(0, 8)}`;
}
