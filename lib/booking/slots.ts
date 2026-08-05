// lib/booking/slots.ts
//
// Moteur de créneaux — FONCTION PURE, sans accès réseau ni base.
//
// C'est le cœur du module de RDV, donc la partie qu'il faut pouvoir tester
// exhaustivement sans monter d'infrastructure. Tout entre par les paramètres :
// règles, exceptions, réservations existantes, et l'instant « maintenant ».
//
// ── LES QUATRE RÈGLES QU'IL APPLIQUE ───────────────────────────────────────
// 1. DISPONIBILITÉ  : plages hebdo en heure locale de l'hôte, écrasées le cas
//    échéant par une exception du jour.
// 2. DÉLAI MINIMUM  : on ne propose rien avant `now + minNoticeMin`.
// 3. HORIZON        : ni au-delà de `now + horizonDays`.
// 4. OCCUPATION     : tout créneau qui CHEVAUCHE une réservation existante
//    (battement compris) est retiré.
//
// ── LE PIÈGE DE FUSEAU ─────────────────────────────────────────────────────
// Les règles sont exprimées dans le fuseau de l'HÔTE ; les créneaux sont
// rendus au VISITEUR, groupés par SON jour civil. Un créneau du vendredi soir
// à Paris peut tomber le vendredi après-midi à Abidjan — ou le samedi matin
// pour un visiteur asiatique. On génère donc jour d'hôte par jour d'hôte, puis
// on regroupe par jour de visiteur : jamais l'inverse.

import type {
  AvailabilityException,
  AvailabilityRule,
  BusyInterval,
  DaySlots,
  Slot,
} from "./types";
import {
  dateKeyInZone,
  getWallClockInZone,
  zonedWallClockToUtc,
  type TimeZoneId,
} from "./timezones";

export type SlotEngineInput = {
  /** Fuseau IANA de l'hôte : réfère les règles. */
  hostTimezone: TimeZoneId;
  /** Fuseau du visiteur : sert UNIQUEMENT au regroupement par jour. */
  visitorTimezone: TimeZoneId;

  durationMin: number;
  bufferMin: number;
  minNoticeMin: number;
  horizonDays: number;
  slotStepMin: number;

  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  busy: BusyInterval[];

  /** Instant de référence (injecté pour rendre la fonction testable). */
  now: Date;
  /** Borne basse optionnelle — pour paginer par semaine. */
  fromDay?: string;
  /** Nombre de jours à produire (par défaut : l'horizon complet). */
  days?: number;
};

const MIN = 60_000;
const DAY_MIN = 1440;

/** Ajoute `n` jours civils à une clé "YYYY-MM-DD" (arithmétique pure). */
function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Plages ouvertes (minutes locales hôte) pour un jour civil de l'hôte. */
export function windowsForHostDay(
  dayKey: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
): Array<{ startMin: number; endMin: number }> {
  const dayExceptions = exceptions.filter((e) => e.day === dayKey);

  // Une fermeture l'emporte toujours : c'est le moyen d'être injoignable un
  // jour férié sans toucher aux règles hebdo.
  if (dayExceptions.some((e) => e.kind === "closed")) return [];

  const windows = dayExceptions.filter(
    (e) => e.kind === "window" && e.startMin != null && e.endMin != null,
  );
  if (windows.length > 0) {
    // Une ouverture ponctuelle REMPLACE les règles hebdo du jour (elle ne
    // s'y ajoute pas) : « exceptionnellement, ce samedi, 10h-12h ».
    return windows.map((w) => ({ startMin: w.startMin as number, endMin: w.endMin as number }));
  }

  const weekday = weekdayOfKey(dayKey);
  return rules
    .filter((r) => r.weekday === weekday && r.endMin > r.startMin)
    .map((r) => ({ startMin: r.startMin, endMin: r.endMin }))
    .sort((a, b) => a.startMin - b.startMin);
}

/**
 * Génère les créneaux réservables, groupés par jour civil du VISITEUR.
 * Les jours sans créneau sont retournés avec une liste vide : l'interface doit
 * pouvoir afficher « aucune disponibilité » plutôt qu'un trou dans le calendrier.
 */
