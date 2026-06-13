// lib/clone/media-downloader.ts
//
// Télécharge une image/média distant et la rehoste sur le storage Supabase
// du projet. Utilisé notamment quand l'utilisateur veut "détacher" une image
// de fond clonée de son CDN d'origine.

import { createClient } from "@supabase/supabase-js";

export interface RehostResult {
  url: string;       // URL publique Supabase
  path: string;      // chemin dans le bucket
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase env vars manquantes (URL ou SERVICE_ROLE_KEY).");
  }

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

  // 2. Construire le chemin
  const ext = mimeToExt(contentType);
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `rehosted/${timestamp}-${rand}.${ext}`;

  // 3. Upload
  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.storage
    .from("cloned-funnels-media")
    .upload(path, buf, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: pub } = supabase.storage.from("cloned-funnels-media").getPublicUrl(path);

  return {
    url: pub.publicUrl,
    path,
    mime: contentType,
    size: buf.length,
  };
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "image/svg+xml": return "svg";
    case "image/avif": return "avif";
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    default: return "bin";
  }
}
