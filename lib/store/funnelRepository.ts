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
    publishedSlug: row.published_slug ?? undefined,
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
    if (url) {
      cache.set(value, url);
      return url;
    }
    // Fallback : si l'upload Storage échoue, on garde la data-URL INLINE plutôt
    // qu'une référence "idb-media://" morte (irrésolvable côté serveur public).
    // Image plus lourde mais réellement affichée sur la page publiée.
    cache.set(value, dataUrl);
    return dataUrl;
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

// ─────────────────────────────────────────────────────────────────────────────
// Cache de session — élimine la contention navigator.locks
// ─────────────────────────────────────────────────────────────────────────────
//
// Même avec un client Supabase singleton, plusieurs composants qui se montent
// simultanément (useFunnelList + useFunnel + autosave debounce) peuvent tous
// appeler getSession() en même temps. Si le token est expiré, chacun tente un
// refresh → tous contendent sur navigator.locks → le plus lent se fait « voler »
// le verrou → AbortError + « Failed to fetch » en cascade.
//
// La solution : un seul appel getSession() à la fois (déduplication via promise
// partagée) et un cache de 60 s (évite les appels répétés inutiles). On invalide
// le cache sur changement d'état auth (login / logout).

type SessionCache = { userId: string | null; expiresAt: number };
let _sessionCache: SessionCache | null = null;
let _sessionPromise: Promise<string | null> | null = null;
const SESSION_CACHE_TTL_MS = 60_000;

// Invalider le cache sur changement d'état (login / logout / refresh).
if (typeof window !== "undefined") {
  try {
    createSupabaseBrowserClient().auth.onAuthStateChange(() => {
      _sessionCache = null;
      // Ne pas annuler _sessionPromise en vol : elle aboutira et rafraîchira
      // le cache avec les nouvelles données.
    });
  } catch {
    /* Supabase non dispo (SSR) : ignoré */
  }
}

async function getUserId(): Promise<string | null> {
  const now = Date.now();

  // 1) Cache valide → réponse instantanée, aucun verrou.
  if (_sessionCache && _sessionCache.expiresAt > now) {
    return _sessionCache.userId;
  }

  // 2) Appel déjà en vol → on attend le même appel (pas de doublon).
  if (_sessionPromise) return _sessionPromise;

  // 3) Premier appelant : lance l'appel et partage la promise.
  _sessionPromise = (async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      // getSession() lit le token depuis le storage local ; s'il est expiré il
      // lance UN SEUL refresh (verrou acquis une seule fois car tous les autres
      // appelants attendent déjà _sessionPromise ci-dessus).
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;
      _sessionCache = { userId, expiresAt: Date.now() + SESSION_CACHE_TTL_MS };
      return userId;
    } finally {
      _sessionPromise = null;
    }
  })();

  return _sessionPromise;
}

/** Id de l'utilisateur connecté (cache léger). Public pour la garde de cache. */
export async function getCurrentUserId(): Promise<string | null> {
  return getUserId();
}

/** Formate une erreur PostgREST/Supabase en message lisible AVEC le code. */
function formatPgError(
  prefix: string,
  error: { message?: string; details?: string; hint?: string; code?: string },
): string {
  const code = error.code ? `[${error.code}] ` : "";
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return `${prefix} : ${code}${parts.join(" — ") || "erreur inconnue"}`;
}

// Colonnes nécessaires à rowToStored. On EXCLUT volontairement `published_content`
// (énorme et redondant avec json_content) : le ramener pour TOUS les tunnels
// d'un coup gonflait la réponse jusqu'à casser le parsing JSON
// (« Unterminated string in JSON »), faisant tomber la synchro du dashboard.
const LIST_COLS =
  "id, slug, json_content, brief, created_at, updated_at, published_at, published_slug";

export async function listRemote(): Promise<StoredFunnel[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("funnels")
    .select(LIST_COLS)
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn(formatPgError("[funnelRepository] listRemote", error));
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
    // ⚠️ On LÈVE l'erreur (au lieu de retourner null en silence) pour que la
    // publication puisse remonter une cause précise à l'utilisateur.
    throw new Error("Non connecté à Supabase (session expirée ?). Reconnectez-vous.");
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

  // Première tentative : upsert par id.
  let { data, error } = await supabase
    .from("funnels")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  // 🆕 Collision de slug (23505 sur funnels_user_slug_uidx) : un AUTRE tunnel
  // (souvent une ligne orpheline laissée par une suppression qui avait échoué)
  // occupe déjà ce slug. On résout vers un slug libre et on réessaie, plutôt
  // que de bloquer la publication.
  if (error && error.code === "23505" && /slug/i.test(`${error.message} ${error.details ?? ""}`)) {
    const freeSlug = await resolveFreeFunnelSlug(userId, stored.slug, stored.id);
    ({ data, error } = await supabase
      .from("funnels")
      .upsert({ ...row, slug: freeSlug }, { onConflict: "id" })
      .select("*")
      .maybeSingle());
  }

  if (error) {
    throw new Error(formatPgError("Enregistrement Supabase impossible", error));
  }
  return data ? rowToStored(data as FunnelRow) : null;
}

/** Trouve un `slug` (brouillon) libre pour cet utilisateur (≠ autres lignes). */
async function resolveFreeFunnelSlug(
  userId: string,
  base: string,
  selfId: string,
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const isTaken = async (candidate: string): Promise<boolean> => {
    const { data } = await supabase
      .from("funnels")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", candidate)
      .neq("id", selfId)
      .maybeSingle();
    return !!data;
  };
  if (!(await isTaken(base))) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${selfId.slice(0, 8)}`;
}

export async function deleteRemote(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("funnels").delete().eq("id", id);
  if (error) {
    // ⚠️ Si la suppression distante échoue (souvent RLS), le tunnel réapparaît
    // au prochain chargement (hydratation depuis Supabase). On LÈVE l'erreur
    // pour que l'appelant puisse la remonter.
    throw new Error(formatPgError("Suppression Supabase impossible", error));
  }
  // ⚠️ CRUCIAL : PostgREST/Postgres ne renvoie PAS d'erreur si 0 ligne a été
  // supprimée (RLS, ligne orpheline d'un autre user_id…). Sans vérification, on
  // croirait la suppression réussie, on effacerait le « tombstone » côté client,
  // et le tunnel RESSUSCITERAIT au prochain listRemote. On confirme donc
  // l'absence réelle ; si la ligne existe toujours, on lève une erreur pour que
  // l'appelant conserve le tombstone (tunnel masqué définitivement en local).
  const { data: still } = await supabase
    .from("funnels")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (still) {
    throw new Error(
      "Suppression Supabase non effective : la ligne existe toujours (RLS/ownership — ligne orpheline ?).",
    );
  }
}

/**
 * Publication : fige un snapshot dans published_content + published_slug,
 * passe status='published'. Le snapshot est la version servie aux visiteurs.
 */
export async function publishRemote(id: string): Promise<StoredFunnel | null> {
  const userId = await getUserId();
  if (!userId) throw new Error("Non connecté à Supabase (session expirée ?).");
  const supabase = createSupabaseBrowserClient();

  // On repart du draft courant (déjà à jour côté json_content via saveRemote)
  const current = await loadRemote(id);
  if (!current) {
    throw new Error(
      "Brouillon introuvable côté Supabase : l'enregistrement distant n'a pas abouti.",
    );
  }

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
    throw new Error(formatPgError("Publication Supabase impossible", error));
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
