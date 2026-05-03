// components/funnel/wizard/FunnelKindStep.tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { FUNNEL_KINDS } from "@/lib/funnels/kinds";
import type { FunnelKind, Language } from "@/lib/funnels/types";
import { tWizard } from "@/lib/i18n/wizard";

type Props = {
  language: Language;
  value?: FunnelKind;
  onSelect: (kind: FunnelKind) => void;
};

export function FunnelKindStep({ language, value, onSelect }: Props) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black text-ink">{tWizard(language, "kind.title")}</h2>
        <p className="mt-1 text-xs text-muted">{tWizard(language, "kind.help")}</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {FUNNEL_KINDS.map((kind) => {
          const active = value === kind.id;
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() => onSelect(kind.id)}
              className={`group flex min-h-[88px] flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-all duration-200 ${
                active
                  ? "border-[#31845C] bg-[#31845C]/10 shadow-sm"
                  : "border-line bg-white hover:-translate-y-0.5 hover:border-[#080E1A]/30 hover:shadow-sm"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-bold text-ink">
                {kind.label[language]}
                {active && <CheckCircle2 size={14} className="text-[#31845C]" />}
              </span>
              <span className="text-xs leading-relaxed text-muted">
                {kind.hint[language]}
              </span>
              {kind.needsVideo && (
                <span className="mt-1 inline-flex rounded-full bg-softBlue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
                  Vidéo
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
