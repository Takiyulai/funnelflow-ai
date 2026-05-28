// lib/store/mediaStore.ts
// Stockage des médias volumineux (base64) dans IndexedDB
// pour éviter de saturer le localStorage (~5 Mo limite).

const DB_NAME = "funnelflow-media";
const STORE_NAME = "media";
const DB_VERSION = 1;

export const IDB_MEDIA_PREFIX = "idb-media://";

// ─────────────────────────────────────────────────────────────────────────────
// Cache de déduplication : data-URL → ref idb-media://m_xxx
// Évite de re-externaliser à chaque sauvegarde la MÊME image avec un nouvel id
// (sinon : fuite IndexedDB + boucle infinie d'auto-save dans l'éditeur).
// ─────────────────────────────────────────────────────────────────────────────

const dataUrlToRef = new Map<string, string>();

function quickHash(s: string): string {
  // Identifiant léger basé sur la longueur + extraits début/fin de la data-URL.
  // Suffisant pour distinguer des images différentes sans hash cryptographique.
  return `${s.length}:${s.slice(0, 48)}:${s.slice(-32)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connexion IndexedDB (cache de la promesse)
// ─────────────────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// API bas niveau
// ─────────────────────────────────────────────────────────────────────────────

export async function putMedia(id: string, dataUrl: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMedia(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllMedia(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      dataUrlToRef.clear();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function makeMediaId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:") &&
    value.includes(";base64,")
  );
}

export function isIdbRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(IDB_MEDIA_PREFIX);
}

export function hasIdbRefs(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (isIdbRef(obj)) return true;
  if (Array.isArray(obj)) return obj.some(hasIdbRefs);
  if (typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (hasIdbRefs(v)) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Externalisation SYNCHRONE (mutation immédiate + put async en background)
// Avec déduplication via dataUrlToRef pour éviter les fuites IDB.
// ─────────────────────────────────────────────────────────────────────────────

function externalizeOne(dataUrl: string): string {
  const hash = quickHash(dataUrl);
  const cached = dataUrlToRef.get(hash);
  if (cached) {
    // Cette data-URL a déjà été externalisée → réutiliser la même ref
    return cached;
  }
  const id = makeMediaId();
  const ref = `${IDB_MEDIA_PREFIX}${id}`;
  dataUrlToRef.set(hash, ref);
  // Écriture IDB en fire-and-forget
  putMedia(id, dataUrl).catch((e) =>
    console.warn("[mediaStore] putMedia a échoué:", e),
  );
  return ref;
}

export function externalizeMediasSync(obj: unknown): void {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (isDataUrl(val)) {
        obj[i] = externalizeOne(val as string);
      } else if (val && typeof val === "object") {
        externalizeMediasSync(val);
      }
    }
    return;
  }

  if (typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      const val = rec[key];
      if (isDataUrl(val)) {
        rec[key] = externalizeOne(val as string);
      } else if (val && typeof val === "object") {
        externalizeMediasSync(val);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Version async complète (await chaque écriture)
// ─────────────────────────────────────────────────────────────────────────────

export async function externalizeMedias(obj: unknown): Promise<void> {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (isDataUrl(val)) {
        const dataUrl = val as string;
        const hash = quickHash(dataUrl);
        const cached = dataUrlToRef.get(hash);
        if (cached) {
          obj[i] = cached;
        } else {
          const id = makeMediaId();
          const ref = `${IDB_MEDIA_PREFIX}${id}`;
          await putMedia(id, dataUrl);
          dataUrlToRef.set(hash, ref);
          obj[i] = ref;
        }
      } else if (val && typeof val === "object") {
        await externalizeMedias(val);
      }
    }
    return;
  }

  if (typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      const val = rec[key];
      if (isDataUrl(val)) {
        const dataUrl = val as string;
        const hash = quickHash(dataUrl);
        const cached = dataUrlToRef.get(hash);
        if (cached) {
          rec[key] = cached;
        } else {
          const id = makeMediaId();
          const ref = `${IDB_MEDIA_PREFIX}${id}`;
          await putMedia(id, dataUrl);
          dataUrlToRef.set(hash, ref);
          rec[key] = ref;
        }
      } else if (val && typeof val === "object") {
        await externalizeMedias(val);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution (async — accès IDB)
// Alimente aussi le cache pour que la prochaine externalisation réutilise
// la même ref idb-media:// (clé du correctif anti-boucle).
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveMedias(obj: unknown): Promise<void> {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (isIdbRef(val)) {
        const ref = val as string;
        const id = ref.slice(IDB_MEDIA_PREFIX.length);
        const data = await getMedia(id);
        if (data) {
          obj[i] = data;
          // 🔑 Alimente le cache : si on ré-externalise cette data-URL,
          // on retombera sur la même ref → pas de fuite IDB.
          dataUrlToRef.set(quickHash(data), ref);
        }
      } else if (val && typeof val === "object") {
        await resolveMedias(val);
      }
    }
    return;
  }

  if (typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      const val = rec[key];
      if (isIdbRef(val)) {
        const ref = val as string;
        const id = ref.slice(IDB_MEDIA_PREFIX.length);
        const data = await getMedia(id);
        if (data) {
          rec[key] = data;
          dataUrlToRef.set(quickHash(data), ref);
        }
      } else if (val && typeof val === "object") {
        await resolveMedias(val);
      }
    }
  }
}
