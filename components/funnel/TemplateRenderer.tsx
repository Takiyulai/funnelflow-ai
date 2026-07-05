"use client";

// Rendu des templates bespoke (reproduction fidèle des designs Claude Design).
// Mappé par funnel.meta.templateId (ids historiques conservés → zéro régression).
// Un id sans composant bespoke retombe sur le rendu standard section-par-section.

import type { ComponentType } from "react";
import type { Funnel } from "@/lib/funnels/types";
import { WebinaireDarkGlow } from "./templates/webinaire-dark-glow";
import { EbookCorporateMixte } from "./templates/ebook-corporate-mixte";
import { EvenementDarkMysterieux } from "./templates/evenement-dark-mysterieux";
import { CoachServiceLight } from "./templates/coach-service-light";
import { SaasLightBlue } from "./templates/saas-light-blue";
import { AgenceB2bTeal } from "./templates/agence-b2b-teal";
import { FitnessDarkEnergy } from "./templates/fitness-dark-energy";

const TEMPLATE_MAP: Record<string, ComponentType<{ funnel?: Funnel }>> = {
  "sharp-launch": WebinaireDarkGlow,      // Webinaire Dark Glow (T1)
  "lead-snap": EbookCorporateMixte,       // Lead Magnet E-book (T2)
  "story-sell": EvenementDarkMysterieux,  // Événement Dark (T3)
  "clean-light": CoachServiceLight,       // Coach Light (T4)
  "premium-minimal": SaasLightBlue,       // SaaS Light Blue (T5)
  "trust-pro": AgenceB2bTeal,             // Agence B2B (T6)
  "bold-energy": FitnessDarkEnergy,       // Fitness Dark Energy (T7)
};

/** True si l'id de template possède un composant bespoke dédié. */
export function hasBespokeTemplate(id: string | null | undefined): boolean {
  return !!id && id in TEMPLATE_MAP;
}

export function TemplateRenderer({ funnel }: { funnel: Funnel }) {
  const id = (funnel.meta as { templateId?: string } | undefined)?.templateId;
  const Comp = id ? TEMPLATE_MAP[id] : undefined;
  if (!Comp) return null;
  return <Comp funnel={funnel} />;
}

export default TemplateRenderer;
