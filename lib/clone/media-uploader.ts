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
import {
  CloudinaryConfigError,
  CloudinaryNotConfiguredError,
  uploadBuffer,
} from "@/lib/media/cloudinary";

const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PARALLEL_UPLOADS = 5;

/**
 * Seuil au-delà duquel on considère le ré-hébergement comme RATÉ.
 *
 * Un clone dont plus de la moitié des médias pointent encore vers le site
 * d'origine est cassé en pratique : hot-link bloqué, référent refusé, ou
 * simplement des trous. Mieux vaut le dire que livrer une page vide.
 */
const MAX_ACCEPTABLE_FAILURE_RATIO = 0.5;

export type MediaUploadSummary = {
  uploaded: number;
  failed: number;
  /** Volontairement non ré-hébergés (polices) — hors du calcul de taux. */
  skipped: number;
  /** uploaded + failed, c'est-à-dire les assets réellement TENTÉS. */
  total: number;
  /** true si le taux d'échec dépasse le seuil acceptable. */
  degraded: boolean;
};

/**
 * Upload tous les médias en parallèle (par batch).
 * Mute les assets en place : ajoute uploadedUrl ou uploadFailed.
 *
 * ⚠️ LÈVE `CloudinaryConfigError` si les identifiants sont refusés. C'est
 * VOULU : une configuration invalide fait échouer tous les assets à
 * l'identique, et poursuivre produirait un clone sans aucun média
 * ré-hébergé — le symptôme « clonage réussi, page blanche ».
 */
export async function uploadMediaAssets(
  assets: ClonedMediaAsset[],
  funnelId: string
): Promise<MediaUploadSummary> {
  if (assets.length === 0) {
    console.log("[media-uploader] No media to upload");
    return { uploaded: 0, failed: 0, skipped: 0, total: 0, degraded: false };
  }

  console.log(
    `[media-uploader] Uploading ${assets.length} media(s) to Cloudinary…`
  );

  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  // Découpe en batchs de PARALLEL_UPLOADS
  for (let i = 0; i < assets.length; i += PARALLEL_UPLOADS) {
    const batch = assets.slice(i, i + PARALLEL_UPLOADS);
    const results = await Promise.all(
      batch.map((asset) => uploadSingleAsset(asset, funnelId))
    );

    // 🆕 Arrêt IMMÉDIAT sur erreur de configuration. Sans ce court-circuit, on
    // rejouait le même échec des centaines de fois — un log par asset, et
    // autant de téléchargements inutiles depuis le site source.
    const fatal = results.find((r) => r.fatal);
    if (fatal?.fatal) throw fatal.fatal;

    results.forEach((r) => {
      if (r.skipped) skipped++;
      else if (r.ok) uploaded++;
      else failed++;
    });
  }

  // ⚠️ Les éléments IGNORÉS sortent du dénominateur. Les compter reviendrait à
  // pénaliser un clone pour des polices qu'on a délibérément choisi de ne pas
  // ré-héberger — c'est précisément ce qui faisait tomber le garde-fou à tort.
  const total = uploaded + failed;
  const degraded = total > 0 && failed / total > MAX_ACCEPTABLE_FAILURE_RATIO;

  console.log(
    `[media-uploader] ✅ Done : ${uploaded} uploaded, ${failed} failed, ${skipped} ignorés (polices)`
  );
  if (degraded) {
    console.warn(
      `[media-uploader] ⚠️ ${Math.round((failed / total) * 100)} % des médias n'ont pas pu ` +
        `être ré-hébergés. Le clone restera dépendant du site d'origine et risque ` +
        `d'afficher des trous.`
    );
  }

  return { uploaded, failed, skipped, total, degraded };
}

type SingleAssetResult = {
  ok: boolean;
  /** Erreur FATALE (config refusée) : l'appelant doit interrompre. */
  fatal?: Error;
  /** Volontairement non ré-hébergé (police) : ni succès ni échec. */
  skipped?: boolean;
};

/** Police d'écriture — à ne jamais envoyer à Cloudinary comme image. */
function isFontAsset(url: string): boolean {
  if (/\.(eot|woff2?|ttf|otf)(\?|#|$)/i.test(url)) return true;
  return /\/(webfonts?|fonts?)\//i.test(url) && /\.svg(\?|#|$)/i.test(url);
}

/**
 * Upload un seul asset.
 *
 * Distingue deux natures d'échec :
 *   • config refusée → remontée telle quelle, l'opération entière est perdue ;
 *   • échec propre à cet asset (404, timeout, format) → non fatal, on garde
 *     l'URL d'origine en repli.
 */
async function uploadSingleAsset(
  asset: ClonedMediaAsset,
  funnelId: string
): Promise<SingleAssetResult> {
  try {
    // 🆕 Seconde barrière contre les POLICES. Le parser les écarte désormais
    // à la collecte (cf. isFontUrl dans parser.ts), mais un clone ENREGISTRÉ
    // AVANT ce correctif en contient encore : sans cette garde, les rejouer
    // ferait de nouveau exploser le taux d'échec et bloquerait le clone.
    //
    // Ce n'est pas un échec : on ne tente simplement pas. La police reste
    // servie par le CSS d'origine, ce qui est le comportement attendu.
    if (isFontAsset(asset.sourceUrl)) {
      console.log(`[media-uploader] ⏭️ Police ignorée (non ré-hébergée) : ${asset.sourceUrl}`);
      return { ok: true, skipped: true };
    }

    const buffer = await downloadAsset(asset.sourceUrl);
    if (!buffer) {
      asset.uploadFailed = true;
      return { ok: false };
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
    return { ok: true };
  } catch (err) {
    if (err instanceof CloudinaryConfigError || err instanceof CloudinaryNotConfiguredError) {
      console.error(`[media-uploader] 🛑 Configuration Cloudinary refusée : ${err.message}`);
      asset.uploadFailed = true;
      return { ok: false, fatal: err };
    }
    console.error(
      `[media-uploader] ❌ Exception for ${asset.sourceUrl}: ${(err as Error).message}`
    );
    asset.uploadFailed = true;
    return { ok: false };
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
