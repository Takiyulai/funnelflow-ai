// lib/booking/ics.ts
//
// Génération du fichier .ics d'un rendez-vous.
//
// ── POURQUOI PAS lib/funnels/ics.ts ────────────────────────────────────────
// L'ICS des webinaires ne gère qu'un PUBLISH sans participant. Un rendez-vous
// a deux parties (ORGANIZER / ATTENDEE), un UID stable, un numéro de séquence
// et un METHOD:CANCEL pour l'annulation — sans quoi l'agenda du visiteur
// garderait le RDV annulé pour l'éternité.
//
// Les instants sont écrits en UTC (suffixe Z) : c'est la forme la moins
// ambiguë, et elle évite d'embarquer une VTIMEZONE complète. Chaque agenda
// l'affiche ensuite dans le fuseau de son propriétaire — exactement ce qu'on
// veut entre un hôte parisien et un participant ivoirien.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Replie les lignes à 75 octets, comme l'exige la RFC 5545.
 * Outlook rejette silencieusement les fichiers dont les lignes débordent —
 * l'invitation n'apparaît alors tout simplement pas dans l'agenda.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

export type BookingIcsInput = {
  /** Identifiant stable du RDV : le même UID doit servir à l'annulation. */
  bookingId: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  organizerName: string;
  organizerEmail?: string;
  attendeeName: string;
  attendeeEmail: string;
  /** true → METHOD:CANCEL, qui retire l'événement de l'agenda du destinataire. */
  cancelled?: boolean;
};

export function buildBookingIcs(input: BookingIcsInput): string {
  const method = input.cancelled ? "CANCEL" : "REQUEST";
  const uid = `booking-${input.bookingId}@autofunnel.ai`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoFunnel AI//Booking//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    // SEQUENCE doit croître pour qu'un agenda accepte de remplacer l'événement
    // existant plutôt que d'en créer un doublon.
    `SEQUENCE:${input.cancelled ? 1 : 0}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(input.startsAt)}`,
    `DTEND:${toIcsDate(input.endsAt)}`,
    `SUMMARY:${escapeText(input.title)}`,
    input.description ? `DESCRIPTION:${escapeText(input.description)}` : "",
    input.location ? `LOCATION:${escapeText(input.location)}` : "",
    input.organizerEmail
      ? `ORGANIZER;CN=${escapeText(input.organizerName)}:mailto:${input.organizerEmail}`
      : "",
    `ATTENDEE;CN=${escapeText(input.attendeeName)};RSVP=TRUE:mailto:${input.attendeeEmail}`,
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.map(foldLine).join("\r\n");
}

/** Data URI directement utilisable comme href de téléchargement. */
export function buildBookingIcsDataUri(input: BookingIcsInput): string {
  return `data:text/calendar;charset=utf8,${encodeURIComponent(buildBookingIcs(input))}`;
}
