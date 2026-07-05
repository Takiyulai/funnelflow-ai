"use client";

// Dispatch des patterns TRUSTBAR (léger). Parse section.bullets ("Gauche | Droite")
// puis rend le pattern choisi (section.pattern) en contenu-seul. Utilisé pour les
// sections de type "proof" dont le pattern commence par "trustbar-".

import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { TRUSTBAR_PATTERNS, type TrustPair } from "./patterns/trustbar/TrustbarPatterns";

function stripMarkers(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1");
}

function parseBullets(bullets: unknown): TrustPair[] {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .filter((raw): raw is string => typeof raw === "string" && raw.trim().length > 0)
    .map((raw) => {
      const pipe = raw.indexOf("|");
      const left = pipe >= 0 ? raw.slice(0, pipe) : raw;
      const right = pipe >= 0 ? raw.slice(pipe + 1) : "";
      return { left: stripMarkers(left).trim(), right: stripMarkers(right).trim() };
    });
}

/** True si la section porte un pattern trustbar connu. */
export function isTrustbarPattern(pattern: string | undefined): pattern is string {
  return !!pattern && pattern.startsWith("trustbar-") && pattern in TRUSTBAR_PATTERNS;
}

export function TrustbarRenderer({
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
    (section.pattern && TRUSTBAR_PATTERNS[section.pattern]) ||
    TRUSTBAR_PATTERNS["trustbar-stats-inline-no-card"];
  return <Pattern section={section} items={items} funnel={funnel} mode={mode} />;
}
