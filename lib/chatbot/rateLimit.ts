// lib/chatbot/rateLimit.ts
//
// 🆕 CHATBOT IA — Rate limit basique PAR IP (fenêtre glissante, en mémoire).
// But : éviter qu'un spam épuise le quota OpenRouter gratuit. Suffisant pour un
// widget de support ; pour du multi-instance strict, migrer vers un store
// partagé (Upstash/Redis). Best-effort et non bloquant pour le reste de l'app.

import { RATE_LIMIT } from "./config";

// Map<ip, timestamps[]> — horodatages (ms) des requêtes récentes.
const hits = new Map<string, number[]>();

// Nettoyage périodique léger pour éviter que la Map ne grossisse indéfiniment.
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < RATE_LIMIT.windowMs) return;
  lastSweep = now;
  for (const [ip, times] of hits) {
    const recent = times.filter((t) => now - t < RATE_LIMIT.windowMs);
    if (recent.length === 0) hits.delete(ip);
    else hits.set(ip, recent);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Secondes à attendre avant de réessayer (si bloqué). */
  retryAfter: number;
  remaining: number;
};

/**
 * Enregistre une requête pour cette IP et indique si elle est autorisée.
 * @param ip identifiant d'appelant (IP extraite des en-têtes).
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const key = ip || "unknown";
  const times = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);

  if (times.length >= RATE_LIMIT.maxRequests) {
    const oldest = times[0];
    const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT.windowMs - (now - oldest)) / 1000));
    hits.set(key, times);
    return { ok: false, retryAfter, remaining: 0 };
  }

  times.push(now);
  hits.set(key, times);
  return {
    ok: true,
    retryAfter: 0,
    remaining: Math.max(0, RATE_LIMIT.maxRequests - times.length),
  };
}

/**
 * Extrait une IP appelante depuis les en-têtes d'une requête (Vercel/Proxy).
 * Repli "unknown" si rien de fiable (le rate limit reste alors global-souple).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
