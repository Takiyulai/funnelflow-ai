"use client";

// Dispatch des patterns STATS. Parse section.bullets ("Chiffre | Label") puis
// rend le pattern choisi (section.pattern) en contenu-seul (la <section>, le fond
// et le padding viennent du wrapper de FunnelPreview).
// Utilisé pour les sections de type "proof" dont le pattern commence par "stats-".

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { STATS_PATTERNS, type StatItem } from "./patterns/stats/StatsPatterns";

function stripMarkers(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1");
}

function parseBullets(bullets: unknown): StatItem[] {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .filter((raw): raw is string => typeof raw === "string" && raw.trim().length > 0)
    .map((raw) => {
      const pipe = raw.indexOf("|");
      const value = pipe >= 0 ? raw.slice(0, pipe) : raw;
      const label = pipe >= 0 ? raw.slice(pipe + 1) : "";
      return { value: stripMarkers(value).trim(), label: stripMarkers(label).trim() };
    });
}

/** True si la section proof doit être rendue en STATS (pattern dédié). */
export function isStatsPattern(pattern: string | undefined): pattern is string {
  return !!pattern && pattern.startsWith("stats-") && pattern in STATS_PATTERNS;
}

export function StatsRenderer({
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
    (section.pattern && STATS_PATTERNS[section.pattern]) ||
    STATS_PATTERNS["stats-cards-4-suffix-badge"];
  return <Pattern section={section} items={items} funnel={funnel} mode={mode} />;
}
