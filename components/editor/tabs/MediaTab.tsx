"use client";

import {
  Upload,
  Trash2,
  Video as VideoIcon,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type {
  Funnel,
  FunnelSection,
  Language,
  ImageMode,
  ImageSize,
  ImageAnimation,
  SectionImage,
  SectionBackground,
  VideoSource,
} from "@/lib/funnels/types";
import { compressImage, formatBytes } from "@/lib/images/compress";
import { materializeSectionImage } from "@/lib/funnels/resolveMedia";

type Props = {
  section: FunnelSection;
  language: Language;
  funnel: Funnel;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const MAX_INPUT_SIZE = 8 * 1024 * 1024;
const MAX_BG_SIZE = 6 * 1024 * 1024;

const SIZE_OPTIONS: { value: ImageSize; label: string; hint: string }[] = [
  { value: "sm", label: "S", hint: "320px" },
  { value: "md", label: "M", hint: "480px" },
  { value: "lg", label: "L", hint: "720px" },
  { value: "full", label: "Full", hint: "100%" },
  { value: "custom", label: "Custom", hint: "px" },
];

const ANIMATION_OPTIONS: { value: ImageAnimation; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "fade-in", label: "Fade in" },
  { value: "fade-up", label: "Fade up" },
  { value: "zoom-in", label: "Zoom in" },
  { value: "slide-left", label: "Slide ←" },
  { value: "slide-right", label: "Slide →" },
  { value: "float", label: "Float (boucle)" },
  { value: "pulse", label: "Pulse (boucle)" },
];

const BG_POSITION_OPTIONS: {
  value: NonNullable<SectionBackground["position"]>;
  label: string;
}[] = [
  { value: "center", label: "Centre" },
  { value: "top", label: "Haut" },
  { value: "bottom", label: "Bas" },
  { value: "left", label: "Gauche" },
  { value: "right", label: "Droite" },
];

export function MediaTab({ section, funnel, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [lastSize, setLastSize] = useState<number | null>(null);
  const [lastBgSize, setLastBgSize] = useState<number | null>(null);

  // ── Image principale — résolution mediaRef → url ──────────────
  // Si le wizard a posé section.image.mediaRef sans url, on matérialise
  // l'URL depuis funnel.media[] et on patch la section au montage.
  useEffect(() => {
    if (!section.image) return;
    if (section.image.url) return; // déjà résolu
    if (!section.image.mediaRef) return; // rien à résoudre
    const materialized = materializeSectionImage(section.image, funnel);
    if (materialized && materialized.url && materialized.url !== section.image.url) {
      onChange({ image: materialized });
    }
    // On veut résoudre seulement quand mediaRef change, pas à chaque render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.image?.mediaRef, section.image?.url]);

  // Pour l'affichage immédiat (avant que le patch ait pris effet), on
  // utilise la version matérialisée sans la sauvegarder.
  const resolvedImage: SectionImage | undefined = materializeSectionImage(
    section.image,
    funnel
  );
  const image = resolvedImage ?? section.image;
  const imageMode: ImageMode = image?.mode ?? "none";
  const imageUrl = image?.url ?? "";
  const imageAlt = image?.alt ?? "";
  const hasImage = Boolean(imageUrl) && imageMode === "upload";

  const transparentBg = image?.transparentBg === true;
  const size: ImageSize = image?.size ?? "lg";
  const customWidth = image?.customWidth ?? 480;
  const animation: ImageAnimation = image?.animation ?? "none";

  const updateImage = (patch: Partial<SectionImage>) => {
    if (!image) return;
    onChange({ image: { ...image, ...patch } });
  };

  const handleFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Le fichier doit être une image");
      return;
    }
    if (file.size > MAX_INPUT_SIZE) {
      setUploadError(
        `Image trop lourde (${formatBytes(file.size)}). Limite : 8 Mo.`
      );
      return;
    }
    setUploading(true);
    try {
      const result = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        mimeType: "preserve",
      });
      setLastSize(result.sizeBytes);
      const autoTransparent = result.hasAlpha;

      onChange({
        image: {
          mode: "upload",
          url: result.dataUrl,
          alt: section.image?.alt ?? "",
          transparentBg: section.image?.transparentBg ?? autoTransparent,
          size: section.image?.size ?? "lg",
          customWidth: section.image?.customWidth,
          animation: section.image?.animation,
        },
      });
    } catch (e) {
      console.error("[MediaTab] handleFile error:", e);
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setUploadError(
        `Ce fichier ne peut pas être lu par le navigateur. ` +
          `Ouvre-le dans Paint ou Photos et ré-enregistre-le en JPEG, ` +
          `puis ré-essaie. (Détail : ${msg})`
      );
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    onChange({ image: { mode: "none" } });
    setLastSize(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Vidéo ─────────────────────────────────────────────────────
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
        posterUrl: video?.posterUrl,
      },
    });
  };

  // ── Fond de section ────────────────────────────────────────────
  const bg = section.background;
  const bgUrl = bg?.imageUrl ?? "";
  const hasBg = Boolean(bgUrl);
  const bgOverlay = bg?.overlay ?? 0;
  const bgPosition: NonNullable<SectionBackground["position"]> =
    bg?.position ?? "center";
  const bgSize: NonNullable<SectionBackground["size"]> = bg?.size ?? "cover";

  const updateBackground = (patch: Partial<SectionBackground>) => {
    onChange({
      background: {
        imageUrl: bg?.imageUrl,
        overlay: bg?.overlay ?? 0,
        position: bg?.position ?? "center",
        size: bg?.size ?? "cover",
        ...patch,
      },
    });
  };

  const handleBackgroundFile = async (file: File) => {
    setBgError(null);
    if (!file.type.startsWith("image/")) {
      setBgError("Le fichier doit être une image");
      return;
    }
    if (file.size > MAX_BG_SIZE) {
      setBgError(
        `Image trop lourde (${formatBytes(file.size)}). Limite : 6 Mo.`
      );
      return;
    }
    setBgUploading(true);
    try {
      const result = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1280,
        quality: 0.82,
        mimeType: "preserve",
      });
      setLastBgSize(result.sizeBytes);
      updateBackground({ imageUrl: result.dataUrl });
    } catch (e) {
      console.error("[MediaTab.handleBackgroundFile]", e);
      setBgError(
        e instanceof Error ? e.message : "Échec de la compression de l'image"
      );
    } finally {
      setBgUploading(false);
    }
  };

  const removeBackground = () => {
    onChange({ background: undefined });
    setLastBgSize(null);
    if (bgInputRef.current) bgInputRef.current.value = "";
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

        {!hasImage && (
          <>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/30 px-4 py-8 text-xs text-white/60 hover:border-amber-300/40 hover:text-amber-300 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compression…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choisir une image (max 8 Mo)
                </>
              )}
            </button>
            {uploadError && (
              <p className="mt-2 flex items-start gap-1 text-[11px] text-rose-300">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {uploadError}
              </p>
            )}
          </>
        )}

        {hasImage && (
          <div className="space-y-3">
            <div
              className={[
                "relative overflow-hidden rounded-lg border border-white/10",
                transparentBg ? "ff-checker" : "bg-black/40",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={imageAlt || "Aperçu"}
                className="h-auto max-h-48 w-full object-contain"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-white/80 hover:bg-rose-500/80 transition-colors"
                title="Retirer l'image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70 hover:border-amber-300/40 hover:text-amber-300 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Compression…
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Remplacer l'image
                </>
              )}
            </button>

            <input
              type="text"
              value={imageAlt}
              onChange={(e) => updateImage({ alt: e.target.value })}
              className={inputClass}
              placeholder="Texte alternatif (alt) pour l'accessibilité"
            />

            <CheckRow
              checked={transparentBg}
              onChange={(v) => updateImage({ transparentBg: v })}
              label="Fond transparent"
              hint="Pour PNG détouré : retire le fond blanc et la bordure"
            />

            <Field label="Taille">
              <div className="flex flex-wrap gap-1.5">
                {SIZE_OPTIONS.map((opt) => (
                  <ModeBtn
                    key={opt.value}
                    active={size === opt.value}
                    onClick={() => updateImage({ size: opt.value })}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    <span className="ml-1 opacity-60 text-[10px]">
                      {opt.hint}
                    </span>
                  </ModeBtn>
                ))}
              </div>
            </Field>

            {size === "custom" && (
              <Field label={`Largeur personnalisée : ${customWidth}px`}>
                <input
                  type="range"
                  min={160}
                  max={1100}
                  step={10}
                  value={customWidth}
                  onChange={(e) =>
                    updateImage({ customWidth: Number(e.target.value) })
                  }
                  className="w-full accent-amber-300"
                />
              </Field>
            )}

            <Field label="Animation">
              <select
                value={animation}
                onChange={(e) =>
                  updateImage({ animation: e.target.value as ImageAnimation })
                }
                className={inputClass}
              >
                {ANIMATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

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
      </section>

      <div className="border-t border-white/10" />

      {/* ─── Vidéo ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <VideoIcon className="h-4 w-4 text-white/60" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Vidéo
          </h3>
        </div>

        <div className="space-y-3">
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

      <div className="border-t border-white/10" />

      {/* ─── Fond de section ───────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-white/60" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Fond de section
          </h3>
        </div>

        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleBackgroundFile(file);
          }}
          className="hidden"
        />

        {!hasBg ? (
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            disabled={bgUploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/30 px-4 py-6 text-[11px] text-white/60 hover:border-amber-300/40 hover:text-amber-300 disabled:opacity-50 transition-colors"
          >
            {bgUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Compression…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Uploader une image de fond (max 6 Mo)
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bgUrl}
                alt="Image de fond"
                className="h-auto max-h-40 w-full object-cover"
                style={{ objectPosition: bgPosition }}
              />
              {bgOverlay > 0 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: `rgba(0,0,0,${bgOverlay})` }}
                />
              )}
              <button
                type="button"
                onClick={removeBackground}
                className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-white/80 hover:bg-rose-500/80 transition-colors"
                title="Retirer le fond"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => bgInputRef.current?.click()}
              disabled={bgUploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70 hover:border-amber-300/40 hover:text-amber-300 disabled:opacity-50 transition-colors"
            >
              {bgUploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Compression…
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Remplacer le fond
                </>
              )}
            </button>

            <Field
              label={`Assombrissement : ${Math.round(bgOverlay * 100)}%`}
            >
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={Math.round(bgOverlay * 100)}
                onChange={(e) =>
                  updateBackground({ overlay: Number(e.target.value) / 100 })
                }
                className="w-full accent-amber-300"
              />
            </Field>

            <Field label="Cadrage">
              <div className="flex flex-wrap gap-1.5">
                <ModeBtn
                  active={bgSize === "cover"}
                  onClick={() => updateBackground({ size: "cover" })}
                >
                  Remplir
                </ModeBtn>
                <ModeBtn
                  active={bgSize === "contain"}
                  onClick={() => updateBackground({ size: "contain" })}
                >
                  Contenir
                </ModeBtn>
              </div>
            </Field>

            <Field label="Position">
              <div className="flex flex-wrap gap-1.5">
                {BG_POSITION_OPTIONS.map((opt) => (
                  <ModeBtn
                    key={opt.value}
                    active={bgPosition === opt.value}
                    onClick={() => updateBackground({ position: opt.value })}
                  >
                    {opt.label}
                  </ModeBtn>
                ))}
              </div>
            </Field>
          </div>
        )}

        {bgError && (
          <p className="mt-2 flex items-start gap-1 text-[11px] text-rose-300">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {bgError}
          </p>
        )}
        {lastBgSize !== null && !bgError && (
          <p className="mt-1 text-[10px] text-white/40">
            Image compressée à {formatBytes(lastBgSize)}
          </p>
        )}
      </section>

      <style jsx>{`
        :global(.ff-checker) {
          background-image:
            linear-gradient(45deg, rgba(255, 255, 255, 0.06) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255, 255, 255, 0.06) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.06) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.06) 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0;
          background-color: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-300/40 placeholder:text-white/30";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md p-2 hover:bg-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-zinc-950 accent-amber-300"
      />
      <div className="flex-1">
        <div className="text-xs font-medium text-white/90">{label}</div>
        {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      </div>
    </label>
  );
}
