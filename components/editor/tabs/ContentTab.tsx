"use client";

import { useRef } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { FunnelSection, IconName, Language } from "@/lib/funnels/types";
import { FaqEditor } from "./items/FaqEditor";
import { TestimonialsEditor } from "./items/TestimonialsEditor";
import { PricingEditor } from "./items/PricingEditor";
import { BonusEditor } from "./items/BonusEditor";
import { GuaranteeEditor } from "./items/GuaranteeEditor";
import { IconPicker, getIconByName } from "../IconPicker";
import { FormFieldsEditor } from "./items/FormFieldsEditor";
import { TextColorButton } from "../TextColorButton";
import { TimerEditor } from "./items/TimerEditor";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
  language?: Language;
};

export function ContentTab({ section, onChange }: Props) {
  // Sections spécialisées : on masque le timer "auto" dans GenericTextFields
  // et on le ré-injecte en bas, après l'éditeur spécialisé.
  const timerBlock = (
    <div className="border-t border-white/10 pt-4">
      <TimerEditor section={section} onChange={onChange} />
    </div>
  );

  if (section.type === "faq") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets hideTimer />
        <div className="border-t border-white/10 pt-4">
          <FaqEditor section={section} onChange={onChange} />
        </div>
        {timerBlock}
      </div>
    );
  }

  if (section.type === "proof") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets hideTimer />
        <div className="border-t border-white/10 pt-4">
          <TestimonialsEditor section={section} onChange={onChange} />
        </div>
        {timerBlock}
      </div>
    );
  }

  if (section.type === "pricing" || section.type === "offer") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets hideTimer />
        <div className="border-t border-white/10 pt-4">
          <PricingEditor section={section} onChange={onChange} />
        </div>
        {timerBlock}
      </div>
    );
  }

  if (section.type === "bonus") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets hideTimer />
        <div className="border-t border-white/10 pt-4">
          <BonusEditor section={section} onChange={onChange} />
        </div>
        {timerBlock}
      </div>
    );
  }

  if (section.type === "form") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets hideTimer />
        <div className="border-t border-white/10 pt-4">
          <FormFieldsEditor section={section} onChange={onChange} />
        </div>
        {timerBlock}
      </div>
    );
  }

  if (section.type === "guarantee") {
    return (
      <div className="space-y-4">
        <GenericTextFields section={section} onChange={onChange} hideBullets hideTimer />
        <div className="border-t border-white/10 pt-4">
          <GuaranteeEditor section={section} onChange={onChange} />
        </div>
        {timerBlock}
      </div>
    );
  }

  // Sections génériques (hero, cta, etc.) : le timer est rendu directement
  // à l'intérieur de GenericTextFields.
  return <GenericTextFields section={section} onChange={onChange} />;
}

/* ----------------------- Champs génériques ----------------------- */

function GenericTextFields({
  section,
  onChange,
  hideBullets,
  hideTimer,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
  hideBullets?: boolean;
  hideTimer?: boolean;
}) {
  // Refs pour chaque champ texte qui supporte le surlignage
  const eyebrowRef = useRef<HTMLInputElement>(null);
  const headlineRef = useRef<HTMLInputElement>(null);
  const subheadlineRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
      {/* Astuce d'utilisation */}
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-200/80">
        💡 Sélectionnez un mot dans un champ puis cliquez sur{" "}
        <span className="font-medium">Colorer</span> pour le mettre en valeur.
      </div>

      {/* Eyebrow */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-white/70">
            Suréclat (eyebrow)
          </label>
          <TextColorButton
            fieldRef={eyebrowRef}
            value={section.eyebrow || ""}
            onChange={(eyebrow) => onChange({ eyebrow })}
          />
        </div>
        <input
          ref={eyebrowRef}
          type="text"
          value={section.eyebrow || ""}
          onChange={(e) => onChange({ eyebrow: e.target.value })}
          placeholder="Petite étiquette au-dessus du titre"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      {/* Headline */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-white/70">
            Titre
          </label>
          <TextColorButton
            fieldRef={headlineRef}
            value={section.headline || ""}
            onChange={(headline) => onChange({ headline })}
          />
        </div>
        <input
          ref={headlineRef}
          type="text"
          value={section.headline || ""}
          onChange={(e) => onChange({ headline: e.target.value })}
          placeholder="Titre principal de la section"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      {/* Subheadline */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-white/70">
            Sous-titre
          </label>
          <TextColorButton
            fieldRef={subheadlineRef}
            value={section.subheadline || ""}
            onChange={(subheadline) => onChange({ subheadline })}
          />
        </div>
        <input
          ref={subheadlineRef}
          type="text"
          value={section.subheadline || ""}
          onChange={(e) => onChange({ subheadline: e.target.value })}
          placeholder="Sous-titre court"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      {/* Body */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-white/70">
            Texte principal
          </label>
          <TextColorButton
            fieldRef={bodyRef}
            value={section.body || ""}
            onChange={(body) => onChange({ body })}
          />
        </div>
        <textarea
          ref={bodyRef}
          value={section.body || ""}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Paragraphe descriptif…"
          rows={4}
          className="w-full resize-y rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      {/* Bullets */}
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
              size={(section as any).iconSize || "md"}
              animation={(section as any).iconAnimation || "none"}
              onChange={setBulletIcon}
              onSizeChange={(iconSize) =>
                onChange({ ...({ iconSize } as any) })
              }
              onAnimationChange={(iconAnimation) =>
                onChange({ ...({ iconAnimation } as any) })
              }
            />
          </div>

          <div className="space-y-1.5">
            {(section.bullets || []).map((b, idx) => (
              <BulletRow
                key={idx}
                value={b}
                idx={idx}
                isFirst={idx === 0}
                SelectedIcon={SelectedIcon}
                onUpdate={(v) => updateBullet(idx, v)}
                onMoveUp={() => moveBullet(idx, -1)}
                onRemove={() => removeBullet(idx)}
              />
            ))}
            {(section.bullets || []).length === 0 && (
              <div className="text-[11px] italic text-white/40">
                Aucune puce. Cliquez sur « Ajouter ».
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🆕 Timer — disponible sur toutes les sections génériques */}
      {!hideTimer && (
        <div className="border-t border-white/10 pt-3">
          <TimerEditor section={section} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

/* ----------------------- Bullet row avec colorer ----------------------- */

function BulletRow({
  value,
  idx,
  isFirst,
  SelectedIcon,
  onUpdate,
  onMoveUp,
  onRemove,
}: {
  value: string;
  idx: number;
  isFirst: boolean;
  SelectedIcon: React.ComponentType<{ className?: string }>;
  onUpdate: (v: string) => void;
  onMoveUp: () => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5">
      <SelectedIcon className="h-4 w-4 shrink-0 text-amber-300" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={`Point ${idx + 1}`}
        className="flex-1 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
      />
      <TextColorButton
        fieldRef={inputRef}
        value={value}
        onChange={onUpdate}
        label=""
        className="flex items-center justify-center rounded-md bg-amber-500/20 px-1.5 py-1 text-amber-300 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        className="text-white/40 hover:text-white disabled:opacity-30"
        title="Monter"
      >
        <GripVertical className="h-3.5 w-3.5 rotate-90" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-red-400/60 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
