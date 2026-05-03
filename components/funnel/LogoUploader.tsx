// components/funnel/LogoUploader.tsx
"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, RefreshCw } from "lucide-react";

type Props = {
  value?: string;
  brandName?: string;
  onChange: (dataUrl: string | undefined) => void;
  // Taille max en Mo, défaut 2
  maxMb?: number;
};

// Calcule les initiales depuis le nom de marque (max 2 caractères)
function initialsOf(name?: string): string {
  if (!name) return "FF";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Détecte si l'image est carrée, paysage ou portrait pour adapter l'affichage
type Orientation = "square" | "landscape" | "portrait";

function detectOrientation(width: number, height: number): Orientation {
  const ratio = width / height;
  if (ratio > 1.15) return "landscape";
  if (ratio < 0.85) return "portrait";
  return "square";
}

export function LogoUploader({ value, brandName, onChange, maxMb = 2 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [orientation, setOrientation] = useState<Orientation>("square");
  const [error, setError] = useState<string>("");

  function pick() {
    inputRef.current?.click();
  }

  function handleFile(file?: File) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image (PNG, JPG, SVG, WebP)");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`L'image dépasse ${maxMb} Mo`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);

      // Mesure l'orientation pour adapter le rendu sans crop
      const img = new Image();
      img.onload = () => {
        setOrientation(detectOrientation(img.width, img.height));
        onChange(dataUrl);
      };
      img.onerror = () => {
        // SVG ou format non mesurable → on traite comme carré
        setOrientation("square");
        onChange(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => setError("Lecture du fichier impossible");
    reader.readAsDataURL(file);
  }

  function clear() {
    onChange(undefined);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  // Hauteur du conteneur d'aperçu, ajustée selon l'orientation pour ne jamais cropper
  const previewHeight =
    orientation === "landscape" ? "h-16" :
    orientation === "portrait"  ? "h-24" : "h-20";

  const previewWidth =
    orientation === "landscape" ? "w-32" :
    orientation === "portrait"  ? "w-20" : "w-20";

  return (
    <div className="grid gap-2">
      <div
        className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-canvas p-3 transition hover:border-[#08498D]/40"
      >
        {/* Aperçu ou initiales */}
        <div
          className={`grid place-items-center overflow-hidden rounded-lg bg-white ${previewWidth} ${previewHeight}`}
          style={{ border: "1px solid #E2E8F0" }}
        >
          {value ? (
            <img
              src={value}
              alt={brandName ?? "Logo"}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span
              className="text-base font-black"
              style={{ color: "#080E1A" }}
              aria-label="Initiales de la marque"
            >
              {initialsOf(brandName)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="truncate text-sm font-bold text-ink">
            {value ? "Logo importé" : "Aucun logo"}
          </p>
          <p className="truncate text-xs text-muted">
            {value
              ? `Format ${orientation}, conservé sans rognage`
              : `Carré, paysage ou portrait. Max ${maxMb} Mo`}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pick}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-[#08498D]/40"
            >
              {value ? <RefreshCw size={12} /> : <ImagePlus size={12} />}
              {value ? "Remplacer" : "Importer"}
            </button>
            {value && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1.5 rounded-md border border-red/30 bg-white px-2.5 py-1.5 text-xs font-bold text-red transition hover:bg-red/5"
              >
                <Trash2 size={12} />
                Retirer
              </button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <p className="text-xs font-semibold text-red">{error}</p>
      )}
    </div>
  );
}
