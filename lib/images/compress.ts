// Compression côté client d'une image en data URL JPEG
// Cible : largeur max 1600 px, qualité 0.82, format JPEG
// Retourne un data URL prêt à être stocké dans localStorage

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  mimeType?: "image/jpeg" | "image/webp";
};

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  mimeType: "image/jpeg",
};

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<{ dataUrl: string; sizeBytes: number; width: number; height: number }> {
  const opts = { ...DEFAULTS, ...options };

  const originalDataUrl = await readAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  const { width, height } = fitWithin(img.width, img.height, opts.maxWidth, opts.maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback : si canvas indisponible, renvoie l'original
    return {
      dataUrl: originalDataUrl,
      sizeBytes: estimateSize(originalDataUrl),
      width: img.width,
      height: img.height,
    };
  }

  // Fond blanc pour les PNG transparents quand on convertit en JPEG
  if (opts.mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(opts.mimeType, opts.quality);
  return {
    dataUrl,
    sizeBytes: estimateSize(dataUrl),
    width,
    height,
  };
}

// ─── helpers ───────────────────────────────────────────────────────

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("read-failed"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

function fitWithin(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (w <= maxW && h <= maxH) return { width: w, height: h };
  const ratio = Math.min(maxW / w, maxH / h);
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

// Approximation du poids du data URL (base64 ≈ 1.37× la taille binaire)
function estimateSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.floor((base64.length * 3) / 4);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
