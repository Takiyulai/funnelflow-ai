// lib/funnels/ics.ts
// 🆕 LOT 4 — Génère un événement calendrier (.ics) pour le webinaire, exposé
// en data URI directement sur le CTA "Ajouter à mon agenda" de la page de
// confirmation. Pas de route serveur ni de dépendance au slug publié : le
// fichier est généré au moment même de la génération IA du tunnel et reste
// valable pour tous les agendas (Google, Outlook, Apple...).

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formate une date en UTC "basic format" ICS : YYYYMMDDTHHMMSSZ. */
function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Échappe les caractères spéciaux ICS (virgule, point-virgule, retour ligne). */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildWebinarIcsContent(args: {
  title: string;
  description?: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
}): string {
  const start = args.startDate;
  const end = new Date(start.getTime() + (args.durationMinutes ?? 60) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoFunnel AI//Webinar//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:webinar-${start.getTime()}@autofunnel.ai`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(args.title)}`,
    args.description ? `DESCRIPTION:${escapeIcsText(args.description)}` : "",
    args.location ? `LOCATION:${escapeIcsText(args.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** Retourne une data URI `text/calendar` directement utilisable comme URL de
 *  CTA (mode "redirect") — le navigateur propose le téléchargement/l'ajout à
 *  l'agenda sans aucune route serveur ni connaissance du slug publié. */
export function buildWebinarIcsDataUri(args: {
  title: string;
  description?: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
}): string {
  const ics = buildWebinarIcsContent(args);
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}
