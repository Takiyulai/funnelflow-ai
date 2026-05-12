"use client";

import {
  Check, Star, Zap, Shield, Gift, Heart, Award, Sparkles,
  Target, Trophy, Lock, Clock, Flame, Crown, ThumbsUp,
  CheckCircle, BadgeCheck, Rocket, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type {
  IconName,
  IconSize,
  IconAnimation,
} from "@/lib/funnels/types";

/**
 * Liste des icônes disponibles dans le picker.
 * Doit rester synchronisée avec :
 *   - le type IconName dans lib/funnels/types.ts
 *   - la map ICON_MAP dans components/funnel/IconRenderer.tsx
 */
const ICONS: { name: IconName; Icon: LucideIcon; label: string }[] = [
  { name: "check",       Icon: Check,       label: "Check" },
  { name: "checkCircle", Icon: CheckCircle, label: "Check rond" },
  { name: "badgeCheck",  Icon: BadgeCheck,  label: "Badge" },
  { name: "star",        Icon: Star,        label: "Étoile" },
  { name: "zap",         Icon: Zap,         label: "Éclair" },
  { name: "shield",      Icon: Shield,      label: "Bouclier" },
  { name: "gift",        Icon: Gift,        label: "Cadeau" },
  { name: "heart",       Icon: Heart,       label: "Cœur" },
  { name: "award",       Icon: Award,       label: "Récompense" },
  { name: "sparkles",    Icon: Sparkles,    label: "Étincelles" },
  { name: "target",      Icon: Target,      label: "Cible" },
  { name: "trophy",      Icon: Trophy,      label: "Trophée" },
  { name: "lock",        Icon: Lock,        label: "Cadenas" },
  { name: "clock",       Icon: Clock,       label: "Horloge" },
  { name: "flame",       Icon: Flame,       label: "Flamme" },
  { name: "crown",       Icon: Crown,       label: "Couronne" },
  { name: "thumbsUp",    Icon: ThumbsUp,    label: "Pouce" },
  { name: "rocket",      Icon: Rocket,      label: "Fusée" },
  { name: "lightbulb",   Icon: Lightbulb,   label: "Idée" },
];

const SIZES: { value: Exclude<IconSize, "custom">; label: string; px: number }[] = [
  { value: "sm", label: "S",  px: 16 },
  { value: "md", label: "M",  px: 20 },
  { value: "lg", label: "L",  px: 28 },
  { value: "xl", label: "XL", px: 36 },
];

const ANIMATIONS: { value: IconAnimation; label: string }[] = [
  { value: "none",   label: "Aucune" },
  { value: "pulse",  label: "Pulse" },
  { value: "bounce", label: "Rebond" },
  { value: "spin",   label: "Rotation" },
  { value: "wiggle", label: "Agité" },
  { value: "float",  label: "Flottant" },
];

/**
 * Helper utilisé par FunnelPreview/SectionRenderer pour récupérer
 * le composant icône à partir de son nom.
 *
 * ⚠️ Préférer désormais `getIconComponent` exporté par
 *    components/funnel/IconRenderer.tsx (gère la normalisation legacy).
 */
export function getIconByName(name?: IconName | string): LucideIcon {
  if (!name) return Check;
  const found = ICONS.find((i) => i.name === name);
  return found ? found.Icon : Check;
}

interface IconPickerProps {
  value?: IconName;
  size?: IconSize;
  animation?: IconAnimation;
  /** Mode compact : bouton plus petit, pas de sélecteurs taille/animation par défaut. */
  compact?: boolean;
  onChange: (icon: IconName) => void;
  onSizeChange?: (size: IconSize) => void;
  onAnimationChange?: (anim: IconAnimation) => void;
}

export function IconPicker({
  value,
  size = "md",
  animation = "none",
  compact = false,
  onChange,
  onSizeChange,
  onAnimationChange,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const Selected = ICONS.find((i) => i.name === value)?.Icon ?? Check;

  // En mode compact, on cache les sélecteurs taille/animation même si les
  // callbacks sont passés (pour ne pas surcharger l'UI dans les listes).
  const showSize = !compact && Boolean(onSizeChange);
  const showAnim = !compact && Boolean(onAnimationChange);

  const triggerSize = compact ? "h-7 w-7" : "h-9 w-9";
  const triggerIconCls = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition ${triggerSize}`}
        title="Choisir une icône"
      >
        <Selected className={triggerIconCls} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
            {/* Grille d'icônes */}
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Icône
              </div>
              <div className="grid grid-cols-6 gap-1">
                {ICONS.map(({ name, Icon, label }) => {
                  const active = name === value;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onChange(name);
                        if (compact) setOpen(false);
                      }}
                      title={label}
                      className={`flex h-8 w-8 items-center justify-center rounded transition ${
                        active
                          ? "bg-indigo-500 text-white"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sélecteur de taille */}
            {showSize && (
              <div className="mb-3">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Taille
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {SIZES.map((s) => {
                    const active = s.value === size;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => onSizeChange!(s.value)}
                        className={`h-7 rounded text-xs font-medium transition ${
                          active
                            ? "bg-indigo-500 text-white"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sélecteur d'animation */}
            {showAnim && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Animation
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {ANIMATIONS.map((a) => {
                    const active = a.value === animation;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => onAnimationChange!(a.value)}
                        className={`h-7 rounded text-[11px] font-medium transition ${
                          active
                            ? "bg-indigo-500 text-white"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { ICONS };
