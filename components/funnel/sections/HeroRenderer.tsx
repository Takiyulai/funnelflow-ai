"use client";

// Sélecteur de pattern HERO : route la section vers le bon composant de pattern
// selon section.pattern. Ajoute les autres variantes ici au fur et à mesure.

import type { ComponentType } from "react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";
import { HeroCenteredNavGlow } from "./patterns/hero/HeroCenteredNavGlow";
import { HeroSplitStatsB2b } from "./patterns/hero/HeroSplitStatsB2b";
import { HeroVideoCenteredFunnel } from "./patterns/hero/HeroVideoCenteredFunnel";

type HeroPatternProps = {
  section: FunnelSection;
  funnel?: Funnel;
  mode?: "preview" | "public";
};

const HERO_PATTERNS: Record<string, ComponentType<HeroPatternProps>> = {
  "hero-centered-nav-glow": HeroCenteredNavGlow,
  "hero-split-stats-search-b2b": HeroSplitStatsB2b,
  "hero-video-centered-funnel": HeroVideoCenteredFunnel,
};

/** True si la section porte un pattern hero connu → rendu spécialisé. */
export function isHeroPattern(pattern?: string): boolean {
  return !!pattern && pattern in HERO_PATTERNS;
}

export function HeroRenderer({ section, funnel, mode = "public" }: HeroPatternProps) {
  const Pattern =
    (section.pattern && HERO_PATTERNS[section.pattern]) || HeroCenteredNavGlow;
  return <Pattern section={section} funnel={funnel} mode={mode} />;
}
