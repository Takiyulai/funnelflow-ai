// lib/crm/emailTracking.ts
// 🆕 LOT 2 — Réécrit les liens http(s) d'un email pour passer par le proxy de
// tracking `/api/track/click` avant redirection, afin d'alimenter le
// déclencheur Workflow `email.link_clicked`. Appelé juste avant l'envoi
// (cron d'envoi programmé) — le contenu stocké en base (scheduled_emails,
// aperçu, envoi test) reste inchangé.

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/**
 * Réécrit `href="https://..."` en `href="{APP_URL}/api/track/click?u=...&c=...&uid=..."`.
 * Ignore les liens non http(s) (mailto:, tel:, ancres). Ne fait rien si
 * `NEXT_PUBLIC_SITE_URL` n'est pas configuré (évite de générer des liens cassés).
 */
export function wrapEmailLinksForTracking(
  html: string,
  opts: { userId: string; contactId: string },
): string {
  if (!html || !APP_URL || !opts.userId || !opts.contactId) return html;
  return html.replace(
    /(<a\b[^>]*\bhref\s*=\s*")([^"]+)(")/gi,
    (match, pre: string, href: string, post: string) => {
      const url = href.trim();
      if (!/^https?:\/\//i.test(url)) return match;
      const tracked =
        `${APP_URL}/api/track/click?u=${encodeURIComponent(url)}` +
        `&c=${encodeURIComponent(opts.contactId)}&uid=${encodeURIComponent(opts.userId)}`;
      return `${pre}${tracked}${post}`;
    },
  );
}
