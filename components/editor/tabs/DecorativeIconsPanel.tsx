"use client";

import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";
import type {
  FunnelSection,
  DecorativeIcon,
  DecorativeIconPosition,
  IconConfig,
  IconName,
  IconSize,
  IconAnimation,
} from "@/lib/funnels/types";
import { IconPicker } from "@/components/editor/IconPicker";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
  /** Si true, le panneau est replié par défaut */
  collapsedByDefault?: boolean;
};

const POSITION_OPTIONS: { value: DecorativeIconPosition; label: string; group: string }[] = [
  { value: "top-left",        label: "Coin haut-gauche",   group: "Coins" },
  { value: "top-center",      label: "Haut-centre",        group: "Coins" },
  { value: "top-right",       label: "Coin haut-droit",    group: "Coins" },
  { value: "bottom-left",     label: "Coin bas-gauche",    group: "Coins" },
  { value: "bottom-center",   label: "Bas-centre",         group: "Coins" },
  { value: "bottom-right",    label: "Coin bas-droit",     group: "Coins" },
  { value: "before-headline", label: "Avant le titre",     group: "Inline" },
  { value: "after-headline",  label: "Après le titre",     group: "Inline" },
  { value: "before-cta",      label: "Avant le bouton",    group: "Inline" },
  { value: "after-cta",       label: "Après le bouton",    group: "Inline" },
  { value: "floating-bg",     label: "Arrière-plan déco",  group: "Décor" },
];

