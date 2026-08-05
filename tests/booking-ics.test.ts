// tests/booking-ics.test.ts
//
// Fichier .ics d'un rendez-vous.
//
// Ces tests portent sur des détails de format qui échouent SILENCIEUSEMENT :
// un .ics mal formé n'affiche pas d'erreur, l'événement n'apparaît simplement
// jamais dans l'agenda du destinataire. On verrouille donc les trois pièges
// classiques : le repliement des lignes à 75 octets (Outlook), les séparateurs
// CRLF, et le METHOD:CANCEL sans lequel un RDV annulé reste dans l'agenda.

import { describe, it, expect } from "vitest";
import { buildBookingIcs, buildBookingIcsDataUri } from "@/lib/booking/ics";

const base = {
  bookingId: "abc-123",
  title: "Appel découverte",
  startsAt: new Date("2026-07-09T14:00:00.000Z"),
  endsAt: new Date("2026-07-09T14:30:00.000Z"),
  organizerName: "Dramane",
  organizerEmail: "dramane@exemple.test",
  attendeeName: "Awa",
  attendeeEmail: "awa@exemple.test",
};

describe("génération du .ics", () => {
  it("produit un calendrier valide en UTC", () => {
    const ics = buildBookingIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    // Le suffixe Z est ce qui permet à chaque agenda d'afficher l'heure dans
    // le fuseau de SON propriétaire — indispensable entre Paris et Abidjan.
    expect(ics).toContain("DTSTART:20260709T140000Z");
    expect(ics).toContain("DTEND:20260709T143000Z");
  });

  it("sépare les lignes par CRLF", () => {
    // La RFC 5545 impose CRLF ; un simple \n suffit à faire rejeter le fichier.
    const ics = buildBookingIcs(base);
    expect(ics.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("garde un UID stable entre la confirmation et l'annulation", () => {
    // Sans UID identique, l'agenda crée un second événement au lieu de
    // supprimer le premier : le destinataire se retrouve avec un doublon.
    const confirme = buildBookingIcs(base);
    const annule = buildBookingIcs({ ...base, cancelled: true });
    const uid = /UID:(.+)/.exec(confirme)?.[1];
    expect(uid).toBeTruthy();
    expect(annule).toContain(`UID:${uid}`);
  });

  it("marque explicitement l'annulation", () => {
    const annule = buildBookingIcs({ ...base, cancelled: true });
    expect(annule).toContain("METHOD:CANCEL");
    expect(annule).toContain("STATUS:CANCELLED");
    // SEQUENCE doit croître, sinon l'agenda ignore la mise à jour.
    expect(annule).toContain("SEQUENCE:1");
  });

  it("replie les lignes trop longues", () => {
    const ics = buildBookingIcs({
      ...base,
      description: "Une description volontairement très longue ".repeat(12),
    });
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("échappe les caractères réservés", () => {
    const ics = buildBookingIcs({ ...base, title: "Appel; découverte, étape 1" });
    expect(ics).toContain("SUMMARY:Appel\\; découverte\\, étape 1");
  });

  it("déclare organisateur et participant", () => {
    const ics = buildBookingIcs(base);
    expect(ics).toContain("mailto:dramane@exemple.test");
    expect(ics).toContain("mailto:awa@exemple.test");
  });

  it("produit une data URI exploitable comme lien", () => {
    const uri = buildBookingIcsDataUri(base);
    expect(uri.startsWith("data:text/calendar;charset=utf8,")).toBe(true);
    expect(decodeURIComponent(uri.split(",").slice(1).join(","))).toContain("BEGIN:VEVENT");
  });
});
