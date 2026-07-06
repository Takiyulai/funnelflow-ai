// lib/rate-limit.ts
//
// 🆕 Chantier 2.4 — Burst rate limiting (anti-abus) via Upstash Redis, appelé
// par son API REST (fetch) → AUCUNE dépendance npm ajoutée. Fenêtre fixe :
// INCR + EXPIRE. Fail-OPEN si Upstash n'est pas configuré (dev) ou en cas
// d'erreur réseau, pour ne jamais bloquer abusivement.
//
// Env requis en prod : UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function configured(): boolean {
  return Boolean(URL && TOKEN);
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    // Upstash REST est rapide ; on coupe court pour ne pas pénaliser la requête.
    signal: AbortSignal.timeout(2000),
  });
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

export type RateLimitResult = { ok: boolean; remaining: number; limit: number };

/**
 * Fenêtre fixe : autorise `limit` requêtes par `windowSec` pour `key`.
 * Fail-OPEN si Upstash absent/indisponible.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  // 🆕 En développement (next dev), jamais de rate-limit : on teste la génération
  // sans se faire bloquer. Surchargeable via RATE_LIMIT_DISABLED=1 n'importe où.
  if (process.env.NODE_ENV !== "production" || process.env.RATE_LIMIT_DISABLED === "1") {
    return { ok: true, remaining: limit, limit };
  }
  if (!configured()) return { ok: true, remaining: limit, limit };
  try {
    const k = `rl:${key}`;
    const count = Number(await redis(["INCR", k]));
    // 🆕 On garantit TOUJOURS un TTL via le flag NX (= pose l'expiration seulement
    // si la clé n'en a pas encore). Auto-répare une clé restée SANS expiration
    // (EXPIRE raté à la 1re requête sur réseau lent) → sinon le compteur ne se
    // réinitialise jamais et bloque en 429 perpétuel.
    await redis(["EXPIRE", k, windowSec, "NX"]);
    return { ok: count <= limit, remaining: Math.max(0, limit - count), limit };
  } catch (e) {
    console.error("[rate-limit] erreur (fail-open)", e);
    return { ok: true, remaining: limit, limit };
  }
}

/** IP cliente (best-effort) depuis les en-têtes de proxy Vercel. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Réponse 429 standard. */
export function tooManyRequests(retryAfterSec = 60): Response {
  // 🆕 `reason: "rate-limit"` pour que le client affiche un message explicite
  // (au lieu de « Code: unknown ») + `retryAfter` pour indiquer le délai.
  return new Response(
    JSON.stringify({
      ok: false,
      error: "rate_limited",
      reason: "rate-limit",
      retryAfter: retryAfterSec,
      message: `Trop de requêtes en peu de temps. Patiente environ ${retryAfterSec} secondes avant de relancer une génération.`,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSec) },
    },
  );
}
