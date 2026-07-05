"use client";

// Sélecteur de pattern FAQ : extrait les Q/R de la section puis route vers le
// bon composant de pattern (accordion / sandwich / hub-grid / grid-intro) selon
// section.pattern. Défaut : accordéon. Les FAQ sans pattern (anciens tunnels)
// tombent proprement sur l'accordéon.

import type { FaqItem, FunnelSection, SectionItem } from "@/lib/funnels/types";
import { FAQ_PATTERNS } from "@/components/funnel/sections/patterns/faq/FaqPatterns";

type Props = {
  section: FunnelSection;
  /** Conservé pour compat avec l'appelant (SpecializedContent) ; non utilisé. */
  bodySize?: string;
};

export function FaqRenderer({ section }: Props) {
  const faqs: FaqItem[] = (section.items || [])
    .filter((it): it is SectionItem & { kind: "faq" } => it.kind === "faq")
    .map((it) => it.data);

  if (faqs.length === 0) return null;

  const Pattern =
    (section.pattern && FAQ_PATTERNS[section.pattern]) || FAQ_PATTERNS["faq-accordion"];

  return <Pattern section={section} faqs={faqs} />;
}
