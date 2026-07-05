"use client";

// Dispatch des patterns PROBLÈME / AGITATION. Parse section.bullets
// ("Douleur | Détail") puis rend le pattern choisi (section.pattern) en
// contenu-seul. Utilisé pour les sections de type "problem" et "agitation".

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { PROBLEM_PATTERNS, type PainItem } from "./patterns/problem/ProblemPatterns";

function stripMarkers(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1");
}

function parseBullets(bullets: unknown): PainItem[] {
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

/** True si la section porte un pattern problème/agitation connu. */
export function isProblemPattern(pattern: string | undefined): pattern is string {
  return !!pattern && pattern in PROBLEM_PATTERNS;
}

export function ProblemRenderer({
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
    (section.pattern && PROBLEM_PATTERNS[section.pattern]) ||
    PROBLEM_PATTERNS["problem-split-pain-checklist"];
  return <Pattern section={section} items={items} funnel={funnel} mode={mode} />;
}
