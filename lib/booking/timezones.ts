// lib/booking/timezones.ts
//
// Fuseaux horaires du module « Calendrier de RDV ».
//
// ── LE PIÈGE QUE CE MODULE EXISTE POUR ÉVITER ──────────────────────────────
// L'Afrique francophone n'applique AUCUN changement d'heure. L'Europe, si.
// Un coach à Paris qui publie « 16h00 » verra donc ses prospects d'Abidjan
// arriver à la bonne heure en hiver (15h00 chez eux) et UNE HEURE TROP TARD
// en été (14h00 chez eux). C'est le mode d'échec n°1 d'un module de RDV
// franco-africain, et il est invisible en développement six mois sur douze.
//
// Conséquence de conception, non négociable :
//   - on stocke TOUJOURS un instant absolu en UTC ;
//   - l'hôte déclare son fuseau IANA (pas un décalage fixe : « UTC+1 » serait
//     faux la moitié de l'année pour Paris) ;
//   - toute conversion passe par Intl, qui connaît les règles historiques.
//
// Le reste du code n'utilise JAMAIS `new Date(...)` avec des composants
// locaux : la machine (Vercel) tourne en UTC, le navigateur du visiteur non.
//
// ⚠️ Ne pas confondre avec lib/funnels/eventDate.ts, qui traite volontairement
// les dates de webinaire en « horloge murale » sans fuseau. Ici, un RDV lie
// deux personnes dans deux fuseaux : l'instant absolu est indispensable.

/** Fuseau IANA (ex. "Africa/Abidjan"). */
export type TimeZoneId = string;

export type TimeZoneOption = {
  id: TimeZoneId;
  /** Libellé lisible, en français. */
  label: string;
  /** Pays / ville principale, pour le regroupement dans un sélecteur. */
  group: "Afrique de l'Ouest" | "Afrique centrale" | "Afrique du Nord" | "Océan Indien" | "Europe" | "Amérique";
};

/**
 * Fuseaux proposés en priorité — la cible produit est l'Afrique francophone.
 *
 * Aucun de ces fuseaux africains n'observe l'heure d'été : leur décalage est
 * constant toute l'année. Ce sont les fuseaux EUROPÉENS de la liste qui
 * bougent, d'où l'importance de comparer des instants et non des décalages.
 */
export const TIMEZONE_OPTIONS: TimeZoneOption[] = [
  // UTC+0 — pas de changement d'heure
  { id: "Africa/Abidjan", label: "Abidjan (Côte d'Ivoire)", group: "Afrique de l'Ouest" },
  { id: "Africa/Dakar", label: "Dakar (Sénégal)", group: "Afrique de l'Ouest" },
  { id: "Africa/Bamako", label: "Bamako (Mali)", group: "Afrique de l'Ouest" },
  { id: "Africa/Ouagadougou", label: "Ouagadougou (Burkina Faso)", group: "Afrique de l'Ouest" },
  { id: "Africa/Conakry", label: "Conakry (Guinée)", group: "Afrique de l'Ouest" },
  { id: "Africa/Lome", label: "Lomé (Togo)", group: "Afrique de l'Ouest" },
  { id: "Africa/Nouakchott", label: "Nouakchott (Mauritanie)", group: "Afrique de l'Ouest" },
  // UTC+1 — pas de changement d'heure
  { id: "Africa/Porto-Novo", label: "Cotonou / Porto-Novo (Bénin)", group: "Afrique de l'Ouest" },
  { id: "Africa/Niamey", label: "Niamey (Niger)", group: "Afrique de l'Ouest" },
  { id: "Africa/Douala", label: "Douala / Yaoundé (Cameroun)", group: "Afrique centrale" },
  { id: "Africa/Libreville", label: "Libreville (Gabon)", group: "Afrique centrale" },
  { id: "Africa/Brazzaville", label: "Brazzaville (Congo)", group: "Afrique centrale" },
  { id: "Africa/Kinshasa", label: "Kinshasa (RD Congo — ouest)", group: "Afrique centrale" },
  { id: "Africa/Bangui", label: "Bangui (Centrafrique)", group: "Afrique centrale" },
  { id: "Africa/Ndjamena", label: "N'Djaména (Tchad)", group: "Afrique centrale" },
  { id: "Africa/Algiers", label: "Alger (Algérie)", group: "Afrique du Nord" },
  { id: "Africa/Tunis", label: "Tunis (Tunisie)", group: "Afrique du Nord" },
  { id: "Africa/Casablanca", label: "Casablanca (Maroc)", group: "Afrique du Nord" },
  // UTC+2 — pas de changement d'heure
  { id: "Africa/Lubumbashi", label: "Lubumbashi (RD Congo — est)", group: "Afrique centrale" },
  { id: "Africa/Kigali", label: "Kigali (Rwanda)", group: "Afrique centrale" },
  { id: "Africa/Bujumbura", label: "Bujumbura (Burundi)", group: "Afrique centrale" },
  // Océan Indien
  { id: "Indian/Antananarivo", label: "Antananarivo (Madagascar)", group: "Océan Indien" },
  { id: "Indian/Mauritius", label: "Port-Louis (Maurice)", group: "Océan Indien" },
  { id: "Indian/Reunion", label: "Saint-Denis (La Réunion)", group: "Océan Indien" },
  // Europe / Amérique — CES fuseaux changent d'heure
  { id: "Europe/Paris", label: "Paris (France) — heure d'été", group: "Europe" },
  { id: "Europe/Brussels", label: "Bruxelles (Belgique) — heure d'été", group: "Europe" },
  { id: "Europe/Zurich", label: "Genève / Zurich (Suisse) — heure d'été", group: "Europe" },
  { id: "America/Montreal", label: "Montréal (Québec) — heure d'été", group: "Amérique" },
];

