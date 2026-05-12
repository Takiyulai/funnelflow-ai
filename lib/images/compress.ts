// lib/images/compress.ts
"use client";

export type CompressMimeType =
  | "image/jpeg"
  | "image/webp"
  | "image/png"
  | "preserve";

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: CompressMimeType;
};

export type CompressResult = {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
  hasAlpha: boolean;
};

const DEFAULTS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  mimeType: "preserve" as CompressMimeType,
};

/** Source décodée prête à être dessinée sur un canvas */
type DecodedSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  console.log("[compressImage] start", {
    name: file.name,
    type: file.type,
    size: file.size,
    options,
  });

  if (!file) throw new Error("Aucun fichier fourni.");

  const isImage =
    file.type.startsWith("image/") || /\.(svg|heic|heif)$/i.test(file.name);
  if (!isImage) {
    throw new Error(
      `Le fichier n'est pas une image (type détecté : "${file.type || "inconnu"}").`,
    );
  }

  const opts = {
    maxWidth: Math.max(1, options.maxWidth ?? DEFAULTS.maxWidth),
    maxHeight: Math.max(1, options.maxHeight ?? DEFAULTS.maxHeight),
    quality: clamp(options.quality ?? DEFAULTS.quality, 0, 1),
    mimeType: options.mimeType ?? DEFAULTS.mimeType,
  };

  // SVG : passthrough
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    const dataUrl = await fileToDataUrl(file);
    console.log("[compressImage] SVG passthrough");
    return {
      dataUrl,
      sizeBytes: file.size,
      width: 0,
      height: 0,
      mimeType: "image/svg+xml",
      hasAlpha: true,
    };
  }

  // Décodage robuste avec cascade : createImageBitmap → <img> blob: → <img> dataURL
  let decoded: DecodedSource;
  try {
    decoded = await decodeFileRobust(file);
    console.log("[compressImage] decoded", {
      w: decoded.width,
      h: decoded.height,
    });
  } catch (err) {
    console.error("[compressImage] decode error", err);
    throw new Error(
      `Impossible de décoder l'image "${file.name}" (${file.type || "type inconnu"}). Essaie de la convertir en JPEG, PNG ou WebP.`,
    );
  }

  try {
    const { width, height } = fitWithin(
      decoded.width,
      decoded.height,
      opts.maxWidth,
      opts.maxHeight,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const hasAlpha = detectAlpha(ctx, width, height);
    console.log("[compressImage] hasAlpha", hasAlpha);

    // Choix du mime de sortie
    let outMime: "image/jpeg" | "image/webp" | "image/png";
    if (opts.mimeType === "preserve") {
      if (hasAlpha) {
        outMime = file.type === "image/png" ? "image/png" : "image/webp";
      } else {
        outMime = "image/jpeg";
      }
    } else {
      outMime = opts.mimeType;
    }
    console.log("[compressImage] outMime (initial)", outMime);

    const buildJpegCanvas = (): HTMLCanvasElement => {
      const tmp = document.createElement("canvas");
      tmp.width = width;
      tmp.height = height;
      const tctx = tmp.getContext("2d")!;
      tctx.fillStyle = "#ffffff";
      tctx.fillRect(0, 0, width, height);
      tctx.drawImage(canvas, 0, 0);
      return tmp;
    };

    let finalCanvas = outMime === "image/jpeg" ? buildJpegCanvas() : canvas;
    let blob = await canvasToBlob(finalCanvas, outMime, opts.quality);

    if (!blob && outMime === "image/webp") {
      console.warn("[compressImage] WebP failed, falling back to PNG");
      outMime = "image/png";
      blob = await canvasToBlob(canvas, "image/png", opts.quality);
    }

    if (!blob && outMime !== "image/jpeg") {
      console.warn("[compressImage] ultimate fallback to JPEG");
      outMime = "image/jpeg";
      finalCanvas = buildJpegCanvas();
      blob = await canvasToBlob(finalCanvas, "image/jpeg", opts.quality);
    }

    if (!blob) throw new Error("Échec définitif de la conversion canvas → Blob.");

    const dataUrl = await blobToDataUrl(blob);
    console.log("[compressImage] done", {
      bytes: blob.size,
      mime: outMime,
      w: width,
      h: height,
    });

    return {
      dataUrl,
      sizeBytes: blob.size,
      width,
      height,
      mimeType: outMime,
      hasAlpha: outMime !== "image/jpeg" && hasAlpha,
    };
  } finally {
    decoded.cleanup();
  }
}

/* ------------------------------- Décodage robuste ------------------------ */

/**
 * Décode un fichier image avec une cascade de stratégies :
 *  1. createImageBitmap(file) — moderne, gère EXIF orientation, plus tolérant
 *  2. <img> + URL.createObjectURL — fallback classique
 *  3. <img> + dataURL — dernier recours pour les blobs problématiques
 */
async function decodeFileRobust(file: File): Promise<DecodedSource> {
  // Stratégie 1 : createImageBitmap (préféré)
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      console.log("[decodeFileRobust] strategy=createImageBitmap OK", {
        w: bitmap.width,
        h: bitmap.height,
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch (err) {
      console.warn("[decodeFileRobust] createImageBitmap failed:", err);
    }
  }

  // Stratégie 2 : <img> + blob: URL
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromSrc(objectUrl);
    console.log("[decodeFileRobust] strategy=img+blob OK");
    return {
      source: img,
      width: img.naturalWidth || img.width || 1,
      height: img.naturalHeight || img.height || 1,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    console.warn("[decodeFileRobust] img+blob failed:", err);
  }

  // Stratégie 3 : <img> + dataURL (lent mais très tolérant)
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImageFromSrc(dataUrl);
    console.log("[decodeFileRobust] strategy=img+dataURL OK");
    return {
      source: img,
      width: img.naturalWidth || img.width || 1,
      height: img.naturalHeight || img.height || 1,
      cleanup: () => {},
    };
  } catch (err) {
    console.error("[decodeFileRobust] all strategies failed");
    throw err;
  }
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

/* ------------------------------- Autres helpers -------------------------- */

function fitWithin(srcW: number, srcH: number, maxW: number, maxH: number) {
  if (srcW <= 0 || srcH <= 0) return { width: maxW, height: maxH };
  const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
  return {
    width: Math.max(1, Math.round(srcW * ratio)),
    height: Math.max(1, Math.round(srcH * ratio)),
  };
}

function detectAlpha(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  try {
    const points: Array<[number, number]> = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    for (let i = 0; i < 40; i++) {
      points.push([
        Math.floor(Math.random() * width),
        Math.floor(Math.random() * height),
      ]);
    }
    for (const [x, y] of points) {
      const px = ctx.getImageData(x, y, 1, 1).data;
      if (px[3] < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    } catch {
      resolve(null);
    }
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Lecture Blob invalide."));
    reader.onerror = () => reject(new Error("Erreur lecture Blob."));
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Lecture fichier invalide."));
    reader.onerror = () => reject(new Error("Erreur lecture fichier."));
    reader.readAsDataURL(file);
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
