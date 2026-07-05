"use client";

// Dispatch des patterns FONCTIONNEMENT / ÉTAPES. Parse section.bullets
// ("Étape | Description") puis rend le pattern choisi (section.pattern) en
// contenu-seul. Utilisé pour les sections de type "process".

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { PROCESS_PATTERNS, type StepItem } from "./patterns/process/ProcessPatterns";

function stripMarkers(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1");
}

function parseBullets(bullets: unknown): StepItem[] {
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

/** True si la section porte un pattern process connu. */
export function isProcessPattern(pattern: string | undefined): pattern is string {
  return !!pattern && pattern in PROCESS_PATTERNS;
}

export function ProcessRenderer({
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
    (section.pattern && PROCESS_PATTERNS[section.pattern]) ||
    PROCESS_PATTERNS["process-timeline-vertical-circles"];
  return <Pattern section={section} items={items} funnel={funnel} mode={mode} />;
}
