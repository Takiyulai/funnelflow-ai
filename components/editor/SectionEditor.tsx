"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, MousePointerClick, Palette } from "lucide-react";
import type { FunnelSection, Language } from "@/lib/funnels/types";
import { ContentTab } from "@/components/editor/tabs/ContentTab";
import { MediaTab } from "@/components/editor/tabs/MediaTab";
import { CtaTab } from "@/components/editor/tabs/CtaTab";
import { StyleTab } from "@/components/editor/tabs/StyleTab";

type TabId = "content" | "media" | "cta" | "style";

type Props = {
  section: FunnelSection;
  language: Language;
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

export function SectionEditor({ section, language, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("content");
  const sectionLabel = SECTION_LABELS[section.type] ?? section.type;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            Section
          </div>
          <div className="text-sm font-semibold text-white">{sectionLabel}</div>
        </div>
        <div className="text-[10px] text-white/30">id: {section.id}</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 px-2 pt-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "border-amber-300 bg-white/[0.04] text-amber-200"
                  : "border-transparent text-white/60 hover:bg-white/[0.03] hover:text-white",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "content" && (
          <ContentTab section={section} language={language} onChange={onChange} />
        )}
        {activeTab === "media" && (
          <MediaTab section={section} language={language} onChange={onChange} />
        )}
        {activeTab === "cta" && (
          <CtaTab section={section} language={language} onChange={onChange} />
        )}
        {activeTab === "style" && (
          <StyleTab section={section} language={language} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
