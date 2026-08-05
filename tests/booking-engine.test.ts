// tests/booking-engine.test.ts
//
// Moteur du Calendrier de RDV : fuseaux + génération de créneaux.
//
// Ces deux modules sont des fonctions PURES, donc entièrement vérifiables sans
// base ni réseau. C'est délibéré : le mode d'échec d'un module de RDV est
// silencieux (personne ne remarque un créneau décalé d'une heure avant que le
// prospect ne se présente au mauvais moment), il doit donc être verrouillé par
// des tests plutôt que par de l'observation.
//
// Le scénario central : un hôte à Paris, des visiteurs en Afrique francophone.
// L'Afrique de l'Ouest ne change JAMAIS d'heure, l'Europe si — un créneau
// « 16h Paris » vaut 15h à Abidjan en hiver et 14h en été.

import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  daylightSavingNotice,
  dateKeyInZone,
  formatSlotDualLabel,
  formatTimeInZone,
  getOffsetMinutes,
  isValidTimeZone,
  observesDaylightSaving,
  sameWallClock,
  weekdayInZone,
  zonedWallClockToUtc,
} from "@/lib/booking/timezones";
import { generateSlots, isSlotBookable, windowsForHostDay } from "@/lib/booking/slots";
import type { AvailabilityRule, AvailabilityException } from "@/lib/booking/types";

const H = (h: number, m = 0) => h * 60 + m;

