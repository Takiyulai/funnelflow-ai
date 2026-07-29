"use client";

// components/editor/FrameEditor.tsx
//
// 🆕 Réglage d'un habillage : arrondi, bordure, couleur de bordure, ombre,
// marge intérieure, fond. Sert AUSSI BIEN à l'image d'une section qu'à ses
// cartes — c'est le même objet `VisualFrame` des deux côtés, donc le même
// éditeur.
//
// PRINCIPE À TENIR : « non réglé » n'est pas « zéro ». Un curseur laissé de
// côté ne doit produire AUCUNE valeur, pour que le thème garde la main et
// qu'aucun tunnel existant ne change d'apparence. D'où le bouton
// « Réinitialiser » qui remet à `undefined`, et non à 0.

import type { VisualFrame } from "@/lib/funnels/types";
import { SHADOW_OPTIONS } from "@/lib/funnels/frames";
import { RotateCcw } from "lucide-react";

function Slider({
  label,
  value,
  min,
  max,
  suffix = "px",
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number | undefined) => void;
}) {
  const set = value !== undefined;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-300">{label}</span>
        <span className="text-[11px] text-zinc-500">
          {set ? `${value}${suffix}` : "auto"}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value ?? min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[#C7A436]"
        />
        {set && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="Laisser le thème décider"
            className="shrink-0 text-zinc-500 hover:text-zinc-200"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function FrameEditor({
  frame,
  onChange,
  showBackground = true,
}: {
  frame: VisualFrame | undefined;
  onChange: (next: VisualFrame | undefined) => void;
  /** Le fond n'a de sens que derrière une image détourée. */
  showBackground?: boolean;
}) {
  const f = frame ?? {};

  const patch = (p: Partial<VisualFrame>) => {
    const next: VisualFrame = { ...f, ...p };
    // Une clé remise à `undefined` doit DISPARAÎTRE de l'objet, sinon elle
    // serait sérialisée en JSON et rendrait le cadre « non vide » à tort.
    for (const k of Object.keys(next) as (keyof VisualFrame)[]) {
      if (next[k] === undefined) delete next[k];
    }
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Habillage
        </span>
        {frame && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-100"
          >
            Tout réinitialiser
          </button>
        )}
      </div>

      <Slider
        label="Arrondi des angles"
        value={f.radius}
        min={0}
        max={64}
        onChange={(v) => patch({ radius: v })}
      />

      <Slider
        label="Épaisseur de bordure"
        value={f.borderWidth}
        min={0}
        max={16}
        onChange={(v) => patch({ borderWidth: v })}
      />

      {/* La couleur n'a de sens qu'avec une bordure visible : on ne l'affiche
          qu'une fois l'épaisseur réglée, pour ne pas donner l'illusion d'un
          réglage sans effet. */}
      {!!f.borderWidth && (
        <label className="block">
          <span className="text-[11px] font-semibold text-zinc-300">
            Couleur de bordure
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={f.borderColor ?? "#C7A436"}
              onChange={(e) => patch({ borderColor: e.target.value })}
              className="h-8 w-12 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent"
            />
            <input
              value={f.borderColor ?? ""}
              onChange={(e) => patch({ borderColor: e.target.value || undefined })}
              placeholder="#C7A436"
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-500"
            />
          </div>
        </label>
      )}

      <label className="block">
        <span className="text-[11px] font-semibold text-zinc-300">Ombre portée</span>
        <select
          value={f.shadow ?? ""}
          onChange={(e) =>
            patch({ shadow: (e.target.value || undefined) as VisualFrame["shadow"] })
          }
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
        >
          <option value="">Laisser le thème décider</option>
          {SHADOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <Slider
        label="Marge intérieure"
        value={f.padding}
        min={0}
        max={48}
        onChange={(v) => patch({ padding: v })}
      />

      {showBackground && (
        <label className="block">
          <span className="text-[11px] font-semibold text-zinc-300">
            Fond {f.padding ? "" : "(surtout utile avec une marge)"}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={f.backgroundColor ?? "#FFFFFF"}
              onChange={(e) => patch({ backgroundColor: e.target.value })}
              className="h-8 w-12 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent"
            />
            <input
              value={f.backgroundColor ?? ""}
              onChange={(e) => patch({ backgroundColor: e.target.value || undefined })}
              placeholder="transparent"
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-500"
            />
          </div>
        </label>
      )}
    </div>
  );
}

export default FrameEditor;
