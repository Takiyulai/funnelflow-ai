// lib/booking/types.ts
// Types partagés du module « Calendrier de RDV natif ».

import type { TimeZoneId } from "./timezones";
// Le module RDV réutilise le type de champ de formulaire du reste de
// l'application : un seul modèle de champ, donc un seul éditeur (PopupFieldsEditor).
import type { FormFieldItem } from "@/lib/funnels/types";

export type LocationKind = "visio" | "phone" | "in_person" | "custom";
export type BookingStatus = "confirmed" | "cancelled" | "no_show" | "completed";

/** Un type de rendez-vous proposé par l'hôte (« Appel découverte 30 min »). */
export type BookingEventType = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string | null;

  durationMin: number;
  /** Battement APRÈS le RDV. N'apparaît pas dans le .ics du visiteur. */
  bufferMin: number;
  /** Délai minimum entre maintenant et le créneau réservable. */
  minNoticeMin: number;
  horizonDays: number;
  slotStepMin: number;

  /** Fuseau IANA de l'hôte — référence des règles de disponibilité. */
  timezone: TimeZoneId;

  locationKind: LocationKind;
  locationValue?: string | null;

  color?: string | null;

  // 🆕 Fiche hôte, rattachée au TYPE de rendez-vous et non au compte : un même
  // utilisateur peut proposer « Appel découverte avec Dramane » et « Coaching
  // avec Awa ». Tous les champs sont optionnels ; `hostName` conditionne
  // l'affichage du bloc sur la page publique.
  hostName?: string | null;
  hostTitle?: string | null;
  hostAvatarUrl?: string | null;
  hostBio?: string | null;

  /**
   * 🆕 Champs du formulaire de réservation, définis par l'hôte.
   *
   * Le formulaire public était figé : prénom, email, téléphone, note. Un
   * coach qui a besoin du budget, du niveau ou du lien LinkedIn devait le
   * demander après coup, par email — c'est-à-dire perdre la moitié des
   * réponses.
   *
   * Absent ou vide → champs par défaut (voir DEFAULT_BOOKING_FIELDS). Le
   * comportement des types de RDV existants est donc inchangé.
   *
   * ⚠️ Un champ de type "email" reste OBLIGATOIRE dans la liste : sans
   * adresse, ni la confirmation ni le fichier agenda ne peuvent partir.
   */
  formFields?: FormFieldItem[] | null;

  language: string;
  active: boolean;
  funnelId?: string | null;
};

/**
 * 🆕 Champs demandés quand l'hôte n'a rien personnalisé. Reproduit à
 * l'identique le formulaire historique, pour que rien ne change sur les types
 * de rendez-vous déjà créés.
 */
export const DEFAULT_BOOKING_FIELDS: FormFieldItem[] = [
  // Strictement le minimum : un prénom pour personnaliser, une adresse pour
  // confirmer. Téléphone et message ont été RETIRÉS des valeurs par défaut —
  // chaque champ facultatif de plus fait baisser le taux de réservation, et
  // celui qui en a besoin l'ajoute en deux clics.
  { name: "name", type: "text", label: "Prénom", placeholder: "Votre prénom", required: true, width: "half" },
  { name: "email", type: "email", label: "Email", placeholder: "vous@exemple.com", required: true, width: "half" },
];

/**
 * Plage récurrente hebdomadaire, en HEURES LOCALES DE L'HÔTE.
 * `weekday` : 0 = dimanche … 6 = samedi (aligné sur Date#getUTCDay).
 */
export type AvailabilityRule = {
  id?: string;
  weekday: number;
  /** Minutes depuis minuit, heure locale de l'hôte. */
  startMin: number;
  endMin: number;
};

/**
 * Exception sur une date civile de l'hôte.
 * - `closed` : journée entièrement fermée.
 * - `window` : remplace les règles hebdo du jour par cette seule plage.
 */
export type AvailabilityException = {
  id?: string;
  /** "YYYY-MM-DD", jour civil dans le fuseau de l'hôte. */
  day: string;
  kind: "closed" | "window";
  startMin?: number | null;
  endMin?: number | null;
  note?: string | null;
};

/** Réservation existante, réduite à ce dont le moteur de créneaux a besoin. */
export type BusyInterval = {
  /** Instants absolus (ISO UTC). */
  startsAt: string;
  endsAt: string;
};

/** Créneau proposé au visiteur. */
export type Slot = {
  /** Instant absolu de début, ISO UTC — la seule vérité. */
  startsAt: string;
  endsAt: string;
};

/** Créneaux d'une journée civile (celle du VISITEUR, pas de l'hôte). */
export type DaySlots = {
  /** "YYYY-MM-DD" dans le fuseau du visiteur. */
  day: string;
  slots: Slot[];
};

export type BookingRecord = {
  id: string;
  eventTypeId: string;
  startsAt: string;
  endsAt: string;
  visitorTimezone: TimeZoneId;
  hostTimezone: TimeZoneId;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string | null;
  note?: string | null;
  /**
   * 🆕 Réponses aux champs personnalisés, indexées par `name` de champ.
   * Ne contient QUE les champs hors nom/email/téléphone/note, qui ont déjà
   * leurs colonnes dédiées — pas de donnée en double.
   */
  answers?: Record<string, string | boolean> | null;
  status: BookingStatus;
  manageToken: string;
};
