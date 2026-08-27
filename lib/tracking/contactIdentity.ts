// Identité locale d'un prospect déjà capturé. Ce module ne crée jamais
// d'identifiant anonyme : il ne manipule que le leadId renvoyé par /api/leads.

export const CONTACT_IDENTIFIED_EVENT = "ff-contact-identified";

export type ContactIdentifiedDetail = {
  funnelSlug: string;
  contactId: string;
};

export function contactStorageKey(funnelSlug: string): string {
  return `ff_contact_${funnelSlug}`;
}

export function readIdentifiedContact(funnelSlug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(contactStorageKey(funnelSlug));
  } catch {
    return null;
  }
}

/**
 * Mémorise le lead identifié et notifie les trackers déjà montés sur la page.
 * L'événement reste utile si localStorage est indisponible : le temps peut alors
 * être suivi pour la page courante, mais ne persistera pas sur la page suivante.
 */
export function persistIdentifiedContact(funnelSlug: string, contactId: string): void {
  if (typeof window === "undefined" || !funnelSlug || !contactId) return;
  try {
    window.localStorage.setItem(contactStorageKey(funnelSlug), contactId);
  } catch {
    // Navigation privée stricte : l'identité reste connue pour cette page via l'événement.
  }

  window.dispatchEvent(
    new CustomEvent<ContactIdentifiedDetail>(CONTACT_IDENTIFIED_EVENT, {
      detail: { funnelSlug, contactId },
    }),
  );
}
