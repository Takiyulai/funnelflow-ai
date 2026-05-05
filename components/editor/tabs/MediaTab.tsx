"use client";

import {
  Upload,
  Trash2,
  Video as VideoIcon,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import type {
  FunnelSection,
  Language,
  ImageMode,
  VideoSource,
} from "@/lib/funnels/types";
import { compressImage, formatBytes } from "@/lib/images/compress";

type Props = {
  section: FunnelSection;
  language: Language;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const MAX_INPUT_SIZE = 8 * 1024 * 1024; // 8 Mo en entrée

export function MediaTab({ section, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastSize, setLastSize] = useState<number | null>(null);

  const imageMode: ImageMode = section.image?.mode ?? "none";
  const imageUrl = section.image?.url ?? "";
  const imageAlt = section.image?.alt ?? "";

  const setImageMode = (mode: ImageMode) => {
    if (mode === "none") {
      onChange({ image: { mode: "none" } });
    } else {
      onChange({
        image: {
          ...(section.image ?? {}),
          mode,
        },
      });
    }
  };

  const handleFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Le fichier doit être une image");
      return;
    }
    if (file.size > MAX_INPUT_SIZE) {
      setUploadError(
        `Image trop lourde (${formatBytes(file.size)}). Limite en entrée : 8 Mo.`,
      );
      return;
    }
    setUploading(true);
    try {
      const result = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        mimeType: "image/jpeg",
      });
      setLastSize(result.sizeBytes);
      onChange({
        image: {
          mode: "upload",
          url: result.dataUrl,
          alt: section.image?.alt ?? "",
        },
      });
    } catch {
      setUploadError("Échec de la compression de l'image");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    onChange({ image: { mode: "none" } });
    setLastSize(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Video ──────────────────────────────────────────────────────
  const video: VideoSource | undefined = section.video;
  const updateVideo = (patch: Partial<VideoSource>) => {
    const provider: VideoSource["provider"] =
      patch.provider ?? video?.provider ?? "youtube";
    const url = patch.url ?? video?.url ?? "";
    if (!url) {
      onChange({ video: undefined });
      return;
    }
    onChange({
      video: {
        provider,
        url,
        posterUrl: patch.posterUrl ?? video?.posterUrl,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Image ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-white/60" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Image
          </h3>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <ModeBtn active={imageMode === "none"} onClick={() => setImageMode("none")}>
            Aucune
          </ModeBtn>
          <ModeBtn
            active={imageMode === "ai-suggested"}
            onClick={() => setImageMode("ai-suggested")}
          >
            Suggestion IA
          </ModeBtn>
          <ModeBtn active={imageMode === "upload"} onClick={() => setImageMode("upload")}>
            Upload
          </ModeBtn>
        </div>

        {imageMode === "upload" && (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/30 px-4 py-6 text-xs text-white/60 hover:border-amber-300/40 hover:text-amber-300 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compression…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {imageUrl ? "Remplacer l'image" : "Choisir une image (max 8 Mo)"}
                </>
              )}
            </button>
            {uploadError && (
              <p className="flex items-start gap-1 text-[11px] text-rose-300">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {uploadError}
              </p>
            )}
            {lastSize !== null && !uploadError && (
              <p className="text-[10px] text-white/40">
                Image compressée à {formatBytes(lastSize)}
              </p>
            )}
          </div>
        )}

        {imageMode === "ai-suggested" && (
          <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/50">
            L'image sera générée/proposée par l'IA lors d'une régénération
            (disponible Phase C-2).
          </p>
        )}

        {/* Preview + alt + remove */}
        {imageUrl && imageMode !== "none" && (
          <div className="mt-3 space-y-2">
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={imageAlt || "Aperçu"}
                className="h-auto max-h-48 w-full object-contain"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute right-2 top-2 rounded-md bg-black/70 p-1 text-white/80 hover:bg-rose-500/80"
                title="Retirer l'image"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <input
              type="text"
              value={imageAlt}
              onChange={(e) =>
                onChange({
                  image: {
                    mode: imageMode,
                    url: imageUrl,
                    alt: e.target.value,
                  },
                })
              }
              className={inputClass}
              placeholder="Texte alternatif (alt) pour l'accessibilité"
            />
          </div>
        )}
      </section>

      <div className="border-t border-white/10" />

      {/* ─── Video ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <VideoIcon className="h-4 w-4 text-white/60" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Vidéo
          </h3>
        </div>

        <div className="space-y-2">
          <Field label="Provider">
            <div className="flex flex-wrap gap-1.5">
              <ModeBtn
                active={(video?.provider ?? "youtube") === "youtube"}
                onClick={() => updateVideo({ provider: "youtube" })}
              >
                YouTube
              </ModeBtn>
              <ModeBtn
                active={video?.provider === "vimeo"}
                onClick={() => updateVideo({ provider: "vimeo" })}
              >
                Vimeo
              </ModeBtn>
              <ModeBtn
                active={video?.provider === "url"}
                onClick={() => updateVideo({ provider: "url" })}
              >
                URL directe
              </ModeBtn>
              <ModeBtn
                active={video?.provider === "upload"}
                onClick={() => updateVideo({ provider: "upload" })}
              >
                Upload
              </ModeBtn>
            </div>
          </Field>

          <Field label="URL de la vidéo">
            <input
              type="url"
              value={video?.url ?? ""}
              onChange={(e) => updateVideo({ url: e.target.value })}
              className={inputClass}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </Field>

          <Field label="Poster (image de couverture, optionnel)">
            <input
              type="url"
              value={video?.posterUrl ?? ""}
              onChange={(e) => updateVideo({ posterUrl: e.target.value })}
              className={inputClass}
              placeholder="https://exemple.com/poster.jpg"
            />
          </Field>

          {video?.url && (
            <button
              type="button"
              onClick={() => onChange({ video: undefined })}
              className="flex items-center gap-1 text-[11px] text-rose-300/80 hover:text-rose-200"
            >
              <Trash2 className="h-3 w-3" />
              Retirer la vidéo
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-300/40 placeholder:text-white/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-white/70">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
