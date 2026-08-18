// lib/booking/emails.ts
//
// E-mails de confirmation / annulation d'un rendez-vous.
//
// ── LE POINT CRITIQUE : L'HEURE AFFICHÉE ───────────────────────────────────
// Chaque destinataire reçoit l'heure DANS SON PROPRE FUSEAU, et la mention de
// l'autre quand les deux diffèrent. Un e-mail qui n'annoncerait qu'une seule
// heure, sans dire laquelle, est la façon la plus sûre de rater un rendez-vous
// entre Paris et Abidjan — d'autant que l'écart change deux fois par an.
//
// Envoi immédiat via Resend (comme le dispatch post-capture), pas via la file
// `scheduled_emails` : une confirmation de RDV qui arrive au prochain passage
// du cron n'inspire pas confiance.

import "server-only";
import { sendEmail } from "@/lib/crm/email";
import { businessSender } from "@/lib/email/sender";
import { buildBookingIcsDataUri } from "./ics";
import {
  formatDateInZone,
  formatTimeInZone,
  sameWallClock,
  shortZoneLabel,
  type TimeZoneId,
} from "./timezones";

export type BookingEmailContext = {
  bookingId: string;
  eventName: string;
  startsAt: Date;
  endsAt: Date;
  hostTimezone: TimeZoneId;
  visitorTimezone: TimeZoneId;
  visitorName: string;
  visitorEmail: string;
  hostName: string;
  hostEmail?: string | null;
  locationLabel?: string | null;
  note?: string | null;
  /** 🆕 Réponses aux champs personnalisés, indexées par nom de champ. */
  answers?: Record<string, string | boolean> | null;
  manageUrl: string;
  language?: string;
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ligne d'horaire destinée à `recipientTz`.
 * Quand l'autre partie est dans un fuseau différent, on ajoute son heure entre
 * parenthèses : le lecteur n'a aucune conversion à faire de tête.
 */
export function scheduleLine(
  ctx: BookingEmailContext,
  recipientTz: TimeZoneId,
  otherTz: TimeZoneId,
  otherLabel: string,
): string {
  const date = formatDateInZone(ctx.startsAt, recipientTz, ctx.language);
  const start = formatTimeInZone(ctx.startsAt, recipientTz, ctx.language);
  const end = formatTimeInZone(ctx.endsAt, recipientTz, ctx.language);
  const base = `${date} · ${start} – ${end} (${shortZoneLabel(recipientTz)})`;

  if (sameWallClock(ctx.startsAt, recipientTz, otherTz)) return base;

  const otherStart = formatTimeInZone(ctx.startsAt, otherTz, ctx.language);
  return `${base}<br><span style="color:#64748b">soit ${otherStart} ${otherLabel} (${shortZoneLabel(otherTz)})</span>`;
}

function shell(title: string, bodyHtml: string, footer?: string): string {
  // 🆕 LARGEUR ET RESPIRATION
  //
  // La carte était plafonnée à 560 px avec 24 px de marge sur le <body>. Sur
  // mobile, ces marges mangeaient 48 px de largeur utile sur un écran qui n'en
  // a que 360 — d'où l'impression d'un contenu tassé alors que la place
  // existe. Sur grand écran, 560 px laissaient une large bande grise vide.
  //
  // 640 px est le compromis retenu : au-delà, les lignes de texte deviennent
  // trop longues pour un email et la lecture se dégrade. Les marges tombent à
  // 12 px sous 600 px de large via la media query ci-dessous.
  //
  // Cette media query est un BONUS, pas une béquille : les clients qui la
  // suppriment (certains webmails) affichent la version par défaut, qui reste
  // correcte. Rien ne dépend d'elle pour être lisible.
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@media only screen and (max-width:600px){
  .ff-wrap{padding:12px !important}
  .ff-body{padding:22px 18px 6px !important}
  .ff-foot{padding:14px 18px 22px !important}
  .ff-title{font-size:19px !important}
}
</style></head>
<body class="ff-wrap" style="margin:0;padding:20px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td class="ff-body" style="padding:28px 28px 8px">
      <h1 class="ff-title" style="margin:0 0 16px;font-size:21px;line-height:1.3">${esc(title)}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td class="ff-foot" style="padding:16px 28px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6">
      ${footer ?? "Envoyé via AutoFunnel AI."}
    </td></tr>
  </table>
</body></html>`;
}

function detailsTable(rows: Array<[string, string]>): string {
  // 🆕 LIBELLÉ AU-DESSUS DE LA VALEUR, PLUS EN COLONNE.
  //
  // ── CE QUI CASSAIT ─────────────────────────────────────────────────────────
  // La colonne de libellés avait une largeur FIXE de 110 px, et les deux
  // cellules n'avaient aucun écart horizontal. Sur mobile, deux défauts
  // visibles à l'œil nu :
  //   • le tableau se comprime sous 110 px et « Rendez-vous » se coupe en
  //     « Rendez- / vous » ;
  //   • sans padding entre les colonnes, « Participant » et « DRAMANE » se
  //     touchent et se lisent comme un seul mot.
  //
  // ── POURQUOI EMPILER PLUTÔT QUE CORRIGER LA LARGEUR ────────────────────────
  // Passer en pourcentage repousserait le problème sans le régler : un libellé
  // plus long ou une police plus grande le ferait revenir. Empiler supprime la
  // contrainte à la racine — la valeur dispose de TOUTE la largeur, ce qui est
  // exactement ce qui manquait, et aucune media query n'est nécessaire.
  //
  // `word-break` protège les valeurs insécables : une adresse email longue
  // débordait de la carte au lieu de passer à la ligne.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 22px;font-size:15px;line-height:1.55">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:0 0 14px">` +
      `<div style="color:#64748b;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 3px">${esc(k)}</div>` +
      `<div style="font-weight:600;word-break:break-word">${v}</div>` +
      `</td></tr>`,
  )
  .join("")}
