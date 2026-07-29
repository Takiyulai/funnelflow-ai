// lib/funnels/frames.ts
//
// 🆕 Habillage des images et des cartes : traduction d'un `VisualFrame` en
// variables CSS posées sur la section racine.
//
// POURQUOI DES VARIABLES ET PAS DES CLASSES. Les cartes d'un tunnel sont
// produites par des dizaines de composants de pattern distincts
// (ProblemPatterns, stats-cards, process-timeline…). Leur transmettre des props
// aurait imposé de tous les modifier, et d'y penser à chaque nouveau pattern.
// En posant des variables sur la section, `app/funnel-theme.css` les applique
// une bonne fois à `.ff-image` et `.ff-card` — donc à tout ce qui existe
// aujourd'hui comme à ce qui sera ajouté demain.
//
// RÈGLE DE NON-RÉGRESSION : une propriété non renseignée ne produit AUCUNE
// variable. Le CSS retombe alors sur la valeur par défaut du thème, et les
// tunnels déjà publiés gardent exactement leur apparence.

import type { CSSProperties } from "react";
import type { VisualFrame } from "@/lib/funnels/types";

/** Ombres proposées. Volontairement peu nombreuses : six niveaux d'ombre dans
 *  une même page ne créent pas de la richesse, seulement du flou. */
const SHADOWS: Record<NonNullable<VisualFrame["shadow"]>, string> = {
  none: "none",
  sm: "0 2px 6px rgba(0, 0, 0, 0.10)",
  md: "0 8px 20px rgba(0, 0, 0, 0.14)",
  lg: "0 20px 44px rgba(0, 0, 0, 0.20)",
};

/** Borne une valeur numérique, en ignorant proprement les entrées invalides. */
function clamp(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Variables CSS d'un habillage, préfixées par `prefix` ("img" ou "card").
 * Retourne un objet vide si le cadre est absent ou entièrement vide.
 */
export function frameVars(
  frame: VisualFrame | undefined,
  prefix: "img" | "card",
): CSSProperties {
  if (!frame) return {};
  const vars: Record<string, string> = {};

  const radius = clamp(frame.radius, 0, 64);
  if (radius !== null) vars[`--ff-${prefix}-radius`] = `${radius}px`;

  const borderWidth = clamp(frame.borderWidth, 0, 16);
  if (borderWidth !== null) vars[`--ff-${prefix}-border-width`] = `${borderWidth}px`;

  if (frame.borderColor) vars[`--ff-${prefix}-border-color`] = frame.borderColor;

  if (frame.shadow) vars[`--ff-${prefix}-shadow`] = SHADOWS[frame.shadow] ?? "none";

  const padding = clamp(frame.padding, 0, 48);
  if (padding !== null) vars[`--ff-${prefix}-padding`] = `${padding}px`;

  if (frame.backgroundColor) vars[`--ff-${prefix}-bg`] = frame.backgroundColor;

  return vars as CSSProperties;
}

/**
 * Même chose, mais en texte CSS — pour l'export HTML statique, qui écrit des
 * attributs `style="..."` et n'a pas d'objet React à disposition.
 */
export function frameVarsText(
  frame: VisualFrame | undefined,
  prefix: "img" | "card",
): string {
  const vars = frameVars(frame, prefix) as unknown as Record<string, string>;
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** True si l'habillage contient au moins une valeur exploitable. */
export function hasFrame(frame: VisualFrame | undefined): boolean {
  return Object.keys(frameVars(frame, "img")).length > 0;
}

export const SHADOW_OPTIONS: { value: NonNullable<VisualFrame["shadow"]>; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "sm", label: "Légère" },
  { value: "md", label: "Moyenne" },
  { value: "lg", label: "Marquée" },
];
