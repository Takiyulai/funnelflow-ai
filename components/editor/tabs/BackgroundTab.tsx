"use client";

import { useRef } from "react";
import { Image as ImageIcon, X, RotateCcw } from "lucide-react";
import type { FunnelSection, SectionBackground } from "@/lib/funnels/types";
import { externalizeMediasSync } from "@/lib/store/mediaStore";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

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

  const update = (patch: Partial<SectionBackground>) => {
    const next: SectionBackground = { ...bg, ...patch };
    onChange({ background: next });
  };

  const reset = () => {
    onChange({ background: undefined });
  };

  const handleFile = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      // On stocke la data-URL dans un wrapper et on l'externalise immédiatement
      // vers IndexedDB via le système existant, qui remplace en place par idb-media://.
      const wrapper = { imageUrl: result };
      externalizeMediasSync(wrapper);
      update({ imageUrl: wrapper.imageUrl });
    };
    reader.readAsDataURL(file);
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
            <img
              src={bg.imageUrl}
              alt="Aperçu arrière-plan"
              className="h-32 w-full object-cover"
            />
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 bg-zinc-950/40 px-4 py-6 text-sm text-white/70 hover:border-amber-300/60 hover:bg-zinc-950 hover:text-white"
          >
            <ImageIcon className="h-4 w-4" />
            Choisir une image
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
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
