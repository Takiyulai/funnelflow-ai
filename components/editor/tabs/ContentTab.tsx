"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";
import type { FunnelSection, Language } from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  language: Language;
  onChange: (patch: Partial<FunnelSection>) => void;
};

export function ContentTab({ section, onChange }: Props) {
  const bullets = section.bullets ?? [];
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const updateBullet = (idx: number, value: string) => {
    const next = bullets.map((b, i) => (i === idx ? value : b));
    onChange({ bullets: next });
  };

  const addBullet = () => {
    onChange({ bullets: [...bullets, ""] });
  };

  const removeBullet = (idx: number) => {
    onChange({ bullets: bullets.filter((_, i) => i !== idx) });
  };

  const reorderBullet = (from: number, to: number) => {
    if (from === to) return;
    const next = [...bullets];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ bullets: next });
  };

  return (
    <div className="space-y-4">
      <Field label="Eyebrow (suréntête)" hint="Petit texte au-dessus du titre">
        <input
          type="text"
          value={section.eyebrow ?? ""}
          onChange={(e) => onChange({ eyebrow: e.target.value })}
          className={inputClass}
          placeholder="Ex : Nouveau · Limité · Gratuit"
        />
      </Field>

      <Field label="Headline (titre principal)" required>
        <textarea
          value={section.headline ?? ""}
          onChange={(e) => onChange({ headline: e.target.value })}
          rows={2}
          className={textareaClass}
          placeholder="Le titre qui accroche"
        />
      </Field>

      <Field label="Subheadline (sous-titre)">
        <textarea
          value={section.subheadline ?? ""}
          onChange={(e) => onChange({ subheadline: e.target.value })}
          rows={2}
          className={textareaClass}
          placeholder="Une phrase qui complète le titre"
        />
      </Field>

      <Field label="Body (paragraphe)">
        <textarea
          value={section.body ?? ""}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={4}
          className={textareaClass}
          placeholder="Le texte principal de la section"
        />
      </Field>

      {/* Bullets */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-white/70">
            Bullets ({bullets.length})
          </label>
          <button
            type="button"
            onClick={addBullet}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:border-amber-300/40 hover:text-amber-300"
          >
            <Plus className="h-3 w-3" />
            Ajouter
          </button>
        </div>
        <ul className="space-y-1.5">
          {bullets.map((bullet, idx) => (
            <li
              key={idx}
              draggable
              onDragStart={() => setDraggedIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedIdx !== null) reorderBullet(draggedIdx, idx);
                setDraggedIdx(null);
              }}
              onDragEnd={() => setDraggedIdx(null)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-white/30" />
              <input
                type="text"
                value={bullet}
                onChange={(e) => updateBullet(idx, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
                placeholder={`Bullet ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeBullet(idx)}
                className="shrink-0 rounded p-1 text-white/40 hover:bg-rose-500/20 hover:text-rose-300"
                title="Supprimer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
          {bullets.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-white/40">
              Aucun bullet — clique sur « Ajouter »
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-300/40 placeholder:text-white/30";
const textareaClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-300/40 placeholder:text-white/30 resize-y";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/70">
        {label}
        {required && <span className="text-amber-300">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-white/40">{hint}</p>}
    </div>
  );
}
