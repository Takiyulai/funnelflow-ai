// lib/clone/media-downloader.ts
//
// Télécharge une image/média distant et la ré-héberge sur CLOUDINARY.
// Utilisé quand l'utilisateur veut « détacher » une image de fond clonée de
// son CDN d'origine.
//
// 🆕 MIGRATION STOCKAGE — la destination était Supabase Storage, dont le
// bucket avait atteint 149 % du quota. Voir lib/media/cloudinary.ts.

import { uploadBuffer } from "@/lib/media/cloudinary";

export interface RehostResult {
  url: string;       // URL de livraison Cloudinary (f_auto,q_auto)
  path: string;      // public_id Cloudinary
  mime: string;
  size: number;
}

const MAX_REMOTE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "video/mp4",
  "video/webm",
]);

/**
 * Télécharge un asset distant et l'upload sur Supabase Storage.
 * À appeler côté serveur uniquement (utilise SUPABASE_SERVICE_ROLE_KEY).
 */
export async function downloadAndRehostMedia(remoteUrl: string): Promise<RehostResult> {
  // 1. Télécharger le fichier distant
  const res = await fetch(remoteUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (FunnelForge MediaDownloader)",
      Accept: "image/*,video/*,*/*",
    },
  });

  if (!res.ok) {
    throw new Error(`Download failed (${res.status}) for ${remoteUrl}`);
  }

  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIMES.has(contentType)) {
    throw new Error(`MIME type non autorisé: ${contentType}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_REMOTE_SIZE) {
    throw new Error(`Fichier trop volumineux: ${buf.length} bytes (max ${MAX_REMOTE_SIZE}).`);
  }

  // 2. Envoi vers Cloudinary.
  //
  // L'ancien chemin `rehosted/<timestamp>-<rand>.<ext>` garantissait l'unicité
  // par le hasard : détacher deux fois la même image de fond en créait deux
  // copies. L'empreinte du contenu (cf. lib/media/cloudinary.ts) rend
  // l'opération idempotente — c'est justement ce que « détacher » veut dire.
  const result = await uploadBuffer(buf, {
    folder: "rehosted",
    mime: contentType,
  });

  return {
    url: result.url,
    path: result.publicId,
    mime: result.mime,
    size: result.size,
  };
}

// ⚠️ `mimeToExt` a été retiré : Cloudinary déduit l'extension du contenu et
// nomme l'asset par son empreinte. Plus de chemin construit à la main.
