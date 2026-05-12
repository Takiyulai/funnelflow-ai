"use client";

import { Plus, Trash2, Star, ChevronDown, ChevronUp, X, Copy } from "lucide-react";
import { useState } from "react";
import type {
  FunnelSection,
  SectionItem,
  PricingPlanItem,
  IconConfig,
  IconName,
  IconSize,
  IconAnimation,
} from "@/lib/funnels/types";
import { IconPicker } from "@/components/editor/IconPicker";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const DEFAULT_FEATURE_ICON: IconConfig = {
  name: "check",
  size: "md",
  animation: "none",
};

export function PricingEditor({ section, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "pricing" } => it.kind === "pricing"
  );

  const updateItems = (next: typeof items) => onChange({ items: next });

  const addItem = () => {
    const newItem: SectionItem = {
      kind: "pricing",
      data: {
        name: "",
        price: "",
        period: "",
        description: "",
        features: [],
        highlighted: false,
        featureIcon: { ...DEFAULT_FEATURE_ICON },
      },
    };
    updateItems([...items, newItem]);
    setOpenIdx(items.length);
  };

  const updateItem = (idx: number, patch: Partial<PricingPlanItem>) => {
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

  const toggleHighlight = (idx: number) => {
    const target = !items[idx].data.highlighted;
    const next = items.map((it, i) => ({
      ...it,
      data: { ...it.data, highlighted: i === idx ? target : false },
    }));
    updateItems(next);
  };

  const updateFeature = (idx: number, fIdx: number, value: string) => {
    const features = [...(items[idx].data.features || [])];
    features[fIdx] = value;
    updateItem(idx, { features });
  };

  const addFeature = (idx: number) => {
    const features = [...(items[idx].data.features || []), ""];
    updateItem(idx, { features });
  };

  const removeFeature = (idx: number, fIdx: number) => {
    const features = (items[idx].data.features || []).filter((_, i) => i !== fIdx);
    updateItem(idx, { features });
  };

  // ─── Lot L : gestion de l'icône des features ────────────────────────────
  const updateFeatureIcon = (idx: number, patch: Partial<IconConfig>) => {
    const current = items[idx].data.featureIcon ?? DEFAULT_FEATURE_ICON;
    updateItem(idx, { featureIcon: { ...current, ...patch } });
  };

  const propagateIconToAll = (idx: number) => {
    const source = items[idx].data.featureIcon ?? DEFAULT_FEATURE_ICON;
    const next = items.map((it) => ({
      ...it,
      data: { ...it.data, featureIcon: { ...source } },
    }));
    updateItems(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/70">
          Plans tarifaires ({items.length})
        </label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un plan
        </button>
      </div>

      {items.length === 0 && (
        <div className="rounded-md border border-dashed border-white/15 bg-zinc-950/40 p-4 text-center text-xs text-white/50">
          Aucun plan. Cliquez sur « Ajouter un plan ».
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          const icon = item.data.featureIcon ?? DEFAULT_FEATURE_ICON;

          return (
            <div key={idx} className="rounded-md border border-white/10 bg-zinc-950/60">
              <div className="flex items-center gap-2 px-2 py-2">
                <button
                  type="button"
                  onClick={() => toggleHighlight(idx)}
                  className={`${
                    item.data.highlighted
                      ? "text-amber-300"
                      : "text-white/30 hover:text-white/60"
                  }`}
                  title={item.data.highlighted ? "Plan mis en avant" : "Mettre en avant"}
                >
                  <Star
                    className="h-4 w-4"
                    fill={item.data.highlighted ? "currentColor" : "none"}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex-1 truncate text-left text-sm text-white/90"
                >
                  {item.data.name || (
                    <span className="text-white/40 italic">Plan {idx + 1}</span>
                  )}
                  {item.data.price && (
                    <span className="ml-2 text-xs text-white/50">
                      — {item.data.price}
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
                <div className="space-y-2 border-t border-white/10 px-3 py-3">
                  {/* Nom + Prix */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Nom du plan
                      </label>
                      <input
                        type="text"
                        value={item.data.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        placeholder="Starter"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Prix
                      </label>
                      <input
                        type="text"
                        value={item.data.price}
                        onChange={(e) => updateItem(idx, { price: e.target.value })}
                        placeholder="29€"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Période */}
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Période (optionnel)
                    </label>
                    <input
                      type="text"
                      value={item.data.period || ""}
                      onChange={(e) => updateItem(idx, { period: e.target.value })}
                      placeholder="/mois"
                      className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-white/60">
                      Description courte
                    </label>
                    <input
                      type="text"
                      value={item.data.description || ""}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      placeholder="Pour démarrer rapidement"
                      className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                    />
                  </div>

                  {/* Badge (uniquement si highlighted) */}
                  {item.data.highlighted && (
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">
                        Badge (sur le plan mis en avant)
                      </label>
                      <input
                        type="text"
                        value={item.data.badge || ""}
                        onChange={(e) => updateItem(idx, { badge: e.target.value })}
                        placeholder="Populaire"
                        className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* ─── Lot L : Icône des features ──────────────────── */}
                  <div className="rounded-md border border-white/10 bg-zinc-900/50 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[11px] font-medium text-white/70">
                        Icône des fonctionnalités
                      </label>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => propagateIconToAll(idx)}
                          className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200"
                          title="Appliquer la même icône à tous les plans"
                        >
                          <Copy className="h-3 w-3" />
                          Appliquer à tous
                        </button>
                      )}
                    </div>
                    <div className="flex items-start gap-3">
                      <IconPicker
                        value={icon.name}
                        size={icon.size as IconSize}
                        animation={icon.animation as IconAnimation}
                        onChange={(name: IconName) =>
                          updateFeatureIcon(idx, { name })
                        }
                        onSizeChange={(size) => updateFeatureIcon(idx, { size })}
                        onAnimationChange={(animation) =>
                          updateFeatureIcon(idx, { animation })
                        }
                      />
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-white/50 w-14 shrink-0">
                            Couleur
                          </label>
                          <input
                            type="color"
                            value={icon.color || "#31845C"}
                            onChange={(e) =>
                              updateFeatureIcon(idx, { color: e.target.value })
                            }
                            className="h-6 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
                            title="Couleur de l'icône (par défaut : accent de la section)"
                          />
                          {icon.color && (
                            <button
                              type="button"
                              onClick={() =>
                                updateFeatureIcon(idx, { color: undefined })
                              }
                              className="text-[10px] text-white/50 hover:text-white/80"
                              title="Réinitialiser à la couleur accent"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        {icon.size === "custom" && (
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-white/50 w-14 shrink-0">
                              Px
                            </label>
                            <input
                              type="number"
                              min={8}
                              max={128}
                              value={icon.customSizePx || 20}
                              onChange={(e) =>
                                updateFeatureIcon(idx, {
                                  customSizePx: parseInt(e.target.value, 10) || 20,
                                })
                              }
                              className="w-20 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Features list */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[11px] font-medium text-white/60">
                        Inclus dans ce plan
                      </label>
                      <button
                        type="button"
                        onClick={() => addFeature(idx)}
                        className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
                      >
                        <Plus className="h-3 w-3" />
                        Ajouter
                      </button>
                    </div>
                    <div className="space-y-1">
                      {(item.data.features || []).map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={feat}
                            onChange={(e) =>
                              updateFeature(idx, fIdx, e.target.value)
                            }
                            placeholder="Fonctionnalité…"
                            className="flex-1 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-xs text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeFeature(idx, fIdx)}
                            className="text-red-400/60 hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {(item.data.features || []).length === 0 && (
                        <div className="text-[11px] italic text-white/40">
                          Aucune fonctionnalité listée.
                        </div>
                      )}
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
