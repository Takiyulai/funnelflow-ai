"use client";

import { useMemo } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  PREMIUM_TEMPLATES,
  getRecommendedTemplates,
  DEFAULT_PREMIUM_TEMPLATE_ID,
} from "@/lib/funnels/templates";
import type {
  FunnelKind,
  Language,
  TemplateDefinition,
} from "@/lib/funnels/types";

type Props = {
  funnelKind?: FunnelKind;
  language: Language;
  selectedTemplateId?: string;
  onSelect: (templateId: string) => void;
};

export default function TemplateGalleryStep({
  funnelKind,
  language,
  selectedTemplateId,
  onSelect,
}: Props) {
  const { recommended, others } = useMemo(() => {
    const recommendedList = getRecommendedTemplates(funnelKind);
    const recommendedIds = new Set(recommendedList.map((t) => t.id));

    // Si tous les templates sont recommandés (pas de funnelKind), on n'affiche
    // qu'une seule liste pour éviter la duplication
    if (recommendedList.length === PREMIUM_TEMPLATES.length) {
      return { recommended: recommendedList, others: [] as TemplateDefinition[] };
    }

    const othersList = PREMIUM_TEMPLATES.filter((t) => !recommendedIds.has(t.id));
    return { recommended: recommendedList, others: othersList };
  }, [funnelKind]);

  const selected = selectedTemplateId ?? DEFAULT_PREMIUM_TEMPLATE_ID;

  const labels = LABELS[language] ?? LABELS.fr;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-xs font-medium text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          {labels.eyebrow}
        </div>
        <h2 className="text-2xl font-semibold text-white">{labels.title}</h2>
        <p className="max-w-2xl text-sm text-white/60">{labels.subtitle}</p>
      </header>

      {recommended.length > 0 && (
        <section className="space-y-4">
          {others.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
              {labels.recommended}
            </h3>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((tpl) => (
              <TemplateCardItem
                key={tpl.id}
                template={tpl}
                language={language}
                isSelected={selected === tpl.id}
                isRecommended={others.length > 0}
                onClick={() => onSelect(tpl.id)}
              />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {labels.others}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((tpl) => (
              <TemplateCardItem
                key={tpl.id}
                template={tpl}
                language={language}
                isSelected={selected === tpl.id}
                isRecommended={false}
                onClick={() => onSelect(tpl.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card individuelle
// ─────────────────────────────────────────────────────────────────────────────

type CardProps = {
  template: TemplateDefinition;
  language: Language;
  isSelected: boolean;
  isRecommended: boolean;
  onClick: () => void;
};

function TemplateCardItem({
  template,
  language,
  isSelected,
  isRecommended,
  onClick,
}: CardProps) {
  const personality =
    template.personality[language] ?? template.personality.fr;
  const [c1, c2, c3] = template.previewColors;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/60",
        isSelected
          ? "border-amber-400 bg-white/[0.04] shadow-[0_0_0_1px_rgba(251,191,36,0.5)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]",
      ].join(" ")}
    >
      {/* Aperçu coloré (3 bandes) */}
      <div className="relative h-24 w-full overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-3">
          <div style={{ backgroundColor: c1 }} />
          <div style={{ backgroundColor: c2 }} />
          <div style={{ backgroundColor: c3 }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badge */}
        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            {template.badge}
          </span>
        </div>

        {/* Pastille recommandé */}
        {isRecommended && (
          <div className="absolute right-3 top-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">
              <Sparkles className="h-3 w-3" />
              Reco
            </span>
          </div>
        )}

        {/* Coche sélection */}
        {isSelected && (
          <div className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg">
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h4 className="text-base font-semibold text-white">{template.name}</h4>
        <p className="text-xs leading-relaxed text-white/60">{personality}</p>

        <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-white/40">
          <span>
            {template.sections.length} {LABELS_SECTIONS_GENERIC[language]}
          </span>
          <span className="capitalize">{template.density}</span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// i18n local
// ─────────────────────────────────────────────────────────────────────────────

const LABELS: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    recommended: string;
    others: string;
  }
> = {
  fr: {
    eyebrow: "Templates premium",
    title: "Choisissez l'ambiance de votre tunnel",
    subtitle:
      "Chaque template apporte une personnalité visuelle distincte : structure des sections, animations, densité. Vous pourrez tout ajuster ensuite dans l'éditeur.",
    recommended: "Recommandés pour votre format",
    others: "Autres templates disponibles",
  },
  en: {
    eyebrow: "Premium templates",
    title: "Pick your funnel's vibe",
    subtitle:
      "Each template brings a distinct visual personality: section structure, animations, density. You can fine-tune everything later in the editor.",
    recommended: "Recommended for your format",
    others: "Other available templates",
  },
  es: {
    eyebrow: "Plantillas premium",
    title: "Elige la atmósfera de tu funnel",
    subtitle:
      "Cada plantilla aporta una personalidad visual distinta: estructura de secciones, animaciones, densidad. Podrás ajustar todo después en el editor.",
    recommended: "Recomendadas para tu formato",
    others: "Otras plantillas disponibles",
  },
};

const LABELS_SECTIONS_GENERIC: Record<Language, string> = {
  fr: "sections",
  en: "sections",
  es: "secciones",
};
