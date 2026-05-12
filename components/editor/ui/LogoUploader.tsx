"use client";

import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

type Props = {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  /** Taille max en Mo (défaut : 2 Mo) */
  maxSizeMb?: number;
  /** Label optionnel au-dessus de la zone */
  label?: string;
};

const ACCEPTED = "image/png,image/jpeg,image/webp,image/svg+xml";

export function LogoUploader({
  value,
  onChange,
  maxSizeMb = 2,
  label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (file: File) => {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image (PNG, JPG, WEBP, SVG).");
      return;
    }
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`Image trop lourde (max ${maxSizeMb} Mo).`);
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onChange(result);
      } else {
        setError("Impossible de lire le fichier.");
      }
      setLoading(false);
    };
    reader.onerror = () => {
      setError("Erreur de lecture du fichier.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Permet de ré-uploader le même fichier après suppression
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const handleRemove = () => {
    onChange(undefined);
    setError(null);
  };

  const handleClick = () => inputRef.current?.click();

  return (
    <div>
      {label && (
        <div className="mb-1 text-xs font-medium text-white/70">{label}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onInputChange}
        className="hidden"
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/60 p-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5">
            <img
              src={value}
              alt="Logo"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-white/90">Logo importé</div>
            <div className="text-[11px] text-white/50">
              Cliquez sur « Remplacer » pour en charger un autre
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={handleClick}
              className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:border-amber-300/40 hover:text-amber-300"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
            >
              <X className="h-3 w-3" />
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={[
            "w-full rounded-lg border-2 border-dashed p-5 text-center transition-colors",
            dragOver
              ? "border-amber-300/60 bg-amber-300/5"
              : "border-white/15 bg-zinc-950/40 hover:border-white/30 hover:bg-zinc-950/60",
          ].join(" ")}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
              ) : (
                <Upload className="h-4 w-4 text-white/60" />
              )}
            </div>
            <div className="text-xs font-medium text-white/80">
              {loading ? "Chargement…" : "Cliquer ou déposer un logo ici"}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <ImageIcon className="h-3 w-3" />
              PNG, JPG, WEBP, SVG · max {maxSizeMb} Mo
            </div>
          </div>
        </button>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