const DEFAULT_NEW_ICON = (): DecorativeIcon => ({
  id: `deco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  icon: { name: "sparkles", size: "md", animation: "none" },
  position: "top-right",
});

export function DecorativeIconsPanel({
  section,
  onChange,
  collapsedByDefault = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const icons = section.decorativeIcons ?? [];

  const update = (next: DecorativeIcon[]) => onChange({ decorativeIcons: next });

  const addIcon = () => {
    const next = [...icons, DEFAULT_NEW_ICON()];
    update(next);
    setOpenIdx(next.length - 1);
    setCollapsed(false);
  };

  const removeIcon = (idx: number) => {
    update(icons.filter((_, i) => i !== idx));
    if (openIdx === idx) setOpenIdx(null);
  };

  const updateIcon = (idx: number, patch: Partial<DecorativeIcon>) => {
    update(icons.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const updateIconConfig = (idx: number, patch: Partial<IconConfig>) => {
    update(
      icons.map((it, i) =>
        i === idx ? { ...it, icon: { ...it.icon, ...patch } } : it
      )
    );
  };

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/40">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-xs font-semibold text-white/80">
            Icônes décoratives
          </span>
          {icons.length > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              {icons.length}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-white/40 transition-transform ${
            collapsed ? "" : "rotate-180"
          }`}
        />
      </button>

      {!collapsed && (
        <div className="space-y-2 border-t border-white/10 p-3">
          <p className="text-[10px] text-white/40">
            Ajoute des icônes décoratives n'importe où dans la section :
            dans un coin, autour du titre, du bouton, ou en arrière-plan.
          </p>

          <button
            type="button"
            onClick={addIcon}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-amber-300/30 bg-amber-500/[0.04] px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/[0.08]"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une icône
          </button>

          {icons.length === 0 && (
            <div className="rounded-md border border-dashed border-white/10 p-3 text-center text-[11px] italic text-white/40">
              Aucune icône décorative dans cette section.
            </div>
          )}

          <div className="space-y-1.5">
            {icons.map((deco, idx) => {
              const isOpen = openIdx === idx;
              const posLabel =
                POSITION_OPTIONS.find((p) => p.value === deco.position)?.label ??
                deco.position;

              return (
                <div
                  key={deco.id}
                  className="rounded-md border border-white/10 bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <IconPicker
                      compact
                      value={deco.icon.name}
                      onChange={(name: IconName) =>
                        updateIconConfig(idx, { name })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setOpenIdx(isOpen ? null : idx)}
                      className="flex-1 truncate text-left text-[11px] text-white/80"
                    >
                      {deco.label || (
                        <span className="text-white/50">{deco.icon.name}</span>
                      )}
                      <span className="ml-1.5 text-[10px] text-white/40">
                        — {posLabel}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenIdx(isOpen ? null : idx)}
                      className="text-white/40 hover:text-white"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIcon(idx)}
                      className="text-red-400/60 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="space-y-2 border-t border-white/10 px-3 py-2.5">
                      {/* Position */}
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-white/60">
                          Position
                        </label>
                        <select
                          value={deco.position}
                          onChange={(e) =>
                            updateIcon(idx, {
                              position: e.target.value as DecorativeIconPosition,
                            })
                          }
                          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                        >
                          <optgroup label="Coins de la section">
                            {POSITION_OPTIONS.filter((p) => p.group === "Coins").map(
                              (p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              )
                            )}
                          </optgroup>
                          <optgroup label="Autour du contenu">
                            {POSITION_OPTIONS.filter((p) => p.group === "Inline").map(
                              (p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              )
                            )}
                          </optgroup>
                          <optgroup label="Décoration">
                            {POSITION_OPTIONS.filter((p) => p.group === "Décor").map(
                              (p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              )
                            )}
                          </optgroup>
                        </select>
                      </div>

                      {/* Label */}
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-white/60">
                          Texte à côté (optionnel)
                        </label>
                        <input
                          type="text"
                          value={deco.label || ""}
                          onChange={(e) =>
                            updateIcon(idx, { label: e.target.value })
                          }
                          placeholder="Ex: Nouveau, Best-seller…"
                          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                        />
                      </div>

                      {/* Taille + Animation */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Taille
                          </label>
                          <select
                            value={deco.icon.size ?? "md"}
                            onChange={(e) =>
                              updateIconConfig(idx, {
                                size: e.target.value as IconSize,
                              })
                            }
                            className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                          >
                            <option value="sm">S (16px)</option>
                            <option value="md">M (20px)</option>
                            <option value="lg">L (28px)</option>
                            <option value="xl">XL (36px)</option>
                            <option value="custom">Personnalisée</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Animation
                          </label>
                          <select
                            value={deco.icon.animation ?? "none"}
                            onChange={(e) =>
                              updateIconConfig(idx, {
                                animation: e.target.value as IconAnimation,
                              })
                            }
                            className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                          >
                            <option value="none">Aucune</option>
                            <option value="pulse">Pulse</option>
                            <option value="bounce">Rebond</option>
                            <option value="spin">Rotation</option>
                            <option value="wiggle">Agité</option>
                            <option value="float">Flottant</option>
                          </select>
                        </div>
                      </div>

                      {/* Taille custom en px */}
                      {deco.icon.size === "custom" && (
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Taille personnalisée (px)
                          </label>
                          <input
                            type="number"
                            min={8}
                            max={400}
                            value={deco.icon.customSizePx || 32}
                            onChange={(e) =>
                              updateIconConfig(idx, {
                                customSizePx:
                                  parseInt(e.target.value, 10) || 32,
                              })
                            }
                            className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Couleur + Opacité */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Couleur
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={deco.icon.color || "#31845C"}
                              onChange={(e) =>
                                updateIconConfig(idx, { color: e.target.value })
                              }
                              className="h-7 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
                            />
                            {deco.icon.color && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateIconConfig(idx, { color: undefined })
                                }
                                className="text-[10px] text-white/50 hover:text-white/80"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Opacité ({Math.round((deco.opacity ?? 1) * 100)}%)
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={deco.opacity ?? 1}
                            onChange={(e) =>
                              updateIcon(idx, {
                                opacity: parseFloat(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Décalage X/Y + Rotation */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Décal. X (px)
                          </label>
                          <input
                            type="number"
                            value={deco.offsetX ?? 0}
                            onChange={(e) =>
                              updateIcon(idx, {
                                offsetX: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Décal. Y (px)
                          </label>
                          <input
                            type="number"
                            value={deco.offsetY ?? 0}
                            onChange={(e) =>
                              updateIcon(idx, {
                                offsetY: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-white/60">
                            Rotation (°)
                          </label>
                          <input
                            type="number"
                            min={-180}
                            max={180}
                            value={deco.rotation ?? 0}
                            onChange={(e) =>
                              updateIcon(idx, {
                                rotation: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white focus:border-amber-300/40 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
