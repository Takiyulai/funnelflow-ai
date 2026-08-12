// lib/booking/presets.ts
//
// 🆕 PRÉRÉGLAGES MÉTIER pour la création d'un type de rendez-vous.
//
// ── LE PROBLÈME QU'ILS RÉSOLVENT ────────────────────────────────────────────
// `createType()` produisait toujours la même chose : « Appel découverte »,
// 30 minutes, rien d'autre. Un audit de 90 minutes et un appel de 15 minutes
// naissaient identiques, et l'hôte devait tout reconfigurer à la main dans
// trois onglets. Le moment où l'outil doit faire gagner du temps était
// précisément celui où il en faisait perdre.
//
// ── CE QUE CE N'EST PAS ─────────────────────────────────────────────────────
// Ce ne sont PAS des « types » au sens fort. Structurellement, un rendez-vous
// est toujours la même chose : une durée, des disponibilités, un lieu, un
// formulaire. Entre un appel découverte et une session de coaching, ce ne sont
// pas les CHAMPS qui changent, ce sont les VALEURS.
//
// Écrire un parcours de création par métier reviendrait à maintenir N fois la
// même structure — donc N endroits à corriger au prochain champ ajouté, et N
// occasions de diverger. Un préréglage n'est qu'un point de départ : après
// création, tout reste modifiable dans les onglets existants.

import type { FormFieldItem } from "@/lib/funnels/types";
import type { BookingMode, LocationKind } from "./types";

export interface BookingPreset {
  id: string;
  /**
   * 🆕 Mode STRUCTUREL du type de rendez-vous.
   *
   * Deux préréglages qui ne partagent pas le même mode ne configurent pas la
   * même chose : ils changent qui fixe la date et combien de personnes tiennent
   * sur un créneau. C'est ce qui justifie un parcours en étapes plutôt qu'un
   * formulaire unique — l'étape « quand ? » dépend réellement de ce choix.
   */
  mode: BookingMode;
  /**
   * Places par créneau. `undefined` → individuel (1).
   * Renseigné uniquement pour les modes collectifs.
   */
  capacity?: number;
  /** Libellé de la carte dans le sélecteur. */
  label: string;
  /** Une phrase : à qui ça sert, pas ce que ça configure. */
  hint: string;
  /** Nom proposé pour le type de RDV (modifiable avant validation). */
  defaultName: string;
  durationMin: number;
  /** Battement APRÈS le rendez-vous. Un audit long en réclame ; un appel court, non. */
  bufferMin: number;
  /** Délai minimum entre maintenant et le créneau réservable, en minutes. */
  minNoticeMin: number;
  /** Profondeur du calendrier ouvert à la réservation, en jours. */
  horizonDays: number;
  /** Granularité des créneaux proposés, en minutes. */
  slotStepMin: number;
  locationKind: LocationKind;
  /**
   * Champs du formulaire de réservation.
   *
   * C'est ici que se joue la vraie différence entre préréglages : un appel de
   * découverte doit être SANS friction (prénom + email), un audit doit
   * qualifier (contexte, budget). Chaque champ facultatif de plus fait baisser
   * le taux de réservation — on ne demande que ce qui change la conversation.
   */
  formFields: FormFieldItem[];
}

/** Prénom + email : le minimum pour confirmer et personnaliser. */
const MINIMAL_FIELDS: FormFieldItem[] = [
  { name: "name", type: "text", label: "Prénom", placeholder: "Votre prénom", required: true, width: "half" },
  { name: "email", type: "email", label: "Email", placeholder: "vous@exemple.com", required: true, width: "half" },
];

