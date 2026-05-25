"use client";

import {
  Plus,
  Trash2,
  Star,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video as VideoIcon,
  ArrowUp,
  ArrowDown,
  Upload,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import type {
  FunnelSection,
  SectionItem,
  TestimonialItem,
  TestimonialMedia,
  TestimonialMediaKind,
} from "@/lib/funnels/types";
import { makeTestimonialMedia } from "@/lib/funnels/types";
import { compressImage, formatBytes } from "@/lib/images/compress";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

// Limites d'upload (alignées sur MediaTab.tsx)
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB en entrée, compressé ensuite

export function TestimonialsEditor({ section, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "testimonial" } =>
      it.kind === "testimonial",
  );

  const updateItems = (next: typeof items) => onChange({ items: next });

  const addItem = () => {
    const newItem: SectionItem = {
      kind: "testimonial",
      data: {
        quote: "",
        authorName: "",
        authorRole: "",
        avatarUrl: "",
        rating: 5,
        medias: [],
      },
    };
    updateItems([...items, newItem]);
    setOpenIdx(items.length);
  };

  const updateItem = (idx: number, patch: Partial<TestimonialItem>) => {
    const next = items.map((it, i) =>
      i === idx ? { ...it, data: { ...it.data, ...patch } } : it,
    );
    updateItems(next);
  };

  const removeItem = (idx: number) => {
    updateItems(items.filter((_, i) => i !== idx));
    if (openIdx === idx) setOpenIdx(null);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateItems(next);
  };

  // ─── Helpers médias ────────────────────────────────────────────────
  const addMedia = (testimonialIdx: number, kind: TestimonialMediaKind) => {
    const current = items[testimonialIdx].data.medias ?? [];
    const next = [...current, makeTestimonialMedia(kind)];
    updateItem(testimonialIdx, { medias: next });
  };

  const updateMedia = (
    testimonialIdx: number,
    mediaIdx: number,
    patch: Partial<TestimonialMedia>,
  ) => {
    const current = items[testimonialIdx].data.medias ?? [];
    const next = current.map((m, i) =>
      i === mediaIdx ? { ...m, ...patch } : m,
    );
    updateItem(testimonialIdx, { medias: next });
  };

  const removeMedia = (testimonialIdx: number, mediaIdx: number) => {
    const current = items[testimonialIdx].data.medias ?? [];
    updateItem(testimonialIdx, {
      medias: current.filter((_, i) => i !== mediaIdx),
    });
  };

  const moveMedia = (
    testimonialIdx: number,
    mediaIdx: number,
    dir: -1 | 1,
  ) => {
    const current = items[testimonialIdx].data.medias ?? [];
    const newIdx = mediaIdx + dir;
    if (newIdx < 0 || newIdx >= current.length) return;
    const next = [...current];
    [next[mediaIdx], next[newIdx]] = [next[newIdx], next[mediaIdx]];
    updateItem(testimonialIdx, { medias: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/70">
          Témoignages ({items.length})
        </label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un témoignage
        </button>
      </div>

      {items.length === 0 && (
        <div className="rounded-md border border-dashed border-white/15 bg-zinc-950/40 p-4 text-center text-xs text-white/50">
          Aucun témoignage. Cliquez sur « Ajouter un témoignage ».
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          const medias = item.data.medias ?? [];

          return (
            <div
              key={idx}
              className="rounded-md border border-white/10 bg-zinc-950/60"
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex-1 truncate text-left text-sm text-white/90"
                >
                  {item.data.authorName || (
                    <span className="text-white/40 italic">
                      Témoignage {idx + 1}
                    </span>
                  )}
                  {medias.length > 0 && (
                    <span className="ml-2 text-[10px] text-amber-300/70">
                      • {medias.length} média{medias.length > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="text-white/40 hover:text-white disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="text-white/40 hover:text-white disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-red-400/70 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-white/10 px-3 py-3">
                  {/* ─── Citation ────────────────────────────── */}
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Citation
                    </label>
                    <textarea
                      value={item.data.quote}
                      onChange={(e) =>
                        updateItem(idx, { quote: e.target.value })
                      }
                      placeholder="Ce que dit votre client…"
                      rows={3}
                      className="w-full resize-y rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                    />
                  </div>

                  {/* ─── Nom + Rôle ──────────────────────────── */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Nom
                      </label>
                      <input
                        type="text"
                        value={item.data.authorName}
                        onChange={(e) =>
                          updateItem(idx, { authorName: e.target.value })
                        }
                        placeholder="Marie D."
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Rôle / Métier
                      </label>
                      <input
                        type="text"
                        value={item.data.authorRole || ""}
                        onChange={(e) =>
                          updateItem(idx, { authorRole: e.target.value })
                        }
                        placeholder="Cliente fidèle"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* ─── Avatar ──────────────────────────────── */}
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      URL de l'avatar (optionnel)
                    </label>
                    <input
                      type="url"
                      value={item.data.avatarUrl || ""}
                      onChange={(e) =>
                        updateItem(idx, { avatarUrl: e.target.value })
                      }
                      placeholder="https://…"
                      className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                    />
                  </div>

                  {/* ─── Note ────────────────────────────────── */}
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Note
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateItem(idx, { rating: n })}
                          className="text-amber-300 hover:scale-110 transition"
                          title={`${n} étoile${n > 1 ? "s" : ""}`}
                        >
                          <Star
                            className="h-5 w-5"
                            fill={
                              n <= (item.data.rating || 0)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateItem(idx, { rating: 0 })}
                        className="ml-2 text-[10px] text-white/40 hover:text-white/70"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>

                  {/* ─── 🆕 Médias additionnels ──────────────── */}
                  <div className="rounded-md border border-white/10 bg-zinc-900/50 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[11px] font-medium text-white/70">
                        Preuves visuelles ({medias.length})
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => addMedia(idx, "image")}
                          className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25"
                        >
                          <ImageIcon className="h-3 w-3" />
                          Image
                        </button>
                        <button
                          type="button"
                          onClick={() => addMedia(idx, "video")}
                          className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25"
                        >
                          <VideoIcon className="h-3 w-3" />
                          Vidéo
                        </button>
                      </div>
                    </div>

                    {medias.length === 0 && (
                      <p className="text-[10px] italic text-white/40">
                        Captures d'écran, vidéo témoignage, screenshots de
                        paiement, etc. Affichés au-dessus de la citation.
                      </p>
                    )}

                    <div className="space-y-1.5">
                      {medias.map((media, mIdx) => (
                        <MediaRow
                          key={media.id}
                          media={media}
                          isFirst={mIdx === 0}
                          isLast={mIdx === medias.length - 1}
                          index={mIdx}
                          onUpdate={(patch) => updateMedia(idx, mIdx, patch)}
                          onRemove={() => removeMedia(idx, mIdx)}
                          onMoveUp={() => moveMedia(idx, mIdx, -1)}
                          onMoveDown={() => moveMedia(idx, mIdx, 1)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 * MediaRow — ligne d'un média (image upload+URL, ou vidéo URL seule)
 * ════════════════════════════════════════════════════════════════════ */

function MediaRow({
  media,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  media: TestimonialMedia;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<TestimonialMedia>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSize, setLastSize] = useState<number | null>(null);

  const isImage = media.kind === "image";
  const isDataUrl = media.url.startsWith("data:");
  const hasMedia = !!media.url;

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(
        `Image trop lourde (${formatBytes(file.size)}). Limite : 8 Mo.`,
      );
      return;
    }

    setUploading(true);
    try {
      const result = await compressImage(file, {
        maxWidth: 1400,
        maxHeight: 1400,
        quality: 0.82,
        mimeType: "preserve",
      });
      setLastSize(result.sizeBytes);
      onUpdate({ url: result.dataUrl });
    } catch (e) {
      console.error("[TestimonialsEditor.handleFile]", e);
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(
        `Ce fichier ne peut pas être lu. Ré-enregistre-le en JPEG/PNG ` +
          `et ré-essaie. (Détail : ${msg})`,
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded border border-white/10 bg-zinc-950/50 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/60">
          {isImage ? (
            <ImageIcon className="h-3 w-3" />
          ) : (
            <VideoIcon className="h-3 w-3" />
          )}
          {isImage ? "Image" : "Vidéo"} #{index + 1}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="text-white/40 hover:text-white disabled:opacity-30"
            title="Monter"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="text-white/40 hover:text-white disabled:opacity-30"
            title="Descendre"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400/70 hover:text-red-400"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Aperçu ────────────────────────────────────────────── */}
      {hasMedia && isImage && (
        <div className="mb-2 overflow-hidden rounded border border-white/10 bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.url}
            alt={media.alt || ""}
            className="block max-h-32 w-full object-contain"
          />
        </div>
      )}

      {/* ── Image : Upload + URL alternative ─────────────────── */}
      {isImage ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />

          <div className="mb-1.5 grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 rounded border border-white/15 bg-white/[0.03] px-2 py-1.5 text-[11px] font-medium text-white/80 hover:border-amber-300/40 hover:text-amber-300 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Compression…
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  {hasMedia && isDataUrl
                    ? "Remplacer le fichier"
                    : "Uploader un fichier (max 8 Mo)"}
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 rounded border border-white/15 bg-zinc-900 px-2 py-1">
              <LinkIcon className="h-3 w-3 shrink-0 text-white/40" />
              <input
                type="url"
                value={isDataUrl ? "" : media.url}
                onChange={(e) => onUpdate({ url: e.target.value })}
                placeholder="… ou coller une URL (jpg, png, webp)"
                className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/30"
              />
            </div>
          </div>

          {error && (
            <p className="mb-1 flex items-start gap-1 text-[10px] text-rose-300">
              <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
              {error}
            </p>
          )}
          {lastSize !== null && !error && (
            <p className="mb-1 text-[10px] text-white/40">
              Image compressée à {formatBytes(lastSize)}
            </p>
          )}
        </>
      ) : (
        /* ── Vidéo : URL uniquement ───────────────────────────── */
        <input
          type="url"
          value={media.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://youtu.be/… ou https://vimeo.com/… ou .mp4"
          className="mb-1.5 w-full rounded border border-white/15 bg-zinc-900 px-2 py-1 text-[12px] text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      )}

      {/* ── Texte alt / Titre ─────────────────────────────────── */}
      <input
        type="text"
        value={media.alt || ""}
        onChange={(e) => onUpdate({ alt: e.target.value })}
        placeholder={
          isImage ? "Description (alt)" : "Titre de la vidéo (optionnel)"
        }
        className="w-full rounded border border-white/15 bg-zinc-900 px-2 py-1 text-[12px] text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
      />

      {/* ── Poster URL pour vidéos MP4 ────────────────────────── */}
      {!isImage && (
        <input
          type="url"
          value={media.posterUrl || ""}
          onChange={(e) => onUpdate({ posterUrl: e.target.value })}
          placeholder="URL miniature (optionnel, pour .mp4)"
          className="mt-1 w-full rounded border border-white/15 bg-zinc-900 px-2 py-1 text-[12px] text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      )}
    </div>
  );
}
