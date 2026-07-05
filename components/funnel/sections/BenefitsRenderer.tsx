"use client";

// Dispatch des patterns BÉNÉFICES. Parse section.bullets ("Titre | Description")
// puis rend le pattern choisi (section.pattern) en contenu-seul (la <section>,
// le fond et le padding viennent du wrapper de FunnelPreview).

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import {
  BENEFITS_PATTERNS,
  type BenefitItem,
} from "./patterns/benefits/BenefitsPatterns";

function stripMarkers(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1");
}

function parseBullets(bullets: unknown): BenefitItem[] {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .filter((raw): raw is string => typeof raw === "string" && raw.trim().length > 0)
    .map((raw) => {
      const pipe = raw.indexOf("|");
      const title = pipe >= 0 ? raw.slice(0, pipe) : raw;
      const desc = pipe >= 0 ? raw.slice(pipe + 1) : "";
      return { title: stripMarkers(title).trim(), desc: stripMarkers(desc).trim() };
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
