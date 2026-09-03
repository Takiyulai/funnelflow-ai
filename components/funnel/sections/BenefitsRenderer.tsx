"use client";

// Dispatch des patterns BÉNÉFICES. Parse section.bullets ("Titre | Description")
// puis rend le pattern choisi (section.pattern) en contenu-seul (la <section>,
// le fond et le padding viennent du wrapper de FunnelPreview).

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { splitTextPair } from "@/lib/funnels/text";
import {
  BENEFITS_PATTERNS,
  type BenefitItem,
} from "./patterns/benefits/BenefitsPatterns";

function parseBullets(bullets: unknown): BenefitItem[] {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .filter((raw): raw is string => typeof raw === "string" && raw.trim().length > 0)
    .map((raw) => {
      const pair = splitTextPair(raw);
      return { title: pair?.first ?? raw.trim(), desc: pair?.second ?? "" };
    });
}

export function BenefitsRenderer({
  section,
  funnel,
  mode = "public",
}: {
  section: FunnelSection;
  funnel?: Funnel;
  mode?: "preview" | "public";
  bodySize?: string;
}) {
  const items = parseBullets(section.bullets);
  if (items.length === 0) return null;
  const Pattern =
    (section.pattern && BENEFITS_PATTERNS[section.pattern]) ||
    BENEFITS_PATTERNS["benefits-cards-6-shadow-classic"];
  return <Pattern section={section} items={items} funnel={funnel} mode={mode} />;
}
