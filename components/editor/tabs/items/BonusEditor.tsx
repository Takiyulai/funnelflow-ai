"use client";

import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { FunnelSection, SectionItem, BonusItem } from "@/lib/funnels/types";
import { IconPicker } from "./IconPicker";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

export function BonusEditor({ section, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "bonus" } => it.kind === "bonus"
  );

  const updateItems = (next: typeof items) => onChange({ items: next });

  const addItem = () => {
    const newItem: SectionItem = {
      kind: "bonus",
      data: { title: "", value: "", description: "", iconName: "gift" },
    };
    updateItems([...items, newItem]);
    setOpenIdx(items.length);
  };

  const updateItem = (idx: number, patch: Partial<BonusItem>) => {
    const next = items.map((it, i) =>
      i === idx ? { ...it, data: { ...it.data, ...patch } } : it
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/70">
          Bonus offerts ({items.length})
        </label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un bonus
        </button>
      </div>

      {items.length === 0 && (
        <div className="rounded-md border border-dashed border-white/15 bg-zinc-950/40 p-4 text-center text-xs text-white/50">
          Aucun bonus. Cliquez sur « Ajouter un bonus ».
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className="rounded-md border border-white/10 bg-zinc-950/60">
              <div className="flex items-center gap-2 px-2 py-2">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex-1 truncate text-left text-sm text-white/90"
                >
                  {item.data.title || (
                    <span className="text-white/40 italic">Bonus {idx + 1}</span>
                  )}
                  {item.data.value && (
                    <span className="ml-2 text-xs text-amber-300">{item.data.value}</span>
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
                <div className="space-y-2 border-t border-white/10 px-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Titre du bonus
                      </label>
                      <input
                        type="text"
                        value={item.data.title}
                        onChange={(e) => updateItem(idx, { title: e.target.value })}
                        placeholder="Guide PDF offert"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Valeur
                      </label>
                      <input
                        type="text"
                        value={item.data.value || ""}
                        onChange={(e) => updateItem(idx, { value: e.target.value })}
                        placeholder="Valeur 49€"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Description
                    </label>
                    <textarea
                      value={item.data.description || ""}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Ce que ce bonus apporte au client…"
                      rows={2}
                      className="w-full resize-y rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Icône
                    </label>
                    <IconPicker
                      value={item.data.iconName || "gift"}
                      onChange={(iconName) => updateItem(idx, { iconName })}
                    />
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
