// lib/media/cloudinary.ts
//
// 🆕 MIGRATION STOCKAGE — Brique unique d'envoi de médias vers Cloudinary.
//
// POURQUOI ON QUITTE SUPABASE STORAGE. Le bucket `cloned-funnels-media` avait
// atteint 1,46 Go sur 1 Go autorisés — soit 149 % — et les requêtes devaient
// être restreintes au 12 août 2026. La cause est structurelle : chaque clonage
// d'un site ré-héberge l'intégralité de ses images, et un même site cloné
// quatre fois occupait quatre fois la place.
//
// Cloudinary règle les deux problèmes à la fois :
//   • le stockage sort du backend, conformément à la philosophie du produit
//     (AutoFunnel génère des pages, il n'héberge pas de médiathèque) ;
//   • la livraison passe par `f_auto,q_auto`, qui sert du WebP/AVIF selon le
//     navigateur. Sur un parc composé à 72 % de JPEG non optimisés, c'est là
//     que se joue la consommation de crédits, bien plus que sur le stockage.
//
// 🔒 SERVEUR UNIQUEMENT. `CLOUDINARY_API_SECRET` signe les requêtes : exposée
// côté client, elle permettrait à n'importe qui d'uploader et de supprimer sur
// le compte. Ce module ne doit jamais être importé depuis un composant client.

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { createHash } from "crypto";

/** Dossier racine chez Cloudinary. Tout vit dessous, pour pouvoir purger ou
 *  déplacer l'ensemble d'un seul geste depuis leur console. */
export const CLOUDINARY_ROOT = "autofunnel";

export type MediaUploadResult = {
  /** URL de livraison optimisée (f_auto,q_auto). C'est CELLE-CI qu'on stocke. */
  url: string;
  /** Identifiant Cloudinary, requis pour supprimer ou transformer plus tard. */
  publicId: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
};

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super(
      "Cloudinary n'est pas configuré : CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requises côté serveur.",
    );
  }
}

let configured = false;

/** Configure le SDK une seule fois par processus. */
function ensureConfigured(): void {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) throw new CloudinaryNotConfiguredError();

  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/**
 * Empreinte du CONTENU d'un fichier.
 *
 * Sert d'identifiant Cloudinary : deux fichiers identiques produisent le même
 * `public_id` et n'occupent donc qu'une seule place. C'est ce qui met fin à la
 * duplication constatée sur Supabase, où un même site cloné quatre fois
 * stockait quatre copies de chaque image.
 *
 * Effet secondaire précieux : l'opération devient IDEMPOTENTE. Rejouer un
 * import ou le script de migration ne crée pas de doublon.
 */
export function contentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 32);
}

/** Les SVG ne sont pas des bitmaps : `f_auto,q_auto` n'a pas de sens dessus et
 *  Cloudinary les rastériserait. On les livre bruts. */
function isVectorOrRaw(mime: string): boolean {
  return mime === "image/svg+xml";
}

/**
 * URL de livraison. C'est ici que se joue l'essentiel de l'économie :
 * `f_auto` choisit le format selon le navigateur, `q_auto` la compression.
 */
export function deliveryUrl(
  publicId: string,
  resourceType: "image" | "video",
  mime: string,
): string {
  ensureConfigured();
  if (isVectorOrRaw(mime)) {
    return cloudinary.url(publicId, { resource_type: resourceType, secure: true });
  }
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
    fetch_format: "auto",
    quality: "auto",
  });
}

/**
 * Envoie un buffer vers Cloudinary.
 *
 * @param folder sous-dossier sous `autofunnel/` (ex. `clone/<funnelId>`)
 * @param overwrite `false` par défaut : si l'empreinte existe déjà, Cloudinary
 *        renvoie l'asset existant au lieu de le réécrire. C'est voulu — le
 *        contenu étant identique, le réécrire ne ferait que consommer des
 *        crédits.
 */
export async function uploadBuffer(
  buffer: Buffer,
  opts: {
    folder: string;
    mime: string;
    /** Identifiant stable ; par défaut l'empreinte du contenu. */
    publicId?: string;
  },
): Promise<MediaUploadResult> {
  ensureConfigured();

  const isVideo = opts.mime.startsWith("video/");
  const resourceType: "image" | "video" = isVideo ? "video" : "image";
  const publicId = opts.publicId ?? contentHash(buffer);
  const folder = `${CLOUDINARY_ROOT}/${opts.folder}`.replace(/\/+/g, "/");

  const response = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        // `unique_filename: false` + public_id = empreinte → un contenu
        // identique retombe toujours sur le même asset.
        unique_filename: false,
        // Les SVG sont refusés par défaut sur les comptes récents (vecteur
        // XSS). On les autorise explicitement : ils viennent de sites clonés
        // et sont rendus dans une iframe cloisonnée.
        ...(opts.mime === "image/svg+xml" ? { flags: "sanitize" } : {}),
      },
      (error, result) => {
        if (error) return reject(new Error(error.message));
        if (!result) return reject(new Error("Cloudinary : réponse vide."));
        resolve(result);
      },
    );
    stream.end(buffer);
  });

  return {
    url: deliveryUrl(response.public_id, resourceType, opts.mime),
    publicId: response.public_id,
    mime: opts.mime,
    size: response.bytes ?? buffer.length,
    width: response.width,
    height: response.height,
  };
}

/** Supprime un asset. Utilisé par le nettoyage des médias orphelins. */
export async function destroyAsset(
  publicId: string,
  resourceType: "image" | "video" = "image",
): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/** Une URL pointe-t-elle déjà vers Cloudinary ? Sert au script de migration
 *  pour ne pas retraiter ce qui l'a déjà été. */
export function isCloudinaryUrl(url: string): boolean {
  return /https?:\/\/res\.cloudinary\.com\//i.test(url);
}

/** Une URL pointe-t-elle vers l'ancien Supabase Storage ? */
export function isSupabaseStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\/public\/cloned-funnels-media\//i.test(url);
}
