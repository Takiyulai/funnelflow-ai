"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import type { FunnelSection, IconName } from "@/lib/funnels/types";
import { FaqEditor } from "./items/FaqEditor";
import { TestimonialsEditor } from "./items/TestimonialsEditor";
import { PricingEditor } from "./items/PricingEditor";
import { BonusEditor } from "./items/BonusEditor";
import { GuaranteeEditor } from "./items/GuaranteeEditor";
import { IconPicker, getIconByName } from "./items/IconPicker";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

export function ContentTab({ section, onChange }: Props) {
  // Dispatcher vers les éditeurs spécialisés
  if (section.type === "faq") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets />
        <div className="border-t border-white/10 pt-4">
          <FaqEditor section={section} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (section.type === "testimonials" || section.type === "proof") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets />
        <div className="border-t border-white/10 pt-4">
          <TestimonialsEditor section={section} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (section.type === "pricing" || section.type === "offer") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets />
        <div className="border-t border-white/10 pt-4">
          <PricingEditor section={section} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (section.type === "bonus") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets />
        <div className="border-t border-white/10 pt-4">
          <BonusEditor section={section} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (section.type === "guarantee") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets />
        <div className="border-t border-white/10 pt-4">
          <GuaranteeEditor section={section} onChange={onChange} />
        </div>
      </div>
    );
  }

  // Cas générique : hero, benefits, features, cta, etc.
  return <GenericTextFields section={section} onChange={onChange} />;
}

/* ----------------------- Champs génériques ----------------------- */

function GenericTextFields({
  section,
  onChange,
  hideBullets,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
  hideBullets?: boolean;
}) {
  const updateBullet = (idx: number, value: string) => {
    const bullets = [...(section.bullets || [])];
    bullets[idx] = value;
    onChange({ bullets });
  };

  const addBullet = () => {
    onChange({ bullets: [...(section.bullets || []), ""] });
  };

  const removeBullet = (idx: number) => {
    onChange({ bullets: (section.bullets || []).filter((_, i) => i !== idx) });
  };

  const moveBullet = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    const bullets = [...(section.bullets || [])];
    if (newIdx < 0 || newIdx >= bullets.length) return;
    [bullets[idx], bullets[newIdx]] = [bullets[newIdx], bullets[idx]];
    onChange({ bullets });
  };

  const setBulletIcon = (iconName: IconName) => {
    onChange({ iconName });
  };

  const SelectedIcon = getIconByName(section.iconName);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-white/70">
          Suréclat (eyebrow)
        </label>
        <input
          type="text"
          value={section.eyebrow || ""}
          onChange={(e) => onChange({ eyebrow: e.target.value })}
          placeholder="Petite étiquette au-dessus du titre"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/70">
          Titre
        </label>
        <input
          type="text"
          value={section.headline || ""}
          onChange={(e) => onChange({ headline: e.target.value })}
          placeholder="Titre principal de la section"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/70">
          Sous-titre
        </label>
        <input
          type="text"
          value={section.subheadline || ""}
          onChange={(e) => onChange({ subheadline: e.target.value })}
          placeholder="Sous-titre court"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/70">
          Texte principal
        </label>
        <textarea
          value={section.body || ""}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Paragraphe descriptif…"
          rows={4}
          className="w-full resize-y rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      {!hideBullets && (
        <div className="rounded-md border border-white/10 bg-zinc-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-white/70">
              Liste à puces
            </label>
            <button
              type="button"
              onClick={addBullet}
              className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30"
            >
              <Plus className="h-3 w-3" />
              Ajouter
            </button>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] text-white/50">Icône des puces :</span>
            <IconPicker
              value={section.iconName || "check"}
              onChange={setBulletIcon}
              compact
            />
          </div>

          <div className="space-y-1.5">
            {(section.bullets || []).map((b, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <SelectedIcon className="h-4 w-4 shrink-0 text-amber-300" />
                <input
                  type="text"
                  value={b}
                  onChange={(e) => updateBullet(idx, e.target.value)}
                  placeholder={`Point ${idx + 1}`}
                  className="flex-1 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => moveBullet(idx, -1)}
                  disabled={idx === 0}
                  className="text-white/40 hover:text-white disabled:opacity-30"
                  title="Monter"
                >
                  <GripVertical className="h-3.5 w-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBullet(idx)}
                  className="text-red-400/60 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(section.bullets || []).length === 0 && (
              <div className="text-[11px] italic text-white/40">
                Aucune puce. Cliquez sur « Ajouter ».
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
