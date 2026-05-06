"use client";

import {
  Check, Star, Zap, Shield, Gift, Heart, Award, Sparkles,
  Target, Trophy, Lock, Clock, Flame, Crown, ThumbsUp,
  CheckCircle, BadgeCheck, Rocket, Lightbulb, type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { IconName } from "@/lib/funnels/types";

const ICONS: { name: IconName; Icon: LucideIcon; label: string }[] = [
  { name: "check", Icon: Check, label: "Check" },
  { name: "checkCircle" as IconName, Icon: CheckCircle, label: "Check rond" },
  { name: "badgeCheck" as IconName, Icon: BadgeCheck, label: "Badge" },
  { name: "star", Icon: Star, label: "Étoile" },
  { name: "zap", Icon: Zap, label: "Éclair" },
  { name: "shield", Icon: Shield, label: "Bouclier" },
  { name: "gift", Icon: Gift, label: "Cadeau" },
  { name: "heart", Icon: Heart, label: "Cœur" },
  { name: "award", Icon: Award, label: "Récompense" },
  { name: "sparkles", Icon: Sparkles, label: "Étincelles" },
  { name: "target", Icon: Target, label: "Cible" },
  { name: "trophy" as IconName, Icon: Trophy, label: "Trophée" },
  { name: "lock", Icon: Lock, label: "Sécurité" },
  { name: "clock", Icon: Clock, label: "Temps" },
  { name: "flame" as IconName, Icon: Flame, label: "Flamme" },
  { name: "crown" as IconName, Icon: Crown, label: "Couronne" },
  { name: "thumbs-up" as IconName, Icon: ThumbsUp, label: "Pouce" },
  { name: "rocket", Icon: Rocket, label: "Fusée" },
  { name: "lightbulb", Icon: Lightbulb, label: "Idée" },
];

export function getIconByName(name?: IconName | string): LucideIcon {
  return ICONS.find((i) => i.name === name)?.Icon || Check;
}

type Props = {
  value: IconName;
  onChange: (icon: IconName) => void;
  compact?: boolean;
};

export function IconPicker({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const Selected = getIconByName(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white hover:border-amber-300/40 ${
          compact ? "w-auto" : "w-full"
        }`}
      >
        <Selected className="h-4 w-4 text-amber-300" />
        {!compact && (
          <span className="flex-1 text-left text-xs">
            {ICONS.find((i) => i.name === value)?.label || "Icône"}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 grid w-64 grid-cols-5 gap-1 rounded-md border border-white/15 bg-zinc-900 p-2 shadow-xl">
            {ICONS.map(({ name, Icon, label }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                title={label}
                className={`flex h-9 items-center justify-center rounded-md border ${
                  value === name
                    ? "border-amber-300/60 bg-amber-500/10"
                    : "border-transparent hover:border-white/15 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 text-amber-300" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
