// app/api/media/upload/route.ts
//
// Endpoint d'upload de médias (images, vidéos) vers Supabase Storage.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);

const BUCKET = "cloned-funnels-media";

function mimeToExt(mime: string, fallbackName: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
  };
  if (map[mime]) return map[mime];
  // Fallback : extension depuis le nom de fichier
  const m = fallbackName.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
}

function sanitizeFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "file"
  );
}

export async function POST(req: NextRequest) {
  console.log("[/api/media/upload] === Nouvelle requête ===");

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("[/api/media/upload] Missing env vars");
      return NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 },
      );
    }

    // 1) Parsing
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error("[/api/media/upload] formData parse error:", err);
      return NextResponse.json(
        { error: "Corps de requête invalide." },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    const spotId = (formData.get("spotId") as string) || "unknown";
    const funnelId = (formData.get("funnelId") as string) || "anonymous";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier fourni (champ 'file' manquant)." },
        { status: 400 },
      );
    }

    console.log("[/api/media/upload] Fichier reçu:", {
      name: file.name,
      type: file.type,
      size: file.size,
      spotId,
      funnelId,
    });

    // 2) Validations
    if (file.size === 0) {
      return NextResponse.json(
        { error: "Le fichier est vide (0 octet)." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum : ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 413 },
      );
    }

    let mime = (file.type || "").toLowerCase().trim();

    // Si pas de MIME, on essaie de deviner depuis le nom de fichier
    if (!mime) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const guessMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        svg: "image/svg+xml",
        avif: "image/avif",
        bmp: "image/bmp",
        heic: "image/heic",
        heif: "image/heif",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
      };
      mime = guessMap[ext] || "application/octet-stream";
      console.log("[/api/media/upload] MIME deviné depuis l'extension:", mime);
    }

    if (!ALLOWED_MIMES.has(mime)) {
      console.warn("[/api/media/upload] MIME refusé:", mime);
      return NextResponse.json(
        {
          error: `Type de fichier non autorisé : "${mime}". Formats acceptés : images (jpg, png, webp, gif, svg, avif, heic) et vidéos (mp4, webm, mov).`,
        },
        { status: 415 },
      );
    }

    // 3) Chemin de destination
    const ext = mimeToExt(mime, file.name);
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safeSpot = sanitizeFilename(spotId);
    const safeFunnel = sanitizeFilename(funnelId);
    const path = `user-uploads/${safeFunnel}/${safeSpot}-${ts}-${rand}.${ext}`;

    console.log("[/api/media/upload] Destination:", path);

    // 4) Buffer
    let buffer: Buffer;
    try {
      const ab = await file.arrayBuffer();
      buffer = Buffer.from(ab);
    } catch (err) {
      console.error("[/api/media/upload] Erreur lecture fichier:", err);
      return NextResponse.json(
        { error: "Impossible de lire le contenu du fichier." },
        { status: 500 },
      );
    }

    // 5) Upload
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: upErr, data: upData } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (upErr) {
      console.error("[/api/media/upload] Supabase error:", {
        message: upErr.message,
        name: upErr.name,
        stack: upErr.stack,
      });
      return NextResponse.json(
        {
          error: `Échec Supabase : ${upErr.message}`,
          details: {
            name: upErr.name,
            bucket: BUCKET,
            path,
          },
        },
        { status: 500 },
      );
    }

    console.log("[/api/media/upload] Upload OK:", upData);

    // 6) URL publique
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    console.log("[/api/media/upload] URL publique:", pub.publicUrl);

    return NextResponse.json({
      url: pub.publicUrl,
      path,
      mime,
      size: file.size,
    });
  } catch (err) {
    console.error("[/api/media/upload] Erreur inattendue:", err);
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    const cause =
      err instanceof Error && "cause" in err ? String((err as any).cause) : "";
    return NextResponse.json(
      {
        error: `Erreur serveur : ${msg}${cause ? ` (cause: ${cause})` : ""}`,
      },
      { status: 500 },
    );
  }
}
