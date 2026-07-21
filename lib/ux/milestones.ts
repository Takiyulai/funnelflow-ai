"use client";

// lib/ux/milestones.ts
//
// 🆕 MICRO-VICTOIRES — suivi des « premières fois » d'un utilisateur (côté
// navigateur). Sert à ne déclencher les grandes célébrations (niveau L :
// modale + confettis) qu'UNE SEULE FOIS par jalon, puis à retomber sur un
// feedback plus discret (toast) les fois suivantes.
//
// Stockage : localStorage (best-effort). Par appareil/navigateur — suffisant
// pour un feedback UX (aucune donnée sensible). Pour un suivi durable
// cross-appareils, on pourra plus tard le miroiter dans profiles.milestones.

const PREFIX = "ff:milestone:";

/** Un jalon a-t-il déjà été célébré ? */
export function hasMilestone(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

/** Marque un jalon. Renvoie `true` s'il vient d'être atteint (1ʳᵉ fois). */
export function markMilestone(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(PREFIX + key) === "1") return false;
    window.localStorage.setItem(PREFIX + key, "1");
    return true;
  } catch {
    return false;
  }
}

/** Paliers de leads collectés qui déclenchent une micro-victoire. */
export const LEAD_THRESHOLDS = [1, 10, 25, 50, 100, 250, 500, 1000] as const;
/** Paliers de ventes / paiements reçus. */
export const SALE_THRESHOLDS = [1, 5, 10, 25, 50, 100] as const;

/**
 * Renvoie le plus GRAND palier atteint (<= count) qui n'a PAS encore été
 * célébré, en le marquant au passage. `null` si aucun nouveau palier.
 * `prefix` isole les familles de jalons (ex. "leads", "sales").
 */
export function reachedThreshold(
  prefix: string,
  count: number,
  thresholds: readonly number[],
): number | null {
  if (!count || count <= 0) return null;
  // On MARQUE tous les paliers atteints (<= count), mais on ne renvoie que le
  // plus HAUT nouvellement franchi → une seule célébration, jamais de cascade
  // rétroactive (un compte existant à 100 leads célèbre « 100 » une fois, pas
  // 1 puis 10 puis 25… à chaque visite).
  let top: number | null = null;
  for (const t of thresholds) {
    if (count < t) continue;
    const isNew = markMilestone(`${prefix}_${t}`);
    if (isNew && (top === null || t > top)) top = t;
  }
  return top;
}
