"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import type {
  FunnelSection,
  SectionItem,
  FormFieldItem,
  FormFieldType,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Texte court" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Téléphone" },
  { value: "number", label: "Nombre" },
  { value: "textarea", label: "Texte long" },
  { value: "select", label: "Liste déroulante" },
  { value: "checkbox", label: "Case à cocher" },
];

function slugifyName(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || `field_${Date.now().toString(36)}`
  );
}

export function FormFieldsEditor({ section, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "formField" } => it.kind === "formField",
  );

  const updateItems = (next: typeof items) => {
    // On préserve les autres kinds éventuels (très improbable pour form, mais safe)
    const others = (section.items || []).filter((it) => it.kind !== "formField");
    onChange({ items: [...others, ...next] });
  };

  const addItem = () => {
    const idx = items.length;
    const newField: FormFieldItem = {
      name: `field_${idx + 1}`,
      label: "",
      placeholder: "",
      type: "text",
      required: false,
      width: "full",
    };
    const next: typeof items = [...items, { kind: "formField", data: newField }];
    updateItems(next);
    setOpenIdx(idx);
  };

  const updateItem = (idx: number, patch: Partial<FormFieldItem>) => {
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

  const updateOption = (idx: number, oIdx: number, value: string) => {
    const opts = [...(items[idx].data.options || [])];
    opts[oIdx] = value;
    updateItem(idx, { options: opts });
  };

  const addOption = (idx: number) => {
    const opts = [...(items[idx].data.options || []), ""];
    updateItem(idx, { options: opts });
  };

  const removeOption = (idx: number, oIdx: number) => {
    const opts = (items[idx].data.options || []).filter((_, i) => i !== oIdx);
    updateItem(idx, { options: opts });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/70">
          Champs du formulaire ({items.length})
        </label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un champ
        </button>
      </div>

      {items.length === 0 && (
        <div className="rounded-md border border-dashed border-white/15 bg-zinc-950/40 p-4 text-center text-xs text-white/50">
          Aucun champ. Cliquez sur « Ajouter un champ ».
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          const f = item.data;
          const typeLabel =
            FIELD_TYPES.find((t) => t.value === f.type)?.label || f.type;
          return (
            <div key={idx} className="rounded-md border border-white/10 bg-zinc-950/60">
              <div className="flex items-center gap-2 px-2 py-2">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex-1 truncate text-left text-sm text-white/90"
                >
                  {f.label || (
                    <span className="text-white/40 italic">Champ {idx + 1}</span>
                  )}
                  <span className="ml-2 text-[11px] text-white/50">
                    — {typeLabel}
                    {f.required ? " *" : ""}
                  </span>
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
                        Libellé
                      </label>
                      <input
                        type="text"
                        value={f.label || ""}
                        onChange={(e) => {
                          const label = e.target.value;
                          // Auto-génère un name si vide ou si c'était la valeur par défaut
                          const autoName =
                            !f.name || /^field_\d+$/.test(f.name)
                              ? slugifyName(label)
                              : f.name;
                          updateItem(idx, { label, name: autoName });
                        }}
                        placeholder="Prénom"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Nom technique
                      </label>
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) =>
                          updateItem(idx, { name: slugifyName(e.target.value) })
                        }
                        placeholder="prenom"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={f.placeholder || ""}
                      onChange={(e) =>
                        updateItem(idx, { placeholder: e.target.value })
                      }
                      placeholder="Votre prénom"
                      className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Type de champ
                      </label>
                      <select
                        value={f.type}
                        onChange={(e) =>
                          updateItem(idx, { type: e.target.value as FormFieldType })
                        }
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white focus:border-amber-300/40 focus:outline-none"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value} className="bg-zinc-900">
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Largeur
                      </label>
                      <select
                        value={f.width || "full"}
                        onChange={(e) =>
                          updateItem(idx, {
                            width: e.target.value as "full" | "half",
                          })
                        }
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white focus:border-amber-300/40 focus:outline-none"
                      >
                        <option value="full" className="bg-zinc-900">
                          Pleine largeur
                        </option>
                        <option value="half" className="bg-zinc-900">
                          Demi-largeur (côte-à-côte)
                        </option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={f.required || false}
                      onChange={(e) =>
                        updateItem(idx, { required: e.target.checked })
                      }
                      className="h-3.5 w-3.5 cursor-pointer accent-amber-300"
                    />
                    <span className="text-[11px] text-white/70">
                      Champ obligatoire
                    </span>
                  </label>

                  {f.type === "select" && (
                    <div className="rounded-md border border-white/10 bg-black/30 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[11px] font-medium text-white/60">
                          Options de la liste
                        </label>
                        <button
                          type="button"
                          onClick={() => addOption(idx)}
                          className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter
                        </button>
                      </div>
                      <div className="space-y-1">
                        {(f.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                updateOption(idx, oIdx, e.target.value)
                              }
                              placeholder={`Option ${oIdx + 1}`}
                              className="flex-1 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-xs text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(idx, oIdx)}
                              className="text-red-400/60 hover:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {(f.options || []).length === 0 && (
                          <div className="text-[11px] italic text-white/40">
                            Aucune option.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-white/40">
        Le bouton d'envoi (CTA) du formulaire se configure dans l'onglet{" "}
        <span className="text-white/60">CTA</span>.
      </p>
    </div>
  );
}
