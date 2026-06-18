"use client";

// Compteurs simples côté navigateur (cohérent avec le reste du stockage local
// de l'app). Minimaliste : pas de table Supabase dédiée pour l'instant.

const EXPORT_KEY = "ff:exports-count";
export const EXPORTS_CHANGED_EVENT = "ff:exports-changed";

export function getExportCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(EXPORT_KEY);
  const n = Number(raw ?? "0");
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function incrementExportCount(): number {
  if (typeof window === "undefined") return 0;
  const next = getExportCount() + 1;
  try {
    window.localStorage.setItem(EXPORT_KEY, String(next));
    window.dispatchEvent(new CustomEvent(EXPORTS_CHANGED_EVENT));
  } catch {
    /* quota : non bloquant */
  }
  return next;
}
