// components/funnel/wizard/MoodStep.tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { MOOD_PRESETS } from "@/lib/funnels/moods";
import type { Language, MoodId } from "@/lib/funnels/types";
import { tWizard } from "@/lib/i18n/wizard";

type Props = {
  language: Language;
  moodId?: MoodId;
  mainColor?: string;
  secondaryColor?: string;
  onChange: (patch: {
    moodId?: MoodId;
    mainColor?: string;
    secondaryColor?: string;
  }) => void;
};

export function MoodStep({
  language, moodId, mainColor, secondaryColor, onChange,
}: Props) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black text-ink">{tWizard(language, "mood.title")}</h2>
        <p className="mt-1 text-xs text-muted">{tWizard(language, "mood.help")}</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {MOOD_PRESETS.map((mood) => {
          const active = moodId === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() =>
                onChange({
                  moodId: mood.id,
                  mainColor: mood.primary,
                  secondaryColor: mood.secondary,
                })
              }
              className={`flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-all duration-200 ${
                active
                  ? "border-[#31845C] bg-[#31845C]/10 shadow-sm"
                  : "border-line bg-white hover:-translate-y-0.5 hover:border-[#080E1A]/30 hover:shadow-sm"
              }`}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-bold text-ink">
                {mood.label[language]}
                {active && <CheckCircle2 size={14} className="text-[#31845C]" />}
              </span>
              <span className="text-xs leading-relaxed text-muted">
                {mood.description[language]}
              </span>
              <span className="mt-1 flex gap-1.5">
                {[mood.primary, mood.secondary, mood.accent].map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-full border border-line"
                    style={{ background: c }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tWizard(language, "mood.primary")}>
          <Input
            type="color"
            value={mainColor ?? "#080E1A"}
            onChange={(e) => onChange({ mainColor: e.target.value })}
          />
        </Field>
        <Field label={tWizard(language, "mood.secondary")}>
          <Input
            type="color"
            value={secondaryColor ?? "#C7A436"}
            onChange={(e) => onChange({ secondaryColor: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
