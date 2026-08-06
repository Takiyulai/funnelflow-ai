// lib/booking/mode.ts
//
// Mode de réservation d'un tunnel « booking ». Module PUR : aucun import
// serveur, aucun accès base — il est lu aussi bien par le générateur (serveur)
// que par le wizard (client).
//
// ── DEUX MONDES QUI DOIVENT COEXISTER ──────────────────────────────────────
// NATIF   : le moteur de RDV d'AutoFunnel (/rdv/{slug}). Créneaux, fuseaux,
//           anti-double-réservation, e-mails et .ics gérés maison.
// EXTERNE : un calendrier tiers (Calendly, Cal.com, TidyCal, n'importe quelle
//           URL). Indispensable pour qui exporte son tunnel vers Systeme.io ou
//           une autre plateforme, où le moteur natif est hors d'atteinte.
//
// En mode EXTERNE, aucune écriture dans `booking_event_types`, aucune
// dépendance à `funnel_id`, et le CTA porte une URL ABSOLUE qui survit à
// l'export. C'est la condition pour que le tunnel reste fonctionnel hors
// d'AutoFunnel.

export type BookingMode = "native" | "external";

export type BookingModeInput = {
  bookingMode?: BookingMode;
  /** URL du calendrier tiers (Calendly, Cal.com…). */
  calendarEmbedUrl?: string;
};

/**
 * Mode effectif d'un brief.
 *
 * ⚠️ RÉTROCOMPATIBILITÉ. Avant l'introduction de `bookingMode`, renseigner un
 * lien de calendrier SIGNIFIAIT à lui seul « je veux un calendrier externe ».
 * Sans le repli ci-dessous, tous les tunnels déjà créés avec Calendly
 * basculeraient silencieusement sur le moteur natif au prochain passage — leurs
 * CTA pointeraient vers un /rdv/{slug} qui n'existe pas chez eux.
 */
export function resolveBookingMode(input: BookingModeInput | undefined): BookingMode {
  if (input?.bookingMode === "external") return "external";
  if (input?.bookingMode === "native") return "native";
  return externalCalendarUrl(input) ? "external" : "native";
}

/**
 * URL externe exploitable, ou null.
 *
 * Le wizard utilise une chaîne blanche comme sentinelle « mode externe choisi,
 * lien pas encore collé » : on la traite donc comme absente plutôt que comme
 * une URL vide, qui produirait un CTA vers nulle part.
 */
export function externalCalendarUrl(input: BookingModeInput | undefined): string | null {
  const raw = (input?.calendarEmbedUrl ?? "").trim();
  return raw.length > 0 ? raw : null;
}

/**
 * Mode externe choisi, mais aucune URL exploitable saisie.
 *
 * ── POURQUOI CE CAS MÉRITE UNE VALIDATION DÉDIÉE ───────────────────────────
 * Sans URL, il n'existe aucune destination de réservation : le garde
 * anti-ancre-morte retire alors les CTA de la page d'accueil — comportement
 * volontaire, mais le résultat est un tunnel de prise de rendez-vous SANS
 * bouton. L'utilisateur ne comprendrait pas d'où vient le problème.
 *
 * Exposé ici plutôt que recopié dans le wizard, pour que la règle « URL
 * manquante » reste strictement la même que celle du générateur.
 */
export function bookingExternalUrlMissing(
  input: (BookingModeInput & { funnelKind?: string }) | undefined,
): boolean {
  if (input?.funnelKind !== "booking") return false;
  if (resolveBookingMode(input) !== "external") return false;
  return externalCalendarUrl(input) === null;
}

/**
 * L'URL saisie porte-t-elle un schéma absolu ?
 *
 * ⚠️ Sans `http://` ou `https://`, le navigateur interprète la valeur comme un
 * chemin RELATIF : « calendly.com/moi » devient « /tunnel/xxx/calendly.com/moi »
 * et mène à un 404. C'est le même mode d'échec silencieux que le CTA inerte.
 *
 * Volontairement traité en AVERTISSEMENT et non en blocage : la validation de
 * forme d'URL est notoirement piégeuse (domaines internes, ports, IDN), et
 * refuser une saisie légitime serait pire que d'afficher un rappel visible.
 */
export function isAbsoluteHttpUrl(raw: string | null | undefined): boolean {
  return /^https?:\/\//i.test((raw ?? "").trim());
}

/**
 * Le moteur natif doit-il être sollicité pour ce brief ?
 * Sert de garde unique côté serveur : un `false` ici signifie « ne crée aucun
 * type de RDV, n'écris rien, ne résous aucun funnel_id ».
 */
export function usesNativeBookingEngine(
  input: (BookingModeInput & { funnelKind?: string }) | undefined,
): boolean {
  if (input?.funnelKind !== "booking") return false;
  return resolveBookingMode(input) === "native";
}