/** Fuseau par défaut : UTC+0 sans heure d'été, le plus neutre pour la cible. */
export const DEFAULT_TIMEZONE: TimeZoneId = "Africa/Abidjan";

/** Vrai si l'identifiant est un fuseau IANA connu de l'environnement. */
export function isValidTimeZone(tz: string | null | undefined): tz is TimeZoneId {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Fuseau du visiteur, déduit du navigateur. Retombe sur le défaut côté serveur. */
export function detectVisitorTimeZone(): TimeZoneId {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversions
// ─────────────────────────────────────────────────────────────────────────────

/** Composants d'une horloge murale, dans un fuseau donné. */
export type WallClock = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
};

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: TimeZoneId): Intl.DateTimeFormat {
  let f = PARTS_FORMATTER_CACHE.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PARTS_FORMATTER_CACHE.set(timeZone, f);
  }
  return f;
}

/** Lit l'horloge murale affichée par `timeZone` à l'instant `date`. */
export function getWallClockInZone(date: Date, timeZone: TimeZoneId): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  // `hour12: false` peut rendre "24" pour minuit selon l'environnement.
  const hour = get("hour") % 24;
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute") };
}

/**
 * Décalage de `timeZone` par rapport à UTC, EN MINUTES, à l'instant `date`.
 * Positif à l'est de Greenwich. Dépend de la date : Europe/Paris vaut +60 en
 * janvier et +120 en juillet.
 */
export function getOffsetMinutes(date: Date, timeZone: TimeZoneId): number {
  const wc = getWallClockInZone(date, timeZone);
  const asUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute);
  // On arrondit à la minute : les seconds/millisecondes de `date` ne comptent pas.
  const base = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - base) / 60000);
}

/**
 * Convertit une horloge murale d'un fuseau donné en instant absolu (UTC).
 *
 * Le décalage dépend lui-même de l'instant recherché : on l'estime une
 * première fois, puis on corrige. Deux passes suffisent pour tous les fuseaux
 * réels (les transitions ne dépassent jamais une heure).
 */
export function zonedWallClockToUtc(wc: WallClock, timeZone: TimeZoneId): Date {
  const naive = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute);
  let guess = new Date(naive - getOffsetMinutes(new Date(naive), timeZone) * 60000);
  const check = getOffsetMinutes(guess, timeZone);
  const corrected = new Date(naive - check * 60000);
  if (corrected.getTime() !== guess.getTime()) guess = corrected;
  return guess;
}

/** "YYYY-MM-DD" du jour civil observé dans `timeZone` à l'instant `date`. */
export function dateKeyInZone(date: Date, timeZone: TimeZoneId): string {
  const wc = getWallClockInZone(date, timeZone);
  return `${wc.year}-${String(wc.month).padStart(2, "0")}-${String(wc.day).padStart(2, "0")}`;
}

/** Jour de la semaine dans `timeZone` : 0 = dimanche … 6 = samedi. */
export function weekdayInZone(date: Date, timeZone: TimeZoneId): number {
  const wc = getWallClockInZone(date, timeZone);
  // Date.UTC sur les composants locaux → getUTCDay() donne le jour local.
  return new Date(Date.UTC(wc.year, wc.month - 1, wc.day)).getUTCDay();
}