</table>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600">${esc(label)}</a>`;
}

/** E-mail envoyé au VISITEUR : heure dans SON fuseau. */
export function buildVisitorConfirmation(ctx: BookingEmailContext): { subject: string; html: string } {
  const when = scheduleLine(ctx, ctx.visitorTimezone, ctx.hostTimezone, "chez ton interlocuteur");
  const ics = buildBookingIcsDataUri({
    bookingId: ctx.bookingId,
    title: ctx.eventName,
    description: ctx.note ?? undefined,
    location: ctx.locationLabel ?? undefined,
    startsAt: ctx.startsAt,
    endsAt: ctx.endsAt,
    organizerName: ctx.hostName,
    organizerEmail: ctx.hostEmail ?? undefined,
    attendeeName: ctx.visitorName,
    attendeeEmail: ctx.visitorEmail,
  });

  const rows: Array<[string, string]> = [
    ["Rendez-vous", esc(ctx.eventName)],
    ["Quand", when],
    ["Avec", esc(ctx.hostName)],
  ];
  if (ctx.locationLabel) rows.push(["Où", esc(ctx.locationLabel)]);

  const html = shell(
    `C'est confirmé, ${ctx.visitorName} !`,
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#475569">Ton rendez-vous est réservé. Voici le récapitulatif :</p>
     ${detailsTable(rows)}
     <p style="margin:0 0 18px">${button(ics, "Ajouter à mon agenda")}</p>
     <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">
       Un empêchement ? <a href="${esc(ctx.manageUrl)}" style="color:#0f172a">annule ou reprogramme ici</a>.
     </p>`,
    "Les heures affichées sont dans ton fuseau horaire. Ajoute l'événement à ton agenda pour ne pas te tromper.",
  );

  return { subject: `Confirmé — ${ctx.eventName}`, html };
}

/** E-mail envoyé à l'HÔTE : heure dans SON fuseau. */
export function buildHostNotification(ctx: BookingEmailContext): { subject: string; html: string } {
  const when = scheduleLine(ctx, ctx.hostTimezone, ctx.visitorTimezone, "chez le participant");

  const rows: Array<[string, string]> = [
    ["Rendez-vous", esc(ctx.eventName)],
    ["Quand", when],
    ["Participant", `${esc(ctx.visitorName)}<br><span style="font-weight:400;color:#64748b">${esc(ctx.visitorEmail)}</span>`],
  ];
  if (ctx.note) rows.push(["Message", esc(ctx.note)]);

  // 🆕 Réponses aux champs personnalisés du formulaire. L'hôte les reçoit dans
  // la notification : il prépare souvent son entretien depuis sa boîte mail,
  // sans rouvrir l'application.
  if (ctx.answers) {
    for (const [key, value] of Object.entries(ctx.answers)) {
      const label = key.replace(/_/g, " ");
      const text =
        typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value);
      if (text.trim()) rows.push([esc(label), esc(text)]);
    }
  }

  const html = shell(
    "Nouveau rendez-vous réservé",
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#475569">${esc(ctx.visitorName)} vient de réserver un créneau.</p>
     ${detailsTable(rows)}
     <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">
       <a href="${esc(ctx.manageUrl)}" style="color:#0f172a">Voir ou annuler ce rendez-vous</a>
     </p>`,
    "Les heures ci-dessus sont dans TON fuseau horaire.",
  );

  return { subject: `Nouveau RDV — ${ctx.visitorName} · ${ctx.eventName}`, html };
}