describe("fuseaux — décalages réels", () => {
  it("Paris change d'heure, l'Afrique de l'Ouest jamais", () => {
    const janvier = new Date(Date.UTC(2026, 0, 15, 12));
    const juillet = new Date(Date.UTC(2026, 6, 15, 12));

    expect(getOffsetMinutes(janvier, "Europe/Paris")).toBe(60);
    expect(getOffsetMinutes(juillet, "Europe/Paris")).toBe(120);

    expect(getOffsetMinutes(janvier, "Africa/Abidjan")).toBe(0);
    expect(getOffsetMinutes(juillet, "Africa/Abidjan")).toBe(0);
    expect(getOffsetMinutes(janvier, "Africa/Douala")).toBe(60);
    expect(getOffsetMinutes(juillet, "Africa/Douala")).toBe(60);
  });

  it("distingue les deux fuseaux de la RD Congo", () => {
    const t = new Date(Date.UTC(2026, 6, 15, 12));
    expect(getOffsetMinutes(t, "Africa/Kinshasa")).toBe(60);
    expect(getOffsetMinutes(t, "Africa/Lubumbashi")).toBe(120);
  });

  it("détecte quels fuseaux appliquent l'heure d'été", () => {
    expect(observesDaylightSaving("Europe/Paris")).toBe(true);
    expect(observesDaylightSaving("Africa/Abidjan")).toBe(false);
    expect(observesDaylightSaving("Africa/Douala")).toBe(false);
    expect(observesDaylightSaving("Africa/Algiers")).toBe(false);
  });

  it("n'avertit du changement d'heure que les fuseaux concernés", () => {
    expect(daylightSavingNotice("Africa/Dakar")).toBeNull();
    expect(daylightSavingNotice("Europe/Paris")).toMatch(/changement d'heure/);
  });
});

describe("fuseaux — conversion horloge murale ↔ instant", () => {
  it("16h00 à Paris ne vaut pas la même heure à Abidjan selon la saison", () => {
    const ete = zonedWallClockToUtc(
      { year: 2026, month: 7, day: 9, hour: 16, minute: 0 },
      "Europe/Paris",
    );
    const hiver = zonedWallClockToUtc(
      { year: 2026, month: 1, day: 9, hour: 16, minute: 0 },
      "Europe/Paris",
    );

    expect(ete.toISOString()).toBe("2026-07-09T14:00:00.000Z");
    expect(hiver.toISOString()).toBe("2026-01-09T15:00:00.000Z");

    // Le visiteur ivoirien voit bien une heure DIFFÉRENTE selon la saison,
    // pour un « 16h » identique côté hôte. C'est exactement le RDV manqué que
    // le module doit rendre impossible.
    expect(formatTimeInZone(ete, "Africa/Abidjan")).toBe("14:00");
    expect(formatTimeInZone(hiver, "Africa/Abidjan")).toBe("15:00");
  });

  it("fait l'aller-retour sans perte pour un fuseau africain", () => {
    const utc = zonedWallClockToUtc(
      { year: 2026, month: 3, day: 30, hour: 9, minute: 30 },
      "Africa/Douala",
    );
    expect(formatTimeInZone(utc, "Africa/Douala")).toBe("09:30");
    expect(dateKeyInZone(utc, "Africa/Douala")).toBe("2026-03-30");
  });

  it("donne le bon jour de semaine dans le fuseau visé", () => {
    // 2026-07-09 est un jeudi (4).
    const utc = zonedWallClockToUtc(
      { year: 2026, month: 7, day: 9, hour: 12, minute: 0 },
      "Africa/Abidjan",
    );
    expect(weekdayInZone(utc, "Africa/Abidjan")).toBe(4);
  });

  it("survit à la nuit de bascule sans produire de date absurde", () => {
    // 2026-03-29 02:30 n'existe pas à Paris (saut de 02:00 à 03:00).
    const utc = zonedWallClockToUtc(
      { year: 2026, month: 3, day: 29, hour: 2, minute: 30 },
      "Europe/Paris",
    );
    expect(Number.isNaN(utc.getTime())).toBe(false);
    expect(dateKeyInZone(utc, "Europe/Paris")).toBe("2026-03-29");
  });
});

describe("fuseaux — affichage", () => {
  const utc = new Date("2026-07-09T14:00:00.000Z");

  it("affiche les deux heures quand hôte et visiteur diffèrent", () => {
    const label = formatSlotDualLabel(utc, "Africa/Abidjan", "Europe/Paris", "fr");
    expect(label).toContain("14:00");
    expect(label).toContain("16:00");
    expect(label).toContain("Abidjan");
    expect(label).toContain("Paris");
  });

  it("n'affiche qu'une heure quand les fuseaux coïncident", () => {
    // Dakar et Abidjan sont deux noms pour la même heure : mentionner les deux
    // serait du bruit, pas de la précision.
    expect(formatSlotDualLabel(utc, "Africa/Dakar", "Africa/Abidjan", "fr")).toBe("14:00");
    expect(sameWallClock(utc, "Africa/Dakar", "Africa/Abidjan")).toBe(true);
  });

  it("valide les identifiants de fuseau", () => {
    expect(isValidTimeZone("Africa/Abidjan")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it("propose des fuseaux réels et un défaut sans heure d'été", () => {
    expect(TIMEZONE_OPTIONS.length).toBeGreaterThan(20);
    for (const t of TIMEZONE_OPTIONS) expect(isValidTimeZone(t.id)).toBe(true);
    expect(observesDaylightSaving(DEFAULT_TIMEZONE)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/** Lundi→vendredi, 9h-12h et 14h-17h, heure de l'hôte. */
const RULES: AvailabilityRule[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startMin: H(9), endMin: H(12) },
  { weekday, startMin: H(14), endMin: H(17) },
]);

function baseInput(over: Partial<Parameters<typeof generateSlots>[0]> = {}) {
  return {
    hostTimezone: "Europe/Paris",
    visitorTimezone: "Africa/Abidjan",
    durationMin: 30,
    bufferMin: 0,
    minNoticeMin: 0,
    horizonDays: 7,
    slotStepMin: 30,
    rules: RULES,
    exceptions: [] as AvailabilityException[],
    busy: [],
    // Mercredi 8 juillet 2026, 06:00 UTC.
    now: new Date("2026-07-08T06:00:00.000Z"),
    ...over,
  };
}

describe("plages ouvertes d'un jour", () => {
  it("applique les règles hebdomadaires", () => {
    // 2026-07-09 = jeudi
    expect(windowsForHostDay("2026-07-09", RULES, [])).toEqual([
      { startMin: 540, endMin: 720 },
      { startMin: 840, endMin: 1020 },
    ]);
  });

  it("une fermeture l'emporte sur les règles", () => {
    const exceptions: AvailabilityException[] = [{ day: "2026-07-09", kind: "closed" }];
    expect(windowsForHostDay("2026-07-09", RULES, exceptions)).toEqual([]);
  });

  it("une ouverture ponctuelle REMPLACE les règles du jour", () => {
    // Sinon un « exceptionnellement 10h-12h ce jeudi » s'ajouterait aux
    // horaires normaux au lieu de les restreindre.
    const exceptions: AvailabilityException[] = [
      { day: "2026-07-09", kind: "window", startMin: H(10), endMin: H(12) },
    ];
    expect(windowsForHostDay("2026-07-09", RULES, exceptions)).toEqual([
      { startMin: 600, endMin: 720 },
    ]);
  });

  it("ouvre un samedi normalement fermé", () => {
    expect(windowsForHostDay("2026-07-11", RULES, [])).toEqual([]);
    const exceptions: AvailabilityException[] = [
      { day: "2026-07-11", kind: "window", startMin: H(10), endMin: H(12) },
    ];
    expect(windowsForHostDay("2026-07-11", RULES, exceptions)).toHaveLength(1);
  });
});

describe("génération de créneaux", () => {
  it("produit les bons créneaux dans le fuseau du visiteur", () => {
    const days = generateSlots(baseInput());
    const jeudi = days.find((d) => d.day === "2026-07-09");
    expect(jeudi).toBeDefined();

    // 9h-12h et 14h-17h heure de Paris (UTC+2 en juillet) = 07:00-10:00 et
    // 12:00-15:00 UTC, soit exactement ces heures-là à Abidjan (UTC+0).
    const heures = jeudi!.slots.map((s) => formatTimeInZone(new Date(s.startsAt), "Africa/Abidjan"));
    expect(heures.slice(0, 3)).toEqual(["07:00", "07:30", "08:00"]);
    expect(heures).toContain("14:30");
    // Un RDV de 30 min ne peut pas démarrer à 15:00 (fin de plage à 17h Paris).
    expect(heures).not.toContain("15:00");
    expect(jeudi!.slots).toHaveLength(12);
  });

  it("ne déborde jamais de la plage d'ouverture", () => {
    const days = generateSlots(baseInput({ durationMin: 45, slotStepMin: 45 }));
    const jeudi = days.find((d) => d.day === "2026-07-09")!;
    for (const s of jeudi.slots) {
      const fin = formatTimeInZone(new Date(s.endsAt), "Europe/Paris");
      expect(fin <= "12:00" || fin <= "17:00").toBe(true);
    }
  });

  it("ferme le week-end", () => {
    const days = generateSlots(baseInput());
    expect(days.find((d) => d.day === "2026-07-11")!.slots).toEqual([]); // samedi
    expect(days.find((d) => d.day === "2026-07-12")!.slots).toEqual([]); // dimanche
  });

  it("respecte le délai minimum", () => {
    // 48 h de préavis depuis mercredi 06:00 UTC → rien avant vendredi 06:00.
    const days = generateSlots(baseInput({ minNoticeMin: 48 * 60 }));
    const tousLesCreneaux = days.flatMap((d) => d.slots);
    for (const s of tousLesCreneaux) {
      expect(Date.parse(s.startsAt)).toBeGreaterThanOrEqual(
        Date.parse("2026-07-10T06:00:00.000Z"),
      );
    }
    expect(tousLesCreneaux.length).toBeGreaterThan(0);
  });

  it("respecte l'horizon de réservation", () => {
    const days = generateSlots(baseInput({ horizonDays: 2 }));
    for (const s of days.flatMap((d) => d.slots)) {
      expect(Date.parse(s.startsAt)).toBeLessThanOrEqual(
        Date.parse("2026-07-10T06:00:00.000Z"),
      );
    }
  });

  it("retire les créneaux déjà réservés", () => {
    const busy = [
      { startsAt: "2026-07-09T07:00:00.000Z", endsAt: "2026-07-09T07:30:00.000Z" },
    ];
    const jeudi = generateSlots(baseInput({ busy })).find((d) => d.day === "2026-07-09")!;
    const debuts = jeudi.slots.map((s) => s.startsAt);
    expect(debuts).not.toContain("2026-07-09T07:00:00.000Z");
    expect(debuts).toContain("2026-07-09T07:30:00.000Z");
  });

  it("applique le battement APRÈS un rendez-vous", () => {
    // Un RDV 07:00-07:30 + 30 min de battement bloque aussi 07:30.
    const busy = [
      { startsAt: "2026-07-09T07:00:00.000Z", endsAt: "2026-07-09T07:30:00.000Z" },
    ];
    const jeudi = generateSlots(baseInput({ busy, bufferMin: 30 })).find(
      (d) => d.day === "2026-07-09",
    )!;
    const debuts = jeudi.slots.map((s) => s.startsAt);
    expect(debuts).not.toContain("2026-07-09T07:00:00.000Z");
    expect(debuts).not.toContain("2026-07-09T07:30:00.000Z");
    expect(debuts).toContain("2026-07-09T08:00:00.000Z");
  });

  it("rend les jours vides plutôt que de les omettre", () => {
    // L'interface doit pouvoir écrire « aucune disponibilité » sur un jour,
    // pas afficher un calendrier troué.
    const days = generateSlots(baseInput({ horizonDays: 7 }));
    expect(days).toHaveLength(7);
    expect(days.every((d) => Array.isArray(d.slots))).toBe(true);
  });
});

describe("génération de créneaux — pièges de fuseau", () => {
  it("regroupe par jour civil du VISITEUR, pas de l'hôte", () => {
    // Hôte à Paris ouvert 9h-12h ; visiteur à Auckland (UTC+12), pour qui ces
    // créneaux tombent le lendemain matin. Un regroupement par jour d'hôte
    // afficherait les créneaux sous la mauvaise date.
    const days = generateSlots(
      baseInput({
        visitorTimezone: "Pacific/Auckland",
        rules: [{ weekday: 4, startMin: H(9), endMin: H(12) }],
      }),
    );
    const jeudi = days.find((d) => d.day === "2026-07-09");
    const vendredi = days.find((d) => d.day === "2026-07-10");
    expect(jeudi?.slots ?? []).toHaveLength(0);
    expect((vendredi?.slots ?? []).length).toBeGreaterThan(0);
  });

  it("garde une heure locale STABLE pour l'hôte de part et d'autre du changement d'heure", () => {
    // C'est le test qui justifie tout le module. L'hôte parisien dit « 9h ».
    // En octobre (heure d'été) comme en novembre (heure d'hiver), le créneau
    // doit rester 9h POUR LUI — c'est l'heure du visiteur ivoirien qui bouge.
    const enEte = generateSlots(
      baseInput({
        now: new Date("2026-10-20T06:00:00.000Z"),
        rules: [{ weekday: 4, startMin: H(9), endMin: H(10) }],
        horizonDays: 5,
      }),
    ).flatMap((d) => d.slots);

    const enHiver = generateSlots(
      baseInput({
        now: new Date("2026-11-03T06:00:00.000Z"),
        rules: [{ weekday: 4, startMin: H(9), endMin: H(10) }],
        horizonDays: 5,
      }),
    ).flatMap((d) => d.slots);

    expect(enEte.length).toBeGreaterThan(0);
    expect(enHiver.length).toBeGreaterThan(0);

    // Côté hôte : toujours 9h.
    expect(formatTimeInZone(new Date(enEte[0].startsAt), "Europe/Paris")).toBe("09:00");
    expect(formatTimeInZone(new Date(enHiver[0].startsAt), "Europe/Paris")).toBe("09:00");

    // Côté visiteur ivoirien : 7h avant la bascule, 8h après.
    expect(formatTimeInZone(new Date(enEte[0].startsAt), "Africa/Abidjan")).toBe("07:00");
    expect(formatTimeInZone(new Date(enHiver[0].startsAt), "Africa/Abidjan")).toBe("08:00");
  });

  it("fonctionne pour un hôte africain sans jamais décaler", () => {
    const octobre = generateSlots(
      baseInput({
        hostTimezone: "Africa/Douala",
        visitorTimezone: "Africa/Douala",
        now: new Date("2026-10-20T06:00:00.000Z"),
        rules: [{ weekday: 4, startMin: H(9), endMin: H(10) }],
        horizonDays: 5,
      }),
    ).flatMap((d) => d.slots);
    const novembre = generateSlots(
      baseInput({
        hostTimezone: "Africa/Douala",
        visitorTimezone: "Africa/Douala",
        now: new Date("2026-11-03T06:00:00.000Z"),
        rules: [{ weekday: 4, startMin: H(9), endMin: H(10) }],
        horizonDays: 5,
      }),
    ).flatMap((d) => d.slots);

    expect(formatTimeInZone(new Date(octobre[0].startsAt), "Africa/Douala")).toBe("09:00");
    expect(formatTimeInZone(new Date(novembre[0].startsAt), "Africa/Douala")).toBe("09:00");
  });
});

describe("revalidation au moment de réserver", () => {
  const input = baseInput();

  it("accepte un créneau légitime", () => {
    expect(isSlotBookable("2026-07-09T07:00:00.000Z", input)).toEqual({ ok: true });
  });

  it("refuse un créneau hors des plages d'ouverture", () => {
    const r = isSlotBookable("2026-07-09T03:00:00.000Z", input);
    expect(r.ok).toBe(false);
  });

  it("refuse un créneau qui n'est pas sur la grille", () => {
    // 07:07 n'est pas un multiple du pas de 30 min : signe d'un appel forgé.
    const r = isSlotBookable("2026-07-09T07:07:00.000Z", input);
    expect(r.ok).toBe(false);
  });

  it("refuse un créneau entre-temps réservé", () => {
    const r = isSlotBookable("2026-07-09T07:00:00.000Z", {
      ...input,
      busy: [{ startsAt: "2026-07-09T07:00:00.000Z", endsAt: "2026-07-09T07:30:00.000Z" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/réserv/);
  });

  it("refuse un créneau passé sous le délai minimum", () => {
    const r = isSlotBookable("2026-07-09T07:00:00.000Z", { ...input, minNoticeMin: 60 * 72 });
    expect(r.ok).toBe(false);
  });

  it("refuse un créneau un jour fermé par exception", () => {
    const r = isSlotBookable("2026-07-09T07:00:00.000Z", {
      ...input,
      exceptions: [{ day: "2026-07-09", kind: "closed" }],
    });
    expect(r.ok).toBe(false);
  });

  it("refuse une entrée invalide", () => {
    expect(isSlotBookable("pas-une-date", input).ok).toBe(false);
  });
});
