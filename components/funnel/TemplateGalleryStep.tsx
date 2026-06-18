"use client";

import { useMemo } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  PREMIUM_TEMPLATES,
  getRecommendedTemplates,
  DEFAULT_PREMIUM_TEMPLATE_ID,
  getPremiumTemplate,
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
    <div className="space-y-5 min-w-0">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#C7A436]/40 bg-[#C7A436]/10 px-3 py-1 text-[11px] font-bold text-[#8a6f1f]">
          <Sparkles className="h-3.5 w-3.5" />
          {labels.eyebrow}
        </div>
        <h2 className="text-xl font-black text-ink">{labels.title}</h2>
        <p className="max-w-2xl text-xs text-muted leading-relaxed">{labels.subtitle}</p>
      </header>
      {recommended.length > 0 && (
        <section className="space-y-3 min-w-0">
          {others.length > 0 && (
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#31845C]">
              {labels.recommended}
            </h3>
          )}
          <div className="grid gap-3 min-w-0 justify-start [grid-template-columns:repeat(auto-fill,minmax(180px,220px))]">
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
        <section className="space-y-3 min-w-0">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {labels.others}
          </h3>
          <div className="grid gap-3 min-w-0 justify-start [grid-template-columns:repeat(auto-fill,minmax(180px,220px))]">
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
// Card individuelle — thème CLAIR, contraste accru
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

  const isLightTheme = secondary === "#FFFFFF" || secondary === "#ffffff";
  const cardBg = isLightTheme ? "#FAF8F3" : bgDark;
  const cardInk = isLightTheme ? bgDark : "#FFFFFF";
  const cardMuted = isLightTheme
    ? "rgba(8,14,26,0.55)"
    : "rgba(255,255,255,0.55)";

  const sectionsCount = template.sections.length;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        "group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all duration-200 bg-white min-w-0",
        "focus:outline-none focus:ring-2 focus:ring-[#C7A436]/50",
        isSelected
          ? "border-[#31845C] shadow-[0_0_0_2px_rgba(49,132,92,0.15),0_8px_20px_-8px_rgba(49,132,92,0.35)] -translate-y-0.5"
          : "border-line hover:border-[#080E1A]/40 hover:shadow-md hover:-translate-y-0.5",
      ].join(" ")}
    >
      {/* Mini-aperçu réaliste du template */}
      <div
        className="relative aspect-[5/4] w-full overflow-hidden border-b border-line"
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

          {/* Petite ligne de preuve sociale */}
          <div className="flex items-center gap-1 mt-1.5">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: secondary, opacity: 0.7 }} />
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: secondary, opacity: 0.7 }} />
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: secondary, opacity: 0.7 }} />
            <div className="h-1 w-8 rounded-full ml-1" style={{ backgroundColor: cardMuted }} />
          </div>
        </div>

        {/* Badge type de template */}
        <div className="absolute left-2 top-1 z-10">
          <span
            className="inline-flex max-w-[calc(100%-1rem)] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm"
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
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C7A436] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#080E1A] shadow-md">
              <Sparkles className="h-2.5 w-2.5" />
              Reco
            </span>
          </div>
        )}

        {/* Coche sélection */}
        {isSelected && (
          <div className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#31845C] text-white shadow-lg ring-2 ring-white">
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Contenu textuel — THÈME CLAIR */}
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4 bg-white min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h4 className="text-sm sm:text-base font-black text-ink truncate">{template.name}</h4>
          <span
            className="inline-block h-3 w-3 rounded-full ring-1 ring-line shrink-0"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
            title="Couleur d'accent du template"
          />
        </div>

        <p className="text-[11px] sm:text-xs leading-relaxed text-muted line-clamp-2 min-h-[2.2rem]">
          {personality}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 text-[10px] sm:text-[11px] text-muted border-t border-line min-w-0">
          <span className="inline-flex items-center gap-1 min-w-0 truncate">
            <span className="font-bold text-ink">{sectionsCount}</span>
            <span className="truncate">{LABELS_SECTIONS_GENERIC[language]}</span>
          </span>
          <span className="capitalize px-2 py-0.5 rounded-full bg-canvas text-ink font-semibold shrink-0">
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