export function buildCancellation(
  ctx: BookingEmailContext,
  recipient: "visitor" | "host",
  by: "visitor" | "host",
): { subject: string; html: string } {
  const tz = recipient === "visitor" ? ctx.visitorTimezone : ctx.hostTimezone;
  const other = recipient === "visitor" ? ctx.hostTimezone : ctx.visitorTimezone;
  const when = scheduleLine(ctx, tz, other, recipient === "visitor" ? "chez ton interlocuteur" : "chez le participant");

  const who = by === "visitor" ? esc(ctx.visitorName) : esc(ctx.hostName);
  const html = shell(
    "Rendez-vous annulé",
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#475569">${who} a annulé ce rendez-vous.</p>
     ${detailsTable([
       ["Rendez-vous", esc(ctx.eventName)],
       ["Était prévu", when],
     ])}
     <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">Le créneau est de nouveau disponible.</p>`,
  );
  return { subject: `Annulé — ${ctx.eventName}`, html };
}

/**
 * Envoie confirmation visiteur + notification hôte.
 * Best-effort : un échec d'e-mail ne doit jamais invalider une réservation
 * déjà écrite en base — le visiteur verrait « échec » alors que son créneau
 * est bien pris, et il réserverait deux fois.
 */
export async function sendBookingEmails(
  ctx: BookingEmailContext,
  hostBusinessName?: string | null,
): Promise<{ visitor: boolean; host: boolean }> {
  const sender = businessSender(hostBusinessName ?? ctx.hostName, ctx.hostEmail ?? undefined);

  const visitorMail = buildVisitorConfirmation(ctx);
  const hostMail = buildHostNotification(ctx);

  const [v, h] = await Promise.all([
    sendEmail({
      to: ctx.visitorEmail,
      subject: visitorMail.subject,
      html: visitorMail.html,
      from: sender.from,
      replyTo: ctx.hostEmail ?? undefined,
    }).catch(() => ({ ok: false })),
    ctx.hostEmail
      ? sendEmail({
          to: ctx.hostEmail,
          subject: hostMail.subject,
          html: hostMail.html,
          replyTo: ctx.visitorEmail,
        }).catch(() => ({ ok: false }))
      : Promise.resolve({ ok: false }),
  ]);

  if (!v.ok) console.warn("[booking] e-mail visiteur non envoyé");
  return { visitor: Boolean(v.ok), host: Boolean(h.ok) };
}

export async function sendCancellationEmails(
  ctx: BookingEmailContext,
  by: "visitor" | "host",
): Promise<void> {
  const visitorMail = buildCancellation(ctx, "visitor", by);
  const hostMail = buildCancellation(ctx, "host", by);
  await Promise.all([
    sendEmail({ to: ctx.visitorEmail, subject: visitorMail.subject, html: visitorMail.html }).catch(
      () => null,
    ),
    ctx.hostEmail
      ? sendEmail({ to: ctx.hostEmail, subject: hostMail.subject, html: hostMail.html }).catch(
          () => null,
        )
      : null,
  ]);
}
