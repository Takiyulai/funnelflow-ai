"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Image as ImageIcon,
  MousePointerClick,
  Palette,
  Layers,
} from "lucide-react";
import type { FunnelSection, Language, Funnel } from "@/lib/funnels/types";
import { ContentTab } from "@/components/editor/tabs/ContentTab";
import { MediaTab } from "@/components/editor/tabs/MediaTab";
import { CtaTab } from "@/components/editor/tabs/CtaTab";
import { StyleTab } from "@/components/editor/tabs/StyleTab";
import { BackgroundTab } from "@/components/editor/tabs/BackgroundTab";
import { RawHtmlContentTab } from "@/components/editor/tabs/RawHtmlContentTab";
import { BookingContentTab } from "@/components/editor/tabs/BookingContentTab";
import { SectionRegenPanel } from "@/components/editor/SectionRegenPanel";
import { RAW_HTML_BODY_MARKER } from "@/lib/clone/section-mapper";

type TabId = "content" | "media" | "cta" | "style" | "background";

type Props = {
  section: FunnelSection;
  language: Language;
  funnel: Funnel;
  onChange: (patch: Partial<FunnelSection>) => void;
  // 🆕 Requis par l'onglet CTA pour la case « Appliquer cette action à tous
  // les CTA de la page » (écrit funnel.defaultCta / funnel.meta au niveau
  // du funnel entier, pas seulement de la section active).
  onFunnelChange: (patch: Partial<Funnel>) => void;
};

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "content", label: "Contenu", icon: FileText },
  { id: "media", label: "Média", icon: ImageIcon },
  { id: "cta", label: "CTA", icon: MousePointerClick },
  { id: "style", label: "Style", icon: Palette },
  { id: "background", label: "Fond", icon: Layers },
];

// 🆕 Pour une section raw-html (issue d'un clonage), seul l'onglet Contenu
// est pertinent en V1. Les autres onglets (Média, CTA, Style, Fond) seront
// remplacés par des équivalents raw-html dans les étapes 2-4.
const TABS_RAW_HTML: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "content", label: "Contenu", icon: FileText },
];

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  about: "À propos",
  problem: "Problème",
  solution: "Solution",
  benefits: "Bénéfices",
  features: "Fonctionnalités",
  proof: "Preuve sociale",
  testimonials: "Témoignages",
  offer: "Offre",
  pricing: "Tarifs",
  bonus: "Bonus",
  guarantee: "Garantie",
  faq: "FAQ",
  cta: "Appel à l'action",
  form: "Formulaire",
  webinar: "Webinaire",
  vsl: "VSL",
  qualification: "Qualification",
  booking: "Prise de rendez-vous",
  "raw-html": "Section clonée",
};

export function SectionEditor({ section, language, funnel, onChange, onFunnelChange }: Props) {
  // 🆕 Détecte si la section est un contenu raw-html cloné.
  // On vérifie à la fois le type ET le marqueur dans body (double sécurité,
  // car certaines sections clonées pourraient avoir un type différent).
  const isRawHtml = useMemo(
    () =>
      section.type === ("raw-html" as FunnelSection["type"]) ||
      (typeof section.body === "string" &&
        section.body.startsWith(RAW_HTML_BODY_MARKER)),
    [section.type, section.body],
  );

  // 🆕 Section « Prise de RDV » : le contenu est produit par le calendrier
  // lui-même. Les onglets Média et CTA n'ont rien à piloter ici — les afficher
  // ne ferait qu'ouvrir des réglages sans effet.
  const isBooking = section.type === ("booking" as FunnelSection["type"]);

  const availableTabs = isRawHtml
    ? TABS_RAW_HTML
    : isBooking
      ? TABS.filter((t) => t.id === "content" || t.id === "style" || t.id === "background")
      : TABS;

  // 🆕 Si l'onglet actif n'existe pas dans la liste disponible
  // (cas d'un toggle entre section native et raw-html), on retombe sur "content".
  const [activeTab, setActiveTab] = useState<TabId>("content");
  const safeActiveTab = availableTabs.some((t) => t.id === activeTab)
    ? activeTab
    : "content";

  const sectionLabel = SECTION_LABELS[section.type] ?? section.type;

  return (
    <div className="rounded-2xl border border-white/15 bg-zinc-900 shadow-lg min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 sm:px-4 py-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            Section
            {isRawHtml && (
              <span className="ml-2 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                CLONÉE
              </span>
            )}
          </div>
          <div className="truncate text-sm font-semibold text-white">
            {sectionLabel}
          </div>
        </div>
        <div className="hidden sm:block text-[10px] text-white/40 shrink-0 truncate max-w-[140px]">
          id: {section.id}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 bg-zinc-950/50 px-2 pt-2 overflow-x-auto scrollbar-thin min-w-0">
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = safeActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-2.5 sm:px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "border-amber-300 bg-zinc-900 text-amber-300"
                  : "border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-4 p-3 sm:p-4 text-white min-w-0">
        {/* 🆕 Routing : si raw-html, on utilise RawHtmlContentTab pour Contenu */}
        {safeActiveTab === "content" &&
          (isRawHtml ? (
            <RawHtmlContentTab section={section} onChange={onChange} />
          ) : isBooking ? (
            <BookingContentTab section={section} onChange={onChange} />
          ) : (
            <>
              {/* 🆕 Régénération du copy par prompt (IA) — sections natives. */}
              <SectionRegenPanel
                section={section}
                language={language}
                funnel={funnel}
                onChange={onChange}
              />
              <ContentTab
                section={section}
                language={language}
                onChange={onChange}
              />
            </>
          ))}

        {/* Les onglets natifs ne sont disponibles que pour les sections natives.
            availableTabs filtre déjà ces cas, mais on garde les guards
            (!isRawHtml) par sécurité au cas où availableTabs serait étendu. */}
        {safeActiveTab === "media" && !isRawHtml && (
          <MediaTab
            section={section}
            language={language}
            funnel={funnel}
            onChange={onChange}
          />
        )}
        {safeActiveTab === "cta" && !isRawHtml && (
          <CtaTab
            section={section}
            language={language}
            funnel={funnel}
            onChange={onChange}
            onFunnelChange={onFunnelChange}
          />
        )}
        {safeActiveTab === "style" && !isRawHtml && (
          <StyleTab section={section} language={language} onChange={onChange} />
        )}
        {safeActiveTab === "background" && !isRawHtml && (
          <BackgroundTab section={section} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
