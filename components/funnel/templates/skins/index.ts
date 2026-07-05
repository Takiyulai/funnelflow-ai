// Registre des skins de templates (rendu bespoke DATA-DRIVEN, éditable).
// Un template sans skin retombe intégralement sur le rendu standard.
// Ids historiques conservés → zéro régression sur les anciens funnels.

import type { TemplateSkin } from "./types";
import { T1_WEBINAIRE_DARK_GLOW } from "./t1-webinaire-dark-glow";
import { makeSkin } from "./factory";
import {
  T2_TOKENS,
  T3_TOKENS,
  T4_TOKENS,
  T5_TOKENS,
  T6_TOKENS,
  T7_TOKENS,
} from "./configs";

const SKINS: Record<string, TemplateSkin> = {
  "sharp-launch": T1_WEBINAIRE_DARK_GLOW, // T1 - Webinaire Dark Glow (bespoke)
  "lead-snap": makeSkin(T2_TOKENS), // T2 - E-book Corporate Mixte
  "story-sell": makeSkin(T3_TOKENS), // T3 - Evenement Dark Mysterieux
  "clean-light": makeSkin(T4_TOKENS), // T4 - Coach Service Light
  "premium-minimal": makeSkin(T5_TOKENS), // T5 - SaaS Light Blue
  "trust-pro": makeSkin(T6_TOKENS), // T6 - Agence B2B Teal
  "bold-energy": makeSkin(T7_TOKENS), // T7 - Fitness Dark Energy
};

export function getTemplateSkin(
  id: string | null | undefined,
): TemplateSkin | undefined {
  if (!id) return undefined;
  return SKINS[id];
}

export type { TemplateSkin, SkinSectionProps } from "./types";
