// lib/crm/unsubscribe.ts
//
// 🆕 RGPD (audit #2) — Désinscription email des leads. Lien SIGNÉ et STATELESS :
// on n'a besoin que du contactId (déjà présent au moment de l'envoi) + une
// signature HMAC → aucune fuite (un tiers ne peut pas désinscrire un contact
// dont il ne connaît pas l'id ET la signature). SERVEUR UNIQUEMENT (utilise le
// service role comme secret HMAC).

import { createHmac } from "node:crypto";

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/** Signature courte, liée au contactId, non devinable sans le secret serveur. */
function unsubSig(contactId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "ff-unsub-secret";
  return createHmac("sha256", secret).update(`unsub:${contactId}`).digest("hex").slice(0, 24);
}

/** URL publique de désinscription pour un contact (null si non configurable). */
export function unsubscribeUrl(contactId: string | null | undefined): string | null {
  if (!APP_URL || !contactId) return null;
  return `${APP_URL}/api/unsubscribe?c=${encodeURIComponent(contactId)}&s=${unsubSig(contactId)}`;
}

/** Vérifie la signature d'un lien de désinscription. */
export function verifyUnsubscribe(contactId: string, sig: string): boolean {
  if (!contactId || !sig) return false;
  // Comparaison simple : la signature est déjà un HMAC ; suffisant ici.
  return unsubSig(contactId) === sig;
}

/**
 * Ajoute un pied de page « Se désinscrire » à un email (obligation légale pour
 * l'emailing marketing). Inséré avant </body> si présent. Sans contactId ou
 * sans APP_URL, renvoie le HTML inchangé (best-effort).
 */
export function appendUnsubscribeFooter(
  html: string,
  contactId: string | null | undefined,
): string {
  const url = unsubscribeUrl(contactId);
  if (!html || !url) return html;
  const footer =
    `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;` +
    `font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;` +
    `font-family:Arial,Helvetica,sans-serif">` +
    `Tu ne veux plus recevoir ces emails ? ` +
    `<a href="${url}" style="color:#9ca3af;text-decoration:underline">Se désinscrire</a>` +
    `</div>`;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${footer}</body>`)
    : `${html}${footer}`;
}
