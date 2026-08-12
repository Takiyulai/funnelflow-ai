// lib/booking/formFields.ts
//
// 🆕 Champs du formulaire de réservation : résolution, classification et
// validation. Module PUR — partagé par le widget public (rendu) et par la
// route de réservation (contrôle serveur).
//
// ── POURQUOI UN SEUL MODULE ─────────────────────────────────────────────────
// Le formulaire est rendu côté client et validé côté serveur. Deux
// implémentations divergeraient : un champ marqué requis à l'écran mais
// facultatif à l'insertion, ou l'inverse. Les deux appellent donc les mêmes
// fonctions.
//
// ⚠️ La validation client est un CONFORT, jamais une garantie : un POST direct
// ignore le navigateur. `validateBookingAnswers` est la seule barrière qui
// compte, et elle s'exécute sur le serveur.

import type { FormFieldItem } from "@/lib/funnels/types";
import { DEFAULT_BOOKING_FIELDS, type BookingEventType } from "./types";

/**
 * Noms réservés : ces champs ont leur propre colonne en base et alimentent les
 * emails, le fichier .ics et l'export. Ils ne sont jamais rangés dans
 * `answers`, sous peine de stocker la même donnée à deux endroits — et de les
 * voir diverger à la première correction.
 */
export const RESERVED_FIELD_NAMES = new Set(["name", "email", "phone", "note"]);

/** Champs effectivement demandés pour ce type de rendez-vous. */
export function resolveBookingFields(
  eventType: Pick<BookingEventType, "formFields">,
): FormFieldItem[] {
  const custom = eventType.formFields;
  if (!Array.isArray(custom) || custom.length === 0) {
    return DEFAULT_BOOKING_FIELDS;
  }
  // Un champ sans nom est inexploitable : il écraserait la clé "" dans les
  // réponses. On l'écarte plutôt que de faire échouer tout le formulaire.
  return custom.filter((f) => typeof f?.name === "string" && f.name.trim());
}

/**
 * Garantit qu'un champ email est présent.
 *
 * Sans adresse, ni la confirmation ni le fichier agenda ne peuvent partir, et
 * le participant n'a aucun moyen d'annuler. L'hôte peut tout personnaliser,
 * sauf supprimer ce point d'ancrage.
 */
export function ensureEmailField(fields: FormFieldItem[]): FormFieldItem[] {
  const hasEmail = fields.some(
    (f) => f.type === "email" || f.name.toLowerCase().includes("email"),
  );
  if (hasEmail) return fields;
  const fallback = DEFAULT_BOOKING_FIELDS.find((f) => f.type === "email");
  return fallback ? [...fields, { ...fallback }] : fields;
}

/** Rôle d'un champ : colonne dédiée, ou réponse libre. */
export function classifyBookingField(
  field: FormFieldItem,
): "name" | "email" | "phone" | "note" | "custom" {
  const type = (field.type || "").toLowerCase();
  const name = (field.name || "").toLowerCase();
  if (type === "email" || name.includes("email") || name.includes("mail")) return "email";
  if (type === "tel" || name.includes("phone") || name.includes("tel")) return "phone";
  if (name === "name" || name.includes("nom") || name.includes("prenom")) return "name";
  if (name === "note" || name.includes("message") || name.includes("demande")) return "note";
  return "custom";
}

export type BookingFormValues = Record<string, string | boolean | undefined>;

export interface BookingFieldsValidation {
  ok: boolean;
  /** Libellés des champs requis laissés vides. */
  missing: string[];
  /** Colonnes dédiées, extraites des valeurs soumises. */
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string | null;
  note: string | null;
  /** Tout le reste, prêt pour la colonne `answers`. */
  answers: Record<string, string | boolean>;
}

/**
 * Valide les valeurs soumises et les répartit entre colonnes dédiées et
 * réponses libres.
 *
 * `fields` doit venir de `resolveBookingFields(eventType)` : la validation
 * s'appuie sur la définition ENREGISTRÉE, jamais sur une liste de champs
 * envoyée par le client — sinon il suffirait de retirer `required` dans la
 * requête pour contourner l'obligation.
 */
export function validateBookingAnswers(
  fields: FormFieldItem[],
  values: BookingFormValues,
): BookingFieldsValidation {
  const missing: string[] = [];
  const answers: Record<string, string | boolean> = {};

  let visitorName = "";
  let visitorEmail = "";
  let visitorPhone: string | null = null;
  let note: string | null = null;

  for (const field of fields) {
    const raw = values[field.name];
    const isCheckbox = field.type === "checkbox";
    const value = isCheckbox
      ? raw === true || raw === "true" || raw === "on"
      : typeof raw === "string"
        ? raw.trim()
        : "";

    const empty = isCheckbox ? value === false : value === "";
    if (field.required && empty) {
      missing.push(field.label || field.name);
      continue;
    }
    if (empty) continue;

    switch (classifyBookingField(field)) {
      case "name":
        visitorName = String(value);
        break;
      case "email":
        visitorEmail = String(value);
        break;
      case "phone":
        visitorPhone = String(value);
        break;
      case "note":
        note = String(value);
        break;
      default:
        answers[field.name] = value;
    }
  }

  // L'email reste indispensable même si l'hôte a retiré l'obligation : c'est
  // la seule adresse de confirmation et d'annulation.
  if (!visitorEmail) missing.push("Email");

  return {
    ok: missing.length === 0,
    missing,
    // Un nom vide est toléré : certains hôtes ne demandent que l'email. On
    // retombe sur la partie locale de l'adresse plutôt que d'afficher « undefined »
    // dans la confirmation et le .ics.
    visitorName: visitorName || visitorEmail.split("@")[0] || "Participant",
    visitorEmail,
    visitorPhone,
    note,
    answers,
  };
}