export function generateSlots(input: SlotEngineInput): DaySlots[] {
  const {
    hostTimezone,
    visitorTimezone,
    durationMin,
    bufferMin,
    minNoticeMin,
    horizonDays,
    slotStepMin,
    rules,
    exceptions,
    busy,
    now,
  } = input;

  if (durationMin <= 0 || slotStepMin <= 0) return [];

  const earliest = new Date(now.getTime() + minNoticeMin * MIN);
  const latest = new Date(now.getTime() + horizonDays * DAY_MIN * MIN);

  // Intervalles occupés, élargis du battement APRÈS chaque RDV. Le battement
  // protège l'hôte ; il n'appartient pas au rendez-vous lui-même.
  const busyRanges = busy
    .map((b) => ({
      start: Date.parse(b.startsAt),
      end: Date.parse(b.endsAt) + bufferMin * MIN,
    }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
    .sort((a, b) => a.start - b.start);

  const overlapsBusy = (start: number, end: number): boolean =>
    busyRanges.some((b) => start < b.end && end > b.start);

  // On balaie les jours de l'HÔTE, avec une marge d'un jour de chaque côté :
  // un créneau d'hôte peut appartenir à la veille ou au lendemain civil du
  // visiteur quand les fuseaux sont très éloignés.
  const firstHostDay = addDaysToKey(dateKeyInZone(now, hostTimezone), -1);
  const hostDayCount = horizonDays + 3;

  const byVisitorDay = new Map<string, Slot[]>();

  for (let i = 0; i < hostDayCount; i++) {
    const hostDay = addDaysToKey(firstHostDay, i);
    const windows = windowsForHostDay(hostDay, rules, exceptions);
    if (windows.length === 0) continue;

    const [y, m, d] = hostDay.split("-").map(Number);

    for (const win of windows) {
      // Dernier départ possible : la fin du RDV ne doit pas dépasser la plage.
      for (let start = win.startMin; start + durationMin <= win.endMin; start += slotStepMin) {
        // Conversion heure locale hôte → instant absolu. C'est ICI que le
        // changement d'heure est absorbé : `zonedWallClockToUtc` interroge les
        // règles réelles du fuseau à cette date précise.
        const startUtc = zonedWallClockToUtc(
          { year: y, month: m, day: d, hour: Math.floor(start / 60), minute: start % 60 },
          hostTimezone,
        );
        const startMs = startUtc.getTime();
        const endMs = startMs + durationMin * MIN;

        if (startMs < earliest.getTime()) continue;
        if (startMs > latest.getTime()) continue;
        if (overlapsBusy(startMs, endMs)) continue;

        const visitorDay = dateKeyInZone(startUtc, visitorTimezone);
        const list = byVisitorDay.get(visitorDay);
        const slot: Slot = {
          startsAt: startUtc.toISOString(),
          endsAt: new Date(endMs).toISOString(),
        };
        if (list) list.push(slot);
        else byVisitorDay.set(visitorDay, [slot]);
      }
    }
  }

  // Fenêtre rendue : les jours civils du VISITEUR, depuis aujourd'hui.
  const firstVisitorDay = input.fromDay ?? dateKeyInZone(now, visitorTimezone);
  const dayCount = input.days ?? horizonDays;

  const out: DaySlots[] = [];
  for (let i = 0; i < dayCount; i++) {
    const day = addDaysToKey(firstVisitorDay, i);
    const slots = (byVisitorDay.get(day) ?? []).sort((a, b) =>
      a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0,
    );
    out.push({ day, slots });
  }
  return out;
}

/**
 * Revalidation d'un créneau AU MOMENT de la réservation.
 *
 * Indispensable : entre l'affichage de la grille et le clic du visiteur, il
 * peut s'écouler plusieurs minutes. Le créneau a pu être pris, ou passer sous
 * le délai minimum. On ne fait pas confiance à ce que renvoie le client — il
 * pourrait aussi être forgé.
 *
 * Reste la course des deux clics simultanés, que seul l'index unique en base
 * (bookings_no_double_booking_uidx) peut trancher.
 */
export function isSlotBookable(
  startsAtIso: string,
  input: Omit<SlotEngineInput, "fromDay" | "days">,
): { ok: true } | { ok: false; reason: string } {
  const startMs = Date.parse(startsAtIso);
  if (!Number.isFinite(startMs)) {
    return { ok: false, reason: "Créneau invalide." };
  }

  const earliest = input.now.getTime() + input.minNoticeMin * MIN;
  if (startMs < earliest) {
    return {
      ok: false,
      reason: "Ce créneau est trop proche : choisis-en un plus tardif.",
    };
  }

  const latest = input.now.getTime() + input.horizonDays * DAY_MIN * MIN;
  if (startMs > latest) {
    return { ok: false, reason: "Ce créneau dépasse l'horizon de réservation." };
  }

  const endMs = startMs + input.durationMin * MIN;
  const conflict = input.busy.some((b) => {
    const bs = Date.parse(b.startsAt);
    const be = Date.parse(b.endsAt) + input.bufferMin * MIN;
    return startMs < be && endMs > bs;
  });
  if (conflict) {
    return { ok: false, reason: "Ce créneau vient d'être réservé. Choisis-en un autre." };
  }

  // Le créneau doit tomber dans une plage ouverte ET sur la grille.
  const startUtc = new Date(startMs);
  const hostDay = dateKeyInZone(startUtc, input.hostTimezone);
  const windows = windowsForHostDay(hostDay, input.rules, input.exceptions);
  if (windows.length === 0) {
    return { ok: false, reason: "Aucune disponibilité ce jour-là." };
  }

  const wc = getWallClockInZone(startUtc, input.hostTimezone);
  const minutes = wc.hour * 60 + wc.minute;
  const fits = windows.some(
    (w) =>
      minutes >= w.startMin &&
      minutes + input.durationMin <= w.endMin &&
      (minutes - w.startMin) % input.slotStepMin === 0,
  );
  if (!fits) {
    return { ok: false, reason: "Ce créneau ne correspond à aucune disponibilité." };
  }

  return { ok: true };
}
