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

    if (recommendedList.length === PREMIUM_TEMPLATES.length) {
      return { recommended: recommendedList, others: [] as TemplateDefinition[] };
    }

    const othersList = PREMIUM_TEMPLATES.filter((t) => !recommendedIds.has(t.id));
    return { recommended: recommendedList, others: othersList };
  }, [funnelKind]);

  const selected = selectedTemplateId ?? DEFAULT_PREMIUM_TEMPLATE_ID;
  const labels = LABELS[language] ?? LABELS.fr;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-xs font-medium text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          {labels.eyebrow}
        </div>
        <h2 className="text-2xl font-semibold text-white">{labels.title}</h2>
        <p className="max-w-2xl text-sm text-white/60">{labels.subtitle}</p>
      </header>

      {recommended.length > 0 && (
        <section className="space-y-3">
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
        <section className="space-y-3">
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
// Card individuelle — mini-aperçu réaliste avec les couleurs du template
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

  // previewColors: [bgDark, accent, secondary]
  const [bgDark, accent, secondary] = template.previewColors;

  // Pour "premium-minimal" et "lead-snap", la 3e couleur est blanche.
  // On utilise alors un fond clair pour le mini-aperçu, plus représentatif.
  const isLightTheme = secondary === "#FFFFFF" || secondary === "#ffffff";
  const cardBg = isLightTheme ? "#FAF8F3" : bgDark;
  const cardInk = isLightTheme ? bgDark : "#FFFFFF";
  const cardMuted = isLightTheme
    ? "rgba(8,14,26,0.55)"
    : "rgba(255,255,255,0.55)";

  // Sections count pour la jauge
  const sectionsCount = template.sections.length;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/60",
        isSelected
          ? "border-amber-400 bg-white/[0.04] shadow-[0_0_0_2px_rgba(251,191,36,0.4),0_8px_24px_-8px_rgba(251,191,36,0.3)] -translate-y-0.5"
          : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04] hover:-translate-y-0.5",
      ].join(" ")}
    >
      {/* Mini-aperçu réaliste du template */}
      <div
        className="relative aspect-[5/4] w-full overflow-hidden"
        style={{ backgroundColor: cardBg }}
      >
        {/* Bandeau supérieur (header marque) */}
        <div
          className="absolute left-0 right-0 top-0 h-5 flex items-center justify-center"
          style={{ backgroundColor: bgDark }}
        >
          <div
            className="h-1 w-10 rounded-full"
            style={{ backgroundColor: accent, opacity: 0.95 }}
          />
        </div>

        {/* Contenu central simulé */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 pt-8 pb-5 gap-1.5">
          {/* Eyebrow chip */}
          <div
            className="h-2 w-14 rounded-full"
            style={{ backgroundColor: accent, opacity: 0.85 }}
          />

          {/* Titre — 2 lignes */}
          <div className="flex flex-col items-center gap-1 w-full max-w-[85%] mt-1">
            <div
              className="h-2.5 w-full rounded-full"
              style={{ backgroundColor: cardInk, opacity: 0.9 }}
            />
            <div
              className="h-2.5 w-3/4 rounded-full"
              style={{ backgroundColor: cardInk, opacity: 0.9 }}
            />
          </div>

          {/* Sous-titre */}
          <div className="flex flex-col items-center gap-1 w-full max-w-[70%] mt-0.5">
            <div
              className="h-1.5 w-full rounded-full"
              style={{ backgroundColor: cardMuted }}
            />
            <div
              className="h-1.5 w-2/3 rounded-full"
              style={{ backgroundColor: cardMuted }}
            />
          </div>

          {/* Bouton CTA */}
          <div
            className="mt-2 h-5 w-24 rounded-md flex items-center justify-center shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <div
              className="h-1.5 w-12 rounded-full"
              style={{ backgroundColor: bgDark, opacity: 0.85 }}
            />
          </div>

          {/* Petite ligne de preuve sociale (3 dots + texte) */}
          <div className="flex items-center gap-1 mt-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: secondary, opacity: 0.7 }}
            />
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: secondary, opacity: 0.7 }}
            />
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: secondary, opacity: 0.7 }}
            />
            <div
              className="h-1 w-8 rounded-full ml-1"
              style={{ backgroundColor: cardMuted }}
            />
          </div>
        </div>

        {/* Badge type de template (en haut-gauche, sur le bandeau) */}
        <div className="absolute left-2 top-1 z-10">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm"
            style={{
              backgroundColor: accent,
              color: bgDark,
            }}
          >
            {template.badge}
          </span>
        </div>

        {/* Pastille recommandé */}
        {isRecommended && (
          <div className="absolute right-2 top-7 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-md">
              <Sparkles className="h-2.5 w-2.5" />
              Reco
            </span>
          </div>
        )}

        {/* Coche sélection */}
        {isSelected && (
          <div className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg ring-2 ring-black/30">
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Contenu textuel */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-white">{template.name}</h4>
          {/* Pastille de couleur d'accent */}
          <span
            className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20 shrink-0"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
            title="Couleur d'accent du template"
          />
        </div>

        <p className="text-xs leading-relaxed text-white/60 line-clamp-2 min-h-[2.5rem]">
          {personality}
        </p>

        <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-white/40 border-t border-white/5">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-white/70">{sectionsCount}</span>
            {LABELS_SECTIONS_GENERIC[language]}
          </span>
          <span className="capitalize px-2 py-0.5 rounded-full bg-white/5 text-white/50">
            {LABELS_DENSITY[language][template.density]}
          </span>
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
      "Chaque template apporte une personnalité visuelle distincte. Vous pourrez tout ajuster ensuite dans l'éditeur.",
    recommended: "Recommandés pour votre format",
    others: "Autres templates disponibles",
  },
  en: {
    eyebrow: "Premium templates",
    title: "Pick your funnel's vibe",
    subtitle:
      "Each template brings a distinct visual personality. You can fine-tune everything later in the editor.",
    recommended: "Recommended for your format",
    others: "Other available templates",
  },
  es: {
    eyebrow: "Plantillas premium",
    title: "Elige la atmósfera de tu funnel",
    subtitle:
      "Cada plantilla aporta una personalidad visual distinta. Podrás ajustar todo después en el editor.",
    recommended: "Recomendadas para tu formato",
    others: "Otras plantillas disponibles",
  },
};

const LABELS_SECTIONS_GENERIC: Record<Language, string> = {
  fr: "sections",
  en: "sections",
  es: "secciones",
};

const LABELS_DENSITY: Record<
  Language,
  Record<"dense" | "balanced" | "airy", string>
> = {
  fr: { dense: "dense", balanced: "équilibré", airy: "aéré" },
  en: { dense: "dense", balanced: "balanced", airy: "airy" },
  es: { dense: "denso", balanced: "equilibrado", airy: "aireado" },
};
