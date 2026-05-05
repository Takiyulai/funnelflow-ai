"use client";

import { X } from "lucide-react";
import type { Funnel } from "@/lib/funnels/types";

type Props = {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
  onClose: () => void;
};

const STYLE_PRESETS: { value: string; label: string }[] = [
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxe" },
  { value: "soft", label: "Doux" },
  { value: "bold", label: "Audacieux" },
  { value: "minimal", label: "Minimal" },
];

const DEFAULT_DESIGN: Funnel["design"] = {
  primaryColor: "#fbbf24",
  secondaryColor: "#0a0a0a",
  accentColor: "#f59e0b",
  style: "premium",
};

export function GlobalStylePanel({ funnel, onChange, onClose }: Props) {
  const design: Funnel["design"] = funnel.design ?? DEFAULT_DESIGN;

  const updateDesign = (patch: Partial<Funnel["design"]>) => {
    onChange({ design: { ...design, ...patch } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Style global</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Nom du tunnel">
            <input
              type="text"
              value={funnel.funnelName}
              onChange={(e) => onChange({ funnelName: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Couleur primaire">
            <ColorRow
              value={design.primaryColor}
              onChange={(c) => updateDesign({ primaryColor: c })}
            />
          </Field>

          <Field label="Couleur secondaire">
            <ColorRow
              value={design.secondaryColor}
              onChange={(c) => updateDesign({ secondaryColor: c })}
            />
          </Field>

          <Field label="Couleur d'accent">
            <ColorRow
              value={design.accentColor}
              onChange={(c) => updateDesign({ accentColor: c })}
            />
          </Field>

          <Field label="Style visuel">
            <select
              value={design.style ?? "premium"}
              onChange={(e) => updateDesign({ style: e.target.value })}
              className={inputClass}
            >
              {STYLE_PRESETS.map((p) => (
                <option key={p.value} value={p.value} className="bg-zinc-900">
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-amber-300 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/70">{label}</label>
      {children}
    </div>
  );
}

function ColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-amber-300/40"
      />
    </div>
  );
}
