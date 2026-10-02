export type BackgroundRemovalResult = {
  dataUrl: string;
  removedPixels: number;
  totalPixels: number;
};

type Rgb = readonly [number, number, number];

const DEFAULT_TOLERANCE = 52;

function colorDistance(data: Uint8ClampedArray, offset: number, color: Rgb) {
  const red = data[offset] - color[0];
  const green = data[offset + 1] - color[1];
  const blue = data[offset + 2] - color[2];
  return Math.sqrt(red * red + green * green + blue * blue);
}

function cornerColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb[] {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ] as const;

  return points
    .map(([x, y]) => {
      const offset = (y * width + x) * 4;
      return [data[offset], data[offset + 1], data[offset + 2]] as Rgb;
    })
    .filter((_, index, colors) => {
      const [red, green, blue] = colors[index];
      return colors.findIndex(
        (candidate) =>
          Math.abs(candidate[0] - red) < 4 &&
          Math.abs(candidate[1] - green) < 4 &&
          Math.abs(candidate[2] - blue) < 4,
      ) === index;
    });
}

/**
 * Supprime uniquement le fond ressemblant aux coins ET relié aux bords.
 * Cette contrainte évite d'effacer une couleur similaire située à l'intérieur
 * du sujet (par exemple le bleu sombre d'une couverture d'ebook).
 */
export function removeConnectedEdgeBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = DEFAULT_TOLERANCE,
): number {
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    return 0;
  }

  // Une image déjà détourée ne doit jamais subir un second chroma-key : les
  // pixels RGB invisibles sont souvent noirs et pourraient alors entraîner
  // par erreur une partie sombre du sujet dans le flood-fill.
  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (pixels[offset] < 250) return 0;
  }

  const colors = cornerColors(pixels, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let removed = 0;

  const resemblesBackground = (pixelIndex: number) => {
    const offset = pixelIndex * 4;
    if (pixels[offset + 3] === 0) return true;
    return colors.some(
      (color) => colorDistance(pixels, offset, color) <= tolerance,
    );
  };

  const enqueue = (pixelIndex: number) => {
    if (visited[pixelIndex] || !resemblesBackground(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const offset = pixelIndex * 4;
    if (pixels[offset + 3] !== 0) {
      pixels[offset + 3] = 0;
      removed += 1;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y + 1 < height) enqueue(pixelIndex + width);
  }

  return removed;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de lire cette image."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.92);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Résultat d'image invalide."));
    reader.onerror = () => reject(new Error("Impossible de convertir l'image."));
    reader.readAsDataURL(blob);
  });
}

export async function removeImageEdgeBackground(
  src: string,
): Promise<BackgroundRemovalResult> {
  const image = await loadImage(src);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Le détourage n'est pas disponible sur ce navigateur.");

  context.drawImage(image, 0, 0, width, height);
  let imageData: ImageData;
  try {
    imageData = context.getImageData(0, 0, width, height);
  } catch {
    throw new Error(
      "Le serveur de cette image interdit son détourage. Télécharge-la puis importe-la directement.",
    );
  }

  const removedPixels = removeConnectedEdgeBackground(
    imageData.data,
    width,
    height,
  );
  context.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas);
  const dataUrl = blob ? await blobToDataUrl(blob) : canvas.toDataURL("image/png");
  return { dataUrl, removedPixels, totalPixels: width * height };
}
