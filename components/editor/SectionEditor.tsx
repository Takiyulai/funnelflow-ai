"use client";

import { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  MousePointerClick,
  Palette,
} from "lucide-react";
import type { FunnelSection, Language, Funnel } from "@/lib/funnels/types";
import { ContentTab } from "@/components/editor/tabs/ContentTab";
import { MediaTab } from "@/components/editor/tabs/MediaTab";
import { CtaTab } from "@/components/editor/tabs/CtaTab";
import { StyleTab } from "@/components/editor/tabs/StyleTab";
import { DecorativeIconsPanel } from "@/components/editor/tabs/DecorativeIconsPanel";

type TabId = "content" | "media" | "cta" | "style";

type Props = {
  section: FunnelSection;
  language: Language;
  funnel: Funnel;
  onChange: (patch: Partial<FunnelSection>) => void;
};


const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "content", label: "Contenu", icon: FileText },
  { id: "media", label: "Média", icon: ImageIcon },
  { id: "cta", label: "CTA", icon: MousePointerClick },
  { id: "style", label: "Style", icon: Palette },
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
};

export function SectionEditor({ section, language, funnel, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("content");
  const sectionLabel = SECTION_LABELS[section.type] ?? section.type;

  return (
    <div className="rounded-2xl border border-white/15 bg-zinc-900 shadow-lg min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 sm:px-4 py-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            Section
          </div>
          <div className="truncate text-sm font-semibold text-white">{sectionLabel}</div>
        </div>
        <div className="hidden sm:block text-[10px] text-white/40 shrink-0 truncate max-w-[140px]">
          id: {section.id}
        </div>
      </div>

      {/* Tabs — scroll horizontal si nécessaire sur très petits écrans */}
      <div className="flex gap-1 border-b border-white/10 bg-zinc-950/50 px-2 pt-2 overflow-x-auto scrollbar-thin min-w-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
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
        {activeTab === "content" && (
          <ContentTab section={section} language={language} onChange={onChange} />
        )}
        {activeTab === "media" && (
        <MediaTab section={section} language={language} funnel={funnel} onChange={onChange} />
        )}

        {activeTab === "cta" && (
          <CtaTab section={section} language={language} onChange={onChange} />
        )}
        {activeTab === "style" && (
          <StyleTab section={section} language={language} onChange={onChange} />
        )}

        {/* ─── Lot L : Icônes décoratives — disponible sur TOUTES les sections,
              toujours visible quel que soit l'onglet actif ──────────────── */}
        <DecorativeIconsPanel section={section} onChange={onChange} />
      </div>
    </div>
  );
}
