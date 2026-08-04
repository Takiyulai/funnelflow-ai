// lib/clone/media-uploader.ts
/**
 * Téléchargement et upload des médias clonés vers Supabase Storage.
 *
 * Stratégie :
 * 1. Pour chaque ClonedMediaAsset, fetch l'image source.
 * 2. Upload vers le bucket "cloned-funnels-media" avec un path unique.
 * 3. Stocke l'URL publique dans asset.uploadedUrl.
 * 4. Si échec : marque asset.uploadFailed = true (l'asset reste utilisable
 *    avec sourceUrl en hot-link de secours, sous réserve de CORS).
 *
 * Limites :
 * - Timeout 15s par image.
 * - Taille max : 10 MB.
 * - Parallélisme : 5 simultanés (évite de saturer le serveur source).
 */

import type { ClonedMediaAsset } from "./types";
import { uploadBuffer } from "@/lib/media/cloudinary";

const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PARALLEL_UPLOADS = 5;

/**
 * Upload tous les médias en parallèle (par batch).
 * Mute les assets en place : ajoute uploadedUrl ou uploadFailed.
 */
export async function uploadMediaAssets(
  assets: ClonedMediaAsset[],
  funnelId: string
): Promise<{ uploaded: number; failed: number }> {
  if (assets.length === 0) {
    console.log("[media-uploader] No media to upload");
    return { uploaded: 0, failed: 0 };
  }

  console.log(
    `[media-uploader] Uploading ${assets.length} media(s) to Cloudinary…`
  );

  let uploaded = 0;
  let failed = 0;

  // Découpe en batchs de PARALLEL_UPLOADS
  for (let i = 0; i < assets.length; i += PARALLEL_UPLOADS) {
    const batch = assets.slice(i, i + PARALLEL_UPLOADS);
    const results = await Promise.all(
      batch.map((asset) => uploadSingleAsset(asset, funnelId))
    );
    results.forEach((ok) => (ok ? uploaded++ : failed++));
  }

  console.log(
    `[media-uploader] ✅ Done : ${uploaded} uploaded, ${failed} failed`
  );
  return { uploaded, failed };
}

/**
 * Upload un seul asset. Retourne true si succès.
 */
async function uploadSingleAsset(
  asset: ClonedMediaAsset,
  funnelId: string
): Promise<boolean> {
  try {
    const buffer = await downloadAsset(asset.sourceUrl);
    if (!buffer) {
      asset.uploadFailed = true;
      return false;
    }

    const contentType = guessContentType(asset.sourceUrl, asset.type);

    // 🆕 L'identifiant est l'empreinte du CONTENU, pas un chemin construit.
    //
    // C'est le correctif de fond du dépassement de stockage : un même site
    // cloné quatre fois stockait quatre copies de chaque image sur Supabase.
    // Avec l'empreinte, les quatre clonages retombent sur le même asset
    // Cloudinary — la place n'est occupée qu'une fois.
    const result = await uploadBuffer(buffer, {
      folder: `clone/${funnelId}`,
      mime: contentType,
    });

    asset.uploadedUrl = result.url;
    return true;
  } catch (err) {
    console.error(
      `[media-uploader] ❌ Exception for ${asset.sourceUrl}: ${(err as Error).message}`
    );
    asset.uploadFailed = true;
    return false;
  }
}

/**
 * Télécharge un asset distant en buffer.
 */
async function downloadAsset(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,video/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      console.warn(
        `[media-uploader] ⚠️ HTTP ${response.status} for ${url}`
      );
      return null;
    }

    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10
    );
    if (contentLength > MAX_FILE_SIZE) {
      console.warn(
        `[media-uploader] ⚠️ File too large (${contentLength} bytes) : ${url}`
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      console.warn(
        `[media-uploader] ⚠️ File too large after download : ${url}`
      );
      return null;
    }

    return Buffer.from(arrayBuffer);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn(`[media-uploader] ⚠️ Timeout for ${url}`);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function guessExtension(url: string, type: "image" | "video"): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,4})(?:\?|$)/);
    if (match) {
      const ext = match[1];
      if (
        ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif", "mp4", "webm", "mov"].includes(
          ext
        )
      ) {
        return ext === "jpeg" ? "jpg" : ext;
      }
    }
  } catch {
    // fallthrough
  }
  return type === "video" ? "mp4" : "jpg";
}

function guessContentType(url: string, type: "image" | "video"): string {
  const ext = guessExtension(url, type);
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return map[ext] || (type === "video" ? "video/mp4" : "image/jpeg");
}

// ⚠️ `getSupabaseAdmin` a disparu avec la migration : ce module n'écrit plus
// dans Supabase Storage. Les identifiants requis sont désormais ceux de
// Cloudinary (cf. lib/media/cloudinary.ts).
