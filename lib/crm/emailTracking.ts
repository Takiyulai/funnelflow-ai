// lib/crm/emailTracking.ts
// LOT 2 — Réécrit les liens http(s) d'un email pour passer par le proxy de
// tracking `/api/track/click` avant redirection (déclencheur Workflow
// `email.link_clicked`).
// 🆕 VAGUE 1 / LOT 3 — Les mêmes paramètres alimentent désormais les
// STATISTIQUES email (table email_events) : `messageId` (ligne d'envoi),
// `sourceType`, `campaignId`, `sequenceId`. S'y ajoute le pixel d'ouverture
// (`appendOpenTrackingPixel` → /api/track/open).
// Appelé juste avant l'envoi (cron + campagne immédiate) — le contenu stocké
// en base (scheduled_emails, aperçu, envoi test) reste inchangé.

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

export type EmailTrackingParams = {
  userId: string;
  contactId?: string | null;
  /** Ligne d'envoi : scheduled_emails.id (cron) ou crm_email_sends.id (immédiat). */
  messageId?: string | null;
  /** 'newsletter' | 'sequence' | 'workflow' | 'delivery' */
  sourceType?: string | null;
  campaignId?: string | null;
  sequenceId?: string | null;
};

function trackingQuery(opts: EmailTrackingParams): string {
  const q = new URLSearchParams();
  q.set("uid", opts.userId);
  if (opts.contactId) q.set("c", opts.contactId);
  if (opts.messageId) q.set("m", opts.messageId);
  if (opts.sourceType) q.set("t", opts.sourceType);
  if (opts.campaignId) q.set("g", opts.campaignId);
  if (opts.sequenceId) q.set("s", opts.sequenceId);
  return q.toString();
}

/**
 * Réécrit `href="https://..."` en `href="{APP_URL}/api/track/click?u=...&...".
 * Ignore les liens non http(s) (mailto:, tel:, ancres). Ne fait rien si
 * `NEXT_PUBLIC_SITE_URL` n'est pas configuré (évite de générer des liens cassés).
 */
export function wrapEmailLinksForTracking(
  html: string,
  opts: EmailTrackingParams,
): string {
  if (!html || !APP_URL || !opts.userId) return html;
  const extra = trackingQuery(opts);
  return html.replace(
    /(<a\b[^>]*\bhref\s*=\s*")([^"]+)(")/gi,
    (match, pre: string, href: string, post: string) => {
      const url = href.trim();
      if (!/^https?:\/\//i.test(url)) return match;
      const tracked =
        `${APP_URL}/api/track/click?u=${encodeURIComponent(url)}&${extra}`;
      return `${pre}${tracked}${post}`;
    },
  );
}

/**
 * 🆕 LOT 3 — Ajoute le pixel d'ouverture (1×1 transparent) en fin d'email.
 * Nécessite `messageId` (sans lui, aucun taux d'ouverture fiable n'est
 * calculable) ; sinon le HTML est renvoyé tel quel.
 */
export function appendOpenTrackingPixel(
  html: string,
  opts: EmailTrackingParams,
): string {
  if (!html || !APP_URL || !opts.userId || !opts.messageId) return html;
  const pixel =
    `<img src="${APP_URL}/api/track/open?${trackingQuery(opts)}" ` +
    `width="1" height="1" style="display:none;max-width:1px;max-height:1px;border:0;" alt="" />`;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${pixel}</body>`)
    : `${html}${pixel}`;
}