/** Minutes écoulées depuis minuit, dans `timeZone`. */
export function minutesSinceMidnightInZone(date: Date, timeZone: TimeZoneId): number {
  const wc = getWallClockInZone(date, timeZone);
  return wc.hour * 60 + wc.minute;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatage
// ─────────────────────────────────────────────────────────────────────────────

function localeOf(language?: string): string {
  return language === "en" ? "en-US" : language === "es" ? "es-ES" : "fr-FR";
}

/** "15:00" dans `timeZone`. */
export function formatTimeInZone(date: Date, timeZone: TimeZoneId, language?: string): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** "jeudi 9 juillet" dans `timeZone`. */
export function formatDateInZone(date: Date, timeZone: TimeZoneId, language?: string): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Nom court du fuseau tel qu'affiché à l'utilisateur : "Abidjan". */
export function shortZoneLabel(timeZone: TimeZoneId): string {
  const known = TIMEZONE_OPTIONS.find((t) => t.id === timeZone);
  if (known) return known.label.replace(/\s*\(.*$/, "").replace(/\s*—.*$/, "");
  const city = timeZone.split("/").pop() ?? timeZone;
  return city.replace(/_/g, " ");
}

/**
 * Libellé « double affichage » d'un créneau.
 *
 * Choix produit assumé : quand l'hôte et le visiteur ne sont pas dans le même
 * fuseau, on affiche LES DEUX heures. Un visiteur d'Abidjan lit
 * « 15:00 (Abidjan) · 16:00 chez l'hôte (Paris) » et ne peut plus se tromper —
 * y compris pendant les six mois où Paris est à +2 et Abidjan toujours à +0.
 *
 * Quand les deux fuseaux coïncident, on n'affiche qu'une heure : la mention
 * serait du bruit.
 */
export function formatSlotDualLabel(
  utc: Date,
  visitorTz: TimeZoneId,
  hostTz: TimeZoneId,
  language?: string,
): string {
  const visitor = formatTimeInZone(utc, visitorTz, language);
  if (sameWallClock(utc, visitorTz, hostTz)) return visitor;

  const host = formatTimeInZone(utc, hostTz, language);
  const hostWord =
    language === "en" ? "host's time" : language === "es" ? "hora del anfitrión" : "chez l'hôte";
  return `${visitor} (${shortZoneLabel(visitorTz)}) · ${host} ${hostWord} (${shortZoneLabel(hostTz)})`;
}

/**
 * Vrai si les deux fuseaux affichent la même heure à cet instant.
 * On compare les DÉCALAGES, pas les identifiants : Africa/Abidjan et
 * Africa/Dakar sont deux noms pour la même heure, inutile d'afficher les deux.
 */
export function sameWallClock(utc: Date, a: TimeZoneId, b: TimeZoneId): boolean {
  return getOffsetMinutes(utc, a) === getOffsetMinutes(utc, b);
}

/**
 * Avertissement à afficher à l'hôte quand son fuseau observe l'heure d'été.
 * Retourne null si le fuseau est stable toute l'année (cas de toute l'Afrique
 * francophone) — inutile d'inquiéter les 90 % d'utilisateurs non concernés.
 */
export function daylightSavingNotice(
  timeZone: TimeZoneId,
  language?: string,
  reference: Date = new Date(),
): string | null {
  if (!observesDaylightSaving(timeZone, reference)) return null;
  // Réservé à l'écran d'ADMINISTRATION : ce texte long éclaire l'hôte, qui
  // configure des plages récurrentes. Côté prospect, il n'apporte rien à la
  // décision de réserver et écrase la page — la version publique se limite à
  // une ligne avec un détail repliable (cf. daylightSavingShortNotice).
  if (language === "en") {
    return `${shortZoneLabel(timeZone)} observes daylight saving time. Your slots shift by one hour twice a year relative to countries that don't — your bookings' absolute time is preserved either way.`;
  }
  if (language === "es") {
    return `${shortZoneLabel(timeZone)} aplica el horario de verano. Tus horarios se desplazan una hora dos veces al año respecto a los países que no lo aplican — la hora absoluta de tus citas se mantiene.`;
  }
  return (
    `${shortZoneLabel(timeZone)} applique le changement d'heure. Tes créneaux se décalent d'une heure ` +
    `deux fois par an par rapport à l'Afrique de l'Ouest, qui n'en change jamais. ` +
    `Les RDV déjà réservés gardent leur heure absolue : c'est l'affichage local qui suit.`
  );
}

/**
 * Version COURTE de l'avertissement, pour la page publique de réservation.
 *
 * Le prospect n'a qu'une chose à savoir : les heures qu'il voit sont les
 * siennes. Le détail sur le changement d'heure reste accessible derrière un
 * « ⓘ », mais ne doit pas occuper trois lignes au-dessus du calendrier.
 */
export function daylightSavingShortNotice(
  hostTz: TimeZoneId,
  visitorTz: TimeZoneId,
  reference: Date = new Date(),
): string | null {
  // Concerne uniquement les paires de fuseaux dont l'un bouge et pas l'autre :
  // c'est là que l'écart change au fil de l'année.
  const hostDst = observesDaylightSaving(hostTz, reference);
  const visitorDst = observesDaylightSaving(visitorTz, reference);
  if (hostDst === visitorDst) return null;
  const shifting = hostDst ? hostTz : visitorTz;
  return (
    `${shortZoneLabel(shifting)} applique le changement d'heure, contrairement à ` +
    `${shortZoneLabel(hostDst ? visitorTz : hostTz)}. L'écart entre vos deux fuseaux varie ` +
    `donc d'une heure selon la saison. Les créneaux ci-dessus tiennent déjà compte de la date ` +
    `choisie : l'heure affichée est la bonne.`
  );
}

/** Le fuseau connaît-il deux décalages différents dans l'année de `reference` ? */
export function observesDaylightSaving(timeZone: TimeZoneId, reference: Date = new Date()): boolean {
  const year = getWallClockInZone(reference, timeZone).year;
  const january = getOffsetMinutes(new Date(Date.UTC(year, 0, 15, 12)), timeZone);
  const july = getOffsetMinutes(new Date(Date.UTC(year, 6, 15, 12)), timeZone);
  return january !== july;
}
