// lib/funnels/eventDate.ts
//
// 🆕 Formatage STABLE des dates/heures d'événement (webinaire, timer daté).
//
// PROBLÈME résolu : l'heure saisie (ex. 21:00) s'affichait différemment selon
// l'endroit (21h00, 20h00, 23h00…). Cause : la valeur était convertie en ISO
// UTC (`toISOString()`) puis rendue via `toLocaleTimeString()`, qui dépend du
// FUSEAU d'exécution. Le rendu serveur (SSR, souvent UTC) et le rendu client
// (fuseau du visiteur) donnaient donc des heures différentes pour la MÊME
// valeur — d'où les incohérences.
//
// SOLUTION : on traite la date/heure comme une HORLOGE MURALE (« wall-clock »)
// — exactement ce que l'utilisateur a tapé, sans fuseau. On lit les composants
// littéraux (année, mois, jour, heures, minutes) puis on formate en forçant
// `timeZone: "UTC"` sur une Date construite avec `Date.UTC(...)`. Résultat :
// l'affichage est IDENTIQUE côté serveur et côté client, et fidèle à la saisie.
//
// Tolérant à l'ancien format : une valeur ISO avec `Z`/offset est lue par ses
// composants UTC littéraux (cohérent partout, même si potentiellement décalé
// d'1 h pour les anciens tunnels — il suffit de re-régler l'heure une fois).

export type WallClockParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
};

/** Extrait les composants littéraux d'une chaîne "YYYY-MM-DDTHH:mm[...]". */
export function parseWallClock(value?: string | null): WallClockParts | null {
  if (!value) return null;
  const m = String(value).match(
    /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/,
  );
  if (!m) return null;
  return {
    year: +m[1],
    month: +m[2],
    day: +m[3],
    hour: +m[4],
    minute: +m[5],
  };
}

/** Date construite en UTC à partir des composants littéraux (pour formatage
 *  stable via `timeZone: "UTC"`). Ne PAS utiliser pour un calcul de durée. */
export function wallClockToUtcDate(value?: string | null): Date | null {
  const p = parseWallClock(value);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Normalise n'importe quelle valeur (naïve ou ancien ISO) en chaîne
 *  wall-clock naïve "YYYY-MM-DDTHH:mm" (composants littéraux, sans fuseau). */
export function toWallClockString(value?: string | null): string | null {
  const p = parseWallClock(value);
  if (!p) return null;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Lit les composants UTC d'une Date → chaîne wall-clock naïve. Utile pour
 *  poser une échéance calculée (ex. expiration = événement + N heures) sans
 *  réintroduire de décalage de fuseau. */
export function utcDateToWallClock(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

function localeOf(language?: string): string {
  return language === "en" ? "en-US" : language === "es" ? "es-ES" : "fr-FR";
}

/** Parties formatées et STABLES d'un événement (fuseau-indépendantes). */
export function formatEventParts(
  value?: string | null,
  language?: string,
): { weekday: string; day: string; month: string; time: string } | null {
  const d = wallClockToUtcDate(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const locale = localeOf(language);
  const opt = { timeZone: "UTC" as const };
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "long", ...opt }).format(d),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", ...opt }).format(d),
    month: new Intl.DateTimeFormat(locale, { month: "long", ...opt }).format(d),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      ...opt,
    }).format(d),
  };
}

/** Date longue STABLE avec année : "jeudi 9 juillet 2026 — 21:00". */
export function formatEventLong(
  value?: string | null,
  language?: string,
): string | null {
  const d = wallClockToUtcDate(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const locale = localeOf(language);
  const opt = { timeZone: "UTC" as const };
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opt,
  }).format(d);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...opt,
  }).format(d);
  return `${date} — ${time}`;
}

/** Badge complet du header/hero : "En direct le jeudi 9 juillet — 21:00".
 *  Retourne null si la valeur est absente/invalide. */
export function formatEventBadge(
  value?: string | null,
  language?: string,
): string | null {
  const p = formatEventParts(value, language);
  if (!p) return null;
  const prefix =
    language === "en" ? "Live on" : language === "es" ? "En vivo el" : "En direct le";
  const sep = language === "en" ? " at " : " — ";
  // "En direct le jeudi 9 juillet — 21:00"
  return `${prefix} ${p.weekday} ${p.day} ${p.month}${sep}${p.time}`;
}
