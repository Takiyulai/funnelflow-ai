"use client";

// Dispatch des patterns CTA FINAL (contenu-seul, wrapper = <section>).

import type { FunnelSection } from "@/lib/funnels/types";
import { CTA_FINAL_PATTERNS } from "./patterns/cta/CtaFinalPatterns";

export function CtaFinalRenderer({
  section,
  mode = "public",
}: {
  section: FunnelSection;
  mode?: "preview" | "public";
  bodySize?: string;
}) {
  const Pattern =
    (section.pattern && CTA_FINAL_PATTERNS[section.pattern]) ||
    CTA_FINAL_PATTERNS["cta-final-centered-urgency"];
  return <Pattern section={section} mode={mode} />;
}
