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

// ⚠️ `MEDIA_BUCKET` a été retiré : les médias ne partent plus vers Supabase
// Storage mais vers Cloudinary, via la route serveur `/api/media/upload`
// (la clé Cloudinary ne doit jamais atteindre le navigateur).
// Voir lib/media/cloudinary.ts.

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

type RemoteOptions = {
  signal?: AbortSignal;
};

type SaveRemoteOptions = RemoteOptions & {
  /** Une republication d'un brouillon existant ne doit pas réécrire le brief lourd. */
  includeBrief?: boolean;
};

// `loadRemote` exclut volontairement le brief lourd. Un tunnel obtenu par ce
// chemin ne doit donc jamais réécrire le placeholder vide dans la colonne DB.
const remoteDraftsWithoutBrief = new Set<string>();

type FunnelListRow = Pick<
  FunnelRow,
  | "id"
  | "name"
  | "slug"
  | "language"
  | "status"
  | "published_slug"
  | "published_at"
  | "created_at"
  | "updated_at"
>;

/** Métadonnées légères utilisées par le dashboard, sans contenu du tunnel. */
export type RemoteFunnelSummary = {
  id: string;
  name: string;
  slug: string;
  language: string;
  status: FunnelRow["status"];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedSlug?: string;
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

function rowToSummary(row: FunnelListRow): RemoteFunnelSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    language: row.language,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
    publishedSlug: row.published_slug ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload des médias vers Cloudinary (via la route serveur /api/media/upload)
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
    const blob = await dataUrlToBlob(dataUrl);
    const ext = extFromDataUrl(dataUrl);

    // 🆕 MIGRATION STOCKAGE — passage par la ROUTE SERVEUR `/api/media/upload`
    // au lieu d'un envoi direct navigateur → Supabase Storage.
    //
    // C'est ce chemin-ci qui a saturé le bucket : il représentait 1 131 Mo sur
    // les 1 464 Mo constatés, soit 77 % du dépassement.
    //
    // ⚠️ POURQUOI PASSER PAR LE SERVEUR. Cloudinary signe ses uploads avec
    // CLOUDINARY_API_SECRET. Cette clé permet aussi de SUPPRIMER : la mettre
    // dans un bundle navigateur reviendrait à donner à n'importe quel visiteur
    // les droits d'écriture et d'effacement sur toute la médiathèque. Le
    // navigateur envoie donc le fichier à notre route, qui signe côté serveur.
    //
    // `userId` n'est plus utilisé pour construire un chemin (Cloudinary nomme
    // par empreinte de contenu) mais reste dans la signature : le supprimer
    // casserait tous les appelants pour un gain nul.
    void userId;

    const form = new FormData();
    form.append("file", blob, `media.${ext}`);
    form.append("funnelId", funnelId);
    form.append("spotId", "editor");

    const res = await fetch("/api/media/upload", { method: "POST", body: form });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.warn(
        "[funnelRepository] upload média échoué:",
        detail?.error ?? `HTTP ${res.status}`,
      );
      return null;
    }
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
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

// Métadonnées strictement nécessaires au dashboard. Le contenu lourd
// (`json_content`, `brief`, `published_content`) est chargé à la demande par
// `loadRemote(id)` quand l'utilisateur ouvre ou duplique un tunnel précis.
const LIST_COLS =
  "id, name, slug, language, status, created_at, updated_at, published_at, published_slug";

export class FunnelListRemoteError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "FunnelListRemoteError";
  }
}

/**
 * 🆕 FIX « tunnels disparus » (bis) : le plan gratuit Supabase fait des cold
 * starts (~15s) qui déclenchent un "TypeError: Failed to fetch" (le fetch
 * réseau lève AVANT même de renvoyer {data,error}). Sans retry, useFunnelList
 * capturait cette exception dans un simple console.warn et n'affichait plus
 * JAMAIS la liste distante (le cache local, seul repli, peut lui-même être
 * vide — nouvel appareil, cache purgé au changement de compte...) : le
 * dashboard restait bloqué sur "0 tunnel" jusqu'au rechargement manuel de la
 * page. On retente donc 3 fois (backoff court) avant d'abandonner, comme déjà
 * fait pour saveRemote/publishRemote.
 */
