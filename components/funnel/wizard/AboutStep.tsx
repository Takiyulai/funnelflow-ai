// components/funnel/wizard/AboutStep.tsx
"use client";

import { Field, Textarea } from "@/components/ui/Field";
import type { Language } from "@/lib/funnels/types";
import { tWizard } from "@/lib/i18n/wizard";

type Props = {
  language: Language;
  value?: string;
  onChange: (text: string) => void;
};

export function AboutStep({ language, value, onChange }: Props) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black text-ink">
          {tWizard(language, "about.title")}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {tWizard(language, "about.help")}
        </p>
      </div>

      <Field label={tWizard(language, "step.about")}>
        <Textarea
          rows={6}
          value={value ?? ""}
          placeholder={tWizard(language, "about.placeholder")}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>

      <p className="rounded-lg bg-canvas p-3 text-xs text-muted">
        Astuce : 3 à 5 lignes suffisent. Mentionnez votre métier, votre expérience et un résultat marquant
      </p>
    </div>
  );
}
