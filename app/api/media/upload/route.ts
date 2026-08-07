// app/api/media/upload/route.ts
//
// Endpoint d'upload de médias (images, vidéos).
//
// 🆕 MIGRATION STOCKAGE — destination CLOUDINARY et non plus Supabase Storage
// (bucket saturé à 149 % du quota). Le contrat de réponse est identique, aucun
// appelant côté front n'a été modifié. Voir lib/media/cloudinary.ts.

import { NextRequest, NextResponse } from "next/server";
import {
  uploadBuffer,
  isCloudinaryConfigured,
  CloudinaryNotConfiguredError,
  CloudinaryConfigError,
} from "@/lib/media/cloudinary";

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

// ⚠️ `BUCKET` et `mimeToExt` ont été retirés avec la migration : Cloudinary
// déduit l'extension du contenu et nomme l'asset par son empreinte. Plus de
// bucket Supabase ici.

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
    // Contrôle de configuration AVANT de lire le fichier : inutile de recevoir
    // 15 Mo pour échouer ensuite faute d'identifiants.
    if (!isCloudinaryConfigured()) {
      console.error("[/api/media/upload] Cloudinary non configuré");
      return NextResponse.json(
        { error: new CloudinaryNotConfiguredError().message },
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

    // 3) Dossier de destination chez Cloudinary.
    //
    // Plus de nom de fichier construit à la main : l'identifiant est
    // l'empreinte du CONTENU (cf. lib/media/cloudinary.ts). Deux envois du même
    // fichier retombent donc sur le même asset au lieu d'en créer deux — c'est
    // exactement la duplication qui a saturé Supabase.
    const safeFunnel = sanitizeFilename(funnelId);

    console.log("[/api/media/upload] Dossier:", `uploads/${safeFunnel}`, {
      spot: sanitizeFilename(spotId),
    });

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

    // 5) Upload → CLOUDINARY (et non plus Supabase Storage).
    //
    // Le contrat de réponse est INCHANGÉ ({ url, path, mime, size }) : aucun
    // appelant côté front n'a besoin d'être modifié. `path` porte désormais le
    // `public_id` Cloudinary, qui joue le même rôle d'identifiant stable.
    try {
      const result = await uploadBuffer(buffer, {
        folder: `uploads/${safeFunnel}`,
        mime,
      });

      console.log("[/api/media/upload] Upload Cloudinary OK:", result.publicId);

      return NextResponse.json({
        url: result.url,
        path: result.publicId,
        mime: result.mime,
        size: result.size,
      });
    } catch (err) {
      if (err instanceof CloudinaryNotConfiguredError) {
        console.error("[/api/media/upload]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
      // 🆕 Identifiants présents mais REFUSÉS (cloud_name erroné, clé
      // révoquée…). Le message générique « Échec de l'envoi » envoyait
      // chercher un problème de fichier alors que la configuration est en
      // cause — et le même échec se reproduira à chaque tentative.
      if (err instanceof CloudinaryConfigError) {
        console.error("[/api/media/upload] Configuration refusée :", err.message);
        return NextResponse.json(
          {
            error:
              `Configuration Cloudinary refusée (${err.message}). ` +
              `Vérifie CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET.`,
          },
          { status: 503 },
        );
      }
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("[/api/media/upload] Cloudinary error:", msg);
      return NextResponse.json(
        { error: `Échec de l'envoi du média : ${msg}` },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("[/api/media/upload] Erreur inattendue:", err);
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    // `unknown` plutôt qu'un `any` : la cause d'une Error n'est pas typée, on
    // la lit sans désactiver le typage sur tout l'objet.
    const cause =
      err instanceof Error && "cause" in err
        ? String((err as Error & { cause?: unknown }).cause)
        : "";
    return NextResponse.json(
      {
        error: `Erreur serveur : ${msg}${cause ? ` (cause: ${cause})` : ""}`,
      },
      { status: 500 },
    );
  }
}