export async function listRemote(): Promise<RemoteFunnelSummary[]> {
  const userId = await getUserId();
  if (!userId) {
    throw new FunnelListRemoteError(
      "Impossible de charger les tunnels : session Supabase absente ou expirée.",
      "unauthenticated",
    );
  }
  const supabase = createSupabaseBrowserClient();
  let lastErr: unknown = null;
  const ATTEMPTS = 4;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const { data, error } = await supabase
        .from("funnels")
        .select(LIST_COLS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) {
        const remoteError = new FunnelListRemoteError(
          formatPgError("[funnelRepository] listRemote", error),
          error.code,
        );
        lastErr = remoteError;
        // 57014 = statement timeout. Les erreurs structurelles / d'autorisation
        // ne gagnent rien à être rejouées plusieurs fois.
        if (error.code !== "57014" || attempt === ATTEMPTS - 1) {
          throw remoteError;
        }
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      return (data as FunnelListRow[]).map(rowToSummary);
    } catch (e) {
      lastErr = e;
      if (e instanceof FunnelListRemoteError && e.code !== "57014") throw e;
      if (attempt < ATTEMPTS - 1) {
        // Backoff croissant (800ms, 1600ms, 2400ms) : couvre un vrai cold
        // start Supabase (~15s cumulés) sans bloquer indéfiniment l'UI.
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new FunnelListRemoteError(
    `Impossible de charger les tunnels après ${ATTEMPTS} tentatives.`,
  );
}

const LOAD_COLS =
  "id, user_id, name, slug, language, funnel_type, json_content, default_cta, status, published_slug, published_at, created_at, updated_at";

export async function loadRemote(
  id: string,
  options: RemoteOptions = {},
): Promise<StoredFunnel | null> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("funnels")
    .select(LOAD_COLS)
    .eq("id", id);
  if (options.signal) query = query.abortSignal(options.signal);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (options.signal?.aborted) {
      throw new Error("Le chargement du brouillon Supabase a dépassé le délai autorisé.");
    }
    return null;
  }
  if (!data) return null;
  remoteDraftsWithoutBrief.add(id);
  // Le brief et l'ancien snapshot publié ne sont pas nécessaires pour ouvrir
  // le brouillon. Le brief local éventuel reste la source utilisée à l'édition.
  return rowToStored({ ...data, brief: {}, published_content: null } as FunnelRow);
}

/**
 * Upsert du brouillon. Externalise les médias vers Storage avant écriture
 * (le JSON stocké ne contient donc QUE des URLs https, jamais de base64).
 */
export async function saveRemote(
  stored: StoredFunnel,
  options: SaveRemoteOptions = {},
): Promise<StoredFunnel | null> {
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

  let includeBrief = options.includeBrief !== false && !remoteDraftsWithoutBrief.has(stored.id);
  if (!includeBrief) {
    // Un tout premier enregistrement doit encore conserver son brief. La
    // vérification ne lit que l'id et évite de recharger la colonne lourde.
    let existenceQuery = supabase
      .from("funnels")
      .select("id")
      .eq("id", stored.id);
    if (options.signal) existenceQuery = existenceQuery.abortSignal(options.signal);
    const { data: existing, error: existenceError } = await existenceQuery.maybeSingle();
    if (existenceError) {
      throw new Error(formatPgError("Vérification Supabase impossible", existenceError));
    }
    includeBrief = !existing;
  }

  const row = {
    id: stored.id,
    user_id: userId,
    name: funnelWithUrls.funnelName || stored.slug,
    slug: stored.slug,
    language: funnelWithUrls.language || "fr",
    funnel_type: funnelWithUrls.meta?.funnelKind ?? null,
    ...(includeBrief ? { brief: stored.brief } : {}),
    json_content: funnelWithUrls,
    default_cta: funnelWithUrls.defaultCta ?? null,
    updated_at: new Date().toISOString(),
  };

  // Première tentative : upsert par id.
  let saveQuery = supabase
    .from("funnels")
    .upsert(row, { onConflict: "id" })
    .select("id, slug, updated_at");
  if (options.signal) saveQuery = saveQuery.abortSignal(options.signal);
  let { data, error } = await saveQuery.maybeSingle();

  // 🆕 Collision de slug (23505 sur funnels_user_slug_uidx) : un AUTRE tunnel
  // (souvent une ligne orpheline laissée par une suppression qui avait échoué)
  // occupe déjà ce slug. On résout vers un slug libre et on réessaie, plutôt
  // que de bloquer la publication.
  if (error && error.code === "23505" && /slug/i.test(`${error.message} ${error.details ?? ""}`)) {
    const freeSlug = await resolveFreeFunnelSlug(
      userId,
      stored.slug,
      stored.id,
      options.signal,
    );
    let retryQuery = supabase
      .from("funnels")
      .upsert({ ...row, slug: freeSlug }, { onConflict: "id" })
      .select("id, slug, updated_at");
    if (options.signal) retryQuery = retryQuery.abortSignal(options.signal);
    ({ data, error } = await retryQuery.maybeSingle());
  }

  if (error) {
    throw new Error(formatPgError("Enregistrement Supabase impossible", error));
  }

  // 🆕 B5 — Rattachement du type de RDV natif à ce tunnel.
  //
  // À la GÉNÉRATION, le tunnel n'existe pas encore en base (cette fonction est
  // justement ce qui l'y met) : `funnel_id` ne peut donc pas être posé à ce
  // moment-là. On le pose ici, au premier enregistrement.
  //
  // Sans lui, la redirection post-réservation devait deviner le tunnel via
  // `json_content->meta->>bookingSlug` ET `status = 'published'` — donc rien
  // ne fonctionnait pour un tunnel encore en brouillon.
  //
  // Ne se déclenche JAMAIS en mode externe : `meta.bookingSlug` n'y est pas posé.
  await linkBookingEventType(funnelWithUrls, stored.id);

  return data
    ? {
        ...stored,
        slug: data.slug,
        funnel: funnelWithUrls,
        updatedAt: data.updated_at,
      }
    : null;
}