export const BOOKING_PRESETS: BookingPreset[] = [
  {
    id: "discovery",
    mode: "consultation",
    label: "Appel découverte",
    hint: "Premier contact court, en tête à tête. Le client choisit son créneau.",
    defaultName: "Appel découverte",
    durationMin: 15,
    bufferMin: 5,
    // 4 h : sans délai, quelqu'un réserve pour dans dix minutes et personne
    // n'est prêt. C'est le réglage le plus souvent oublié.
    minNoticeMin: 240,
    horizonDays: 21,
    slotStepMin: 15,
    locationKind: "visio",
    formFields: MINIMAL_FIELDS,
  },
  {
    id: "coaching",
    mode: "consultation",
    label: "Session de coaching",
    hint: "Séance de travail en tête à tête, avec un client déjà engagé.",
    defaultName: "Session de coaching",
    durationMin: 60,
    bufferMin: 15,
    minNoticeMin: 720,
    horizonDays: 45,
    slotStepMin: 30,
    locationKind: "visio",
    formFields: [
      ...MINIMAL_FIELDS,
      {
        name: "objectif_seance",
        type: "textarea",
        label: "Sur quoi veux-tu travailler ?",
        placeholder: "En une ou deux phrases",
        required: false,
        width: "full",
      },
    ],
  },
  {
    id: "audit",
    mode: "consultation",
    label: "Audit / diagnostic",
    hint: "Séance longue et payante. À qualifier avant d'accepter.",
    defaultName: "Audit stratégique",
    durationMin: 90,
    bufferMin: 15,
    // 24 h : un audit se prépare. Accepter une réservation pour le lendemain
    // matin garantit une séance improvisée.
    minNoticeMin: 1440,
    horizonDays: 60,
    slotStepMin: 30,
    locationKind: "visio",
    formFields: [
      ...MINIMAL_FIELDS,
      {
        name: "activite",
        type: "text",
        label: "Ton activité",
        placeholder: "Coach, agence, e-commerce…",
        required: true,
        width: "full",
      },
      {
        name: "contexte",
        type: "textarea",
        label: "Où en es-tu aujourd'hui ?",
        placeholder: "Ce qui bloque, ce que tu as déjà essayé",
        required: true,
        width: "full",
      },
      {
        name: "budget",
        type: "select",
        label: "Budget envisagé",
        required: false,
        width: "full",
        options: ["Moins de 1 000 €", "1 000 – 5 000 €", "5 000 – 15 000 €", "Plus de 15 000 €"],
      },
    ],
  },
  {
    id: "demo",
    mode: "consultation",
    label: "Démo produit",
    hint: "Présentation individuelle d'un outil ou d'un service.",
    defaultName: "Démo produit",
    durationMin: 30,
    bufferMin: 10,
    minNoticeMin: 240,
    horizonDays: 30,
    slotStepMin: 15,
    locationKind: "visio",
    formFields: [
      ...MINIMAL_FIELDS,
      {
        name: "entreprise",
        type: "text",
        label: "Entreprise",
        placeholder: "Nom de ta structure",
        required: false,
        width: "full",
      },
      {
        name: "taille_equipe",
        type: "select",
        label: "Taille de l'équipe",
        required: false,
        width: "full",
        options: ["Seul(e)", "2 à 5", "6 à 20", "Plus de 20"],
      },
    ],
  },
  {
    id: "consultation",
    mode: "consultation",
    label: "Consultation",
    hint: "Rendez-vous conseil ponctuel, en tête à tête.",
    defaultName: "Consultation",
    durationMin: 45,
    bufferMin: 15,
    minNoticeMin: 720,
    horizonDays: 30,
    slotStepMin: 15,
    locationKind: "visio",
    formFields: [
      ...MINIMAL_FIELDS,
      {
        name: "sujet",
        type: "textarea",
        label: "Ta question principale",
        placeholder: "Ce que tu veux résoudre pendant la séance",
        required: true,
        width: "full",
      },
    ],
  },
  // ── MODES COLLECTIFS ─────────────────────────────────────────────────────
  // Ceux-ci ne sont PAS des variantes de réglages : plusieurs personnes
  // s'inscrivent sur un même créneau, ce que l'index anti-double-réservation
  // interdisait jusqu'à la migration 04.
  {
    id: "workshop",
    mode: "event",
    capacity: 30,
    label: "Atelier / webinaire",
    hint: "TU fixes la date. Plusieurs participants s'inscrivent au même créneau.",
    defaultName: "Atelier en ligne",
    durationMin: 60,
    bufferMin: 0,
    minNoticeMin: 60,
    horizonDays: 90,
    slotStepMin: 30,
    locationKind: "visio",
    formFields: [
      ...MINIMAL_FIELDS,
      {
        name: "attente",
        type: "textarea",
        label: "Qu'espères-tu de cet atelier ?",
        placeholder: "Optionnel, mais ça m'aide à préparer",
        required: false,
        width: "full",
      },
    ],
  },
  {
    id: "classroom",
    mode: "classroom",
    capacity: 12,
    label: "Cours récurrent",
    hint: "Même créneau chaque semaine, plusieurs participants inscrits.",
    defaultName: "Cours hebdomadaire",
    durationMin: 60,
    bufferMin: 0,
    minNoticeMin: 120,
    horizonDays: 60,
    slotStepMin: 30,
    locationKind: "visio",
    formFields: MINIMAL_FIELDS,
  },
  {
    id: "custom",
    mode: "consultation",
    label: "Sur mesure",
    hint: "Pars d'une base neutre et règle tout toi-même.",
    defaultName: "Rendez-vous",
    durationMin: 30,
    bufferMin: 0,
    minNoticeMin: 240,
    horizonDays: 30,
    slotStepMin: 15,
    locationKind: "visio",
    formFields: MINIMAL_FIELDS,
  },
];

export function getBookingPreset(id: string | null | undefined): BookingPreset {
  // Repli sur « sur mesure » : un identifiant inconnu (lien ancien, faute de
  // frappe) ne doit pas empêcher la création.
  return (
    BOOKING_PRESETS.find((p) => p.id === id) ??
    BOOKING_PRESETS[BOOKING_PRESETS.length - 1]
  );
}
