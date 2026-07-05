"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, X, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import type { FunnelSection, SectionBackground } from "@/lib/funnels/types";
import { compressImage, formatBytes } from "@/lib/images/compress";
import { getMedia, IDB_MEDIA_PREFIX } from "@/lib/store/mediaStore";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const MAX_BG_INPUT_SIZE = 8 * 1024 * 1024;

const POSITION_OPTIONS: { value: NonNullable<SectionBackground["position"]>; label: string }[] = [
  { value: "center", label: "Centre" },
  { value: "top", label: "Haut" },
  { value: "bottom", label: "Bas" },
  { value: "left", label: "Gauche" },
  { value: "right", label: "Droite" },
];

const SIZE_OPTIONS: { value: NonNullable<SectionBackground["size"]>; label: string }[] = [
  { value: "cover", label: "Couvrir" },
  { value: "contain", label: "Contenir" },
  { value: "auto", label: "Auto" },
];

export function BackgroundTab({ section, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bg: SectionBackground = section.background ?? {};
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);

  // 🆕 Rétrocompat : des sections déjà sauvegardées AVANT ce fix peuvent avoir
  // bg.imageUrl = "idb-media://…" (posé par l'ancien code). On la résout pour
  // que l'aperçu ci-dessous s'affiche aussi pour ces anciennes sections.
  const [resolvedPreview, setResolvedPreview] = useState<string | undefined>(
    bg.imageUrl && !bg.imageUrl.startsWith(IDB_MEDIA_PREFIX) ? bg.imageUrl : undefined,
  );
  useEffect(() => {
    let cancelled = false;
    const url = bg.imageUrl;
    if (!url) {
      setResolvedPreview(undefined);
      return;
    }
    if (!url.startsWith(IDB_MEDIA_PREFIX)) {
      setResolvedPreview(url);
      return;
    }
    getMedia(url.slice(IDB_MEDIA_PREFIX.length))
      .then((data) => {
        if (!cancelled) setResolvedPreview(data ?? undefined);
      })
      .catch(() => {
        if (!cancelled) setResolvedPreview(undefined);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg.imageUrl]);

  const update = (patch: Partial<SectionBackground>) => {
    const next: SectionBackground = { ...bg, ...patch };
    onChange({ background: next });
  };

  const reset = () => {
    onChange({ background: undefined });
    setBgError(null);
  };

  // 🆕 FIX RÉGRESSION (upload OK, image jamais affichée) : cette fonction
  // appelait `externalizeMediasSync` IMMÉDIATEMENT après l'upload, remplaçant
  // `imageUrl` par une référence "idb-media://…" AVANT même le premier rendu.
  // Or l'aperçu ci-dessous (<img src={bg.imageUrl}>) et FunnelPreview.tsx
  // affichent cette valeur TELLE QUELLE tant qu'elle n'est pas résolue —
  // "idb-media://…" n'est PAS un schéma d'URL que le navigateur sait charger,
  // donc l'image restait invisible en permanence (l'upload/la compression
  // réussissaient bien, seul l'AFFICHAGE était cassé). MediaTab.tsx (image
  // principale de section) ne fait PAS ça : il garde la data-URL brute en
  // mémoire pendant toute la session d'édition, et laisse `saveFunnel()`
  // (funnelStore.ts) externaliser vers IndexedDB en arrière-plan au moment de
  // la sauvegarde seulement — c'est CE pipeline qu'on réplique ici. On profite
  // aussi de l'occasion pour aligner sur MediaTab.tsx : compression avant
  // stockage (au lieu d'un FileReader brut sans limite de taille).
  const handleFile = async (file: File) => {
    setBgError(null);
    if (!file || !file.type.startsWith("image/")) {
      setBgError("Le fichier doit être une image");
      return;
    }
    if (file.size > MAX_BG_INPUT_SIZE) {
      setBgError(`Image trop lourde (${formatBytes(file.size)}). Limite : 8 Mo.`);
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
      // Data-URL directe en mémoire (comme MediaTab.tsx) — l'externalisation
      // vers IndexedDB se fait automatiquement, plus tard, à la sauvegarde.
      update({ imageUrl: result.dataUrl });
    } catch (e) {
      console.error("[BackgroundTab] handleFile error:", e);
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setBgError(
        `Ce fichier ne peut pas être lu par le navigateur. Ouvre-le dans Paint ` +
          `ou Photos et ré-enregistre-le en JPEG, puis réessaie. (Détail : ${msg})`,
      );
    } finally {
      setBgUploading(false);
    }
  };

  const removeImage = () => {
    update({ imageUrl: undefined, mediaRef: undefined });
  };

  // Presets rapides
  const presetDarkVeil = () =>
    update({ overlayColor: "#000000", overlayOpacity: 40 });
  const presetLightVeil = () =>
    update({ overlayColor: "#ffffff", overlayOpacity: 30 });
  const removeOverlay = () =>
    update({ overlayOpacity: 0 });

  return (
    <div className="space-y-5 text-white">
      {/* ─── Image de fond ─────────────────────────────────────────── */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
          Image de fond
        </label>

        {bg.imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-white/15 bg-zinc-950">
            {resolvedPreview ? (
              <img
                src={resolvedPreview}
                alt="Aperçu arrière-plan"
                className="h-32 w-full object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center gap-2 text-xs text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Chargement de l&apos;aperçu…
              </div>
            )}
            <button
              type="button"
              onClick={removeImage}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-red-600"
              aria-label="Supprimer l'image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={bgUploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 bg-zinc-950/40 px-4 py-6 text-sm text-white/70 hover:border-amber-300/60 hover:bg-zinc-950 hover:text-white disabled:opacity-50"
          >
            {bgUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compression…
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Choisir une image (max 8 Mo)
              </>
            )}
          </button>
        )}

        {bgError && (
          <p className="mt-2 flex items-start gap-1 text-[11px] text-rose-300">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {bgError}
          </p>
        )}

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
      </div>

      {/* ─── Voile (overlay) ───────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-white/10 bg-zinc-950/40 p-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-white/60">
            Voile
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={presetDarkVeil}
              className="rounded bg-white/10 px-2 py-1 text-[10px] text-white/80 hover:bg-white/20"
              title="Voile noir 40%"
            >
              Sombre
            </button>
            <button
              type="button"
              onClick={presetLightVeil}
              className="rounded bg-white/10 px-2 py-1 text-[10px] text-white/80 hover:bg-white/20"
              title="Voile blanc 30%"
            >
              Clair
            </button>
            <button
              type="button"
              onClick={removeOverlay}
              className="rounded bg-white/10 px-2 py-1 text-[10px] text-white/80 hover:bg-white/20"
              title="Aucun voile"
            >
              Aucun
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-white/70">Couleur :</label>
          <input
            type="color"
            value={bg.overlayColor ?? "#000000"}
            onChange={(e) => update({ overlayColor: e.target.value })}
            className="h-7 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
          />
          <span className="font-mono text-[10px] text-white/50">
            {bg.overlayColor ?? "#000000"}
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-white/70">Opacité du voile</label>
            <span className="font-mono text-xs text-amber-300">
              {bg.overlayOpacity ?? 0}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={bg.overlayOpacity ?? 0}
            onChange={(e) =>
              update({ overlayOpacity: Number(e.target.value) })
            }
            className="w-full accent-amber-400"
          />
        </div>
      </div>

      {/* ─── Position / Taille / Attachment / Blur ─────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-white/70">Position</label>
          <select
            value={bg.position ?? "center"}
            onChange={(e) =>
              update({ position: e.target.value as SectionBackground["position"] })
            }
            className="w-full rounded border border-white/15 bg-zinc-950 px-2 py-1.5 text-sm text-white"
          >
            {POSITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/70">Taille</label>
          <select
            value={bg.size ?? "cover"}
            onChange={(e) =>
              update({ size: e.target.value as SectionBackground["size"] })
            }
            className="w-full rounded border border-white/15 bg-zinc-950 px-2 py-1.5 text-sm text-white"
          >
            {SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2">
        <label className="text-xs text-white/70">Fond fixé (parallaxe)</label>
        <button
          type="button"
          onClick={() =>
            update({
              attachment: bg.attachment === "fixed" ? "scroll" : "fixed",
            })
          }
          className={[
            "relative h-5 w-9 rounded-full transition-colors",
            bg.attachment === "fixed" ? "bg-amber-400" : "bg-white/20",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              bg.attachment === "fixed" ? "translate-x-4" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-white/70">Flou</label>
          <span className="font-mono text-xs text-amber-300">
            {bg.blur ?? 0}px
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={bg.blur ?? 0}
          onChange={(e) => update({ blur: Number(e.target.value) })}
          className="w-full accent-amber-400"
        />
      </div>

      {/* ─── Réinitialiser ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={reset}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Réinitialiser l'arrière-plan
      </button>
    </div>
  );
}