/**
 * Pose `booking_event_types.funnel_id` si ce n'est pas déjà fait.
 *
 * Best-effort STRICT et conditionnel : un seul UPDATE, filtré sur
 * `funnel_id is null`, donc idempotent et sans coût aux enregistrements
 * suivants. Un échec ne doit jamais faire échouer la sauvegarde du tunnel —
 * la résolution de repli par `meta.bookingSlug` reste en place côté serveur.
 */
async function linkBookingEventType(funnel: Funnel, funnelId: string): Promise<void> {
  const slug = (funnel.meta as { bookingSlug?: string } | undefined)?.bookingSlug?.trim();
  if (!slug) return;
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("booking_event_types")
      .update({ funnel_id: funnelId })
      .ilike("slug", slug)
      .is("funnel_id", null);
  } catch (e) {
    console.warn("[funnelRepository] rattachement du calendrier impossible :", e);
  }
}

/** Trouve un `slug` (brouillon) libre pour cet utilisateur (≠ autres lignes). */
async function resolveFreeFunnelSlug(
  userId: string,
  base: string,
  selfId: string,
  signal?: AbortSignal,
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const isTaken = async (candidate: string): Promise<boolean> => {
    let query = supabase
      .from("funnels")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", candidate)
      .neq("id", selfId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(formatPgError("Vérification du slug impossible", error));
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
export async function publishRemote(
  id: string,
  options: RemoteOptions = {},
): Promise<StoredFunnel | null> {
  const userId = await getUserId();
  if (!userId) throw new Error("Non connecté à Supabase (session expirée ?).");
  const supabase = createSupabaseBrowserClient();

  // On repart du draft courant (déjà à jour côté json_content via saveRemote)
  const current = await loadRemote(id, options);
  if (!current) {
    throw new Error(
      "Brouillon introuvable côté Supabase : l'enregistrement distant n'a pas abouti.",
    );
  }

  // 🆕 GARANTIE MÉDIAS : on ré-externalise TOUT média encore en `idb-media://` /
  // `data:` vers Supabase Storage AVANT de figer le snapshot publié. Sans ça, un
  // média ajouté juste avant la publication (ou dont le saveRemote « best-effort »
  // n'a pas abouti) restait une référence `idb-media://` irrésolvable sur le slug
  // public — typiquement l'IMAGE DE FOND du hero, visible en aperçu (IndexedDB du
  // créateur) mais invisible pour les visiteurs. publishRemote tourne côté
  // navigateur du créateur → getMedia (IndexedDB) résout bien les refs ici.
  const publishedFunnel = await externalizeMediaToSupabase(
    current.funnel,
    userId,
    id,
  );

  // published_slug global : on tente le slug draft, sinon suffixe court
  const publishedSlug = await resolvePublishedSlug(current.slug, id, options.signal);

  let publishQuery = supabase
    .from("funnels")
    .update({
      status: "published",
      published_content: publishedFunnel,
      published_slug: publishedSlug,
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status, published_slug, published_at");
  if (options.signal) publishQuery = publishQuery.abortSignal(options.signal);
  const { data, error } = await publishQuery.maybeSingle();

  if (error) {
    throw new Error(formatPgError("Publication Supabase impossible", error));
  }
  return data
    ? {
        ...current,
        publishedAt: data.published_at ?? undefined,
        publishedSlug: data.published_slug ?? undefined,
      }
    : null;
}

/** Trouve un published_slug global libre (unique cross-user). */
async function resolvePublishedSlug(
  base: string,
  selfId: string,
  signal?: AbortSignal,
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const tryOne = async (candidate: string): Promise<boolean> => {
    let query = supabase
      .from("funnels")
      .select("id")
      .eq("published_slug", candidate)
      .neq("id", selfId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(formatPgError("Vérification du slug publié impossible", error));
    }
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
