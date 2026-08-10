// lib/funnels/challenge.ts
//
// Bornes et défaut de la durée d'un challenge — en UN SEUL endroit.
//
// ── POURQUOI UN MODULE DÉDIÉ ────────────────────────────────────────────────
// Ces valeurs vivaient en triple exemplaire, et divergeaient :
//   • `MAX_CHALLENGE_DAYS = 14` dans le composant client FunnelKindStep ;
//   • `z.number().int().min(1).max(30)` dans le schéma zod de la route API ;
//   • deux littéraux `Math.max(1, Math.min(14, … ?? 5))` dans le générateur.
//
// Conséquences observées :
//   • une requête à 20 jours passait la validation (max 30) puis était tronquée
//     en silence à 14 par le générateur ;
//   • `challengeDays` absent (parcours Express, ou champ jamais affiché) →
//     le prompt n'annonçait AUCUNE durée alors que le générateur produisait
//     quand même 5 pages « Jour N ». Le copywriting mentait sur le produit.
//
// Ce module est PUR : aucun import React, aucun import serveur, aucune
// dépendance. Il peut donc être importé indifféremment depuis un composant
// client, depuis une route API et depuis le générateur sans tirer de
// dépendance parasite dans l'un ou l'autre bundle.

/** Durée minimale d'un challenge, en jours. */
export const MIN_CHALLENGE_DAYS = 1;

/**
 * Durée maximale, en jours.
 *
 * Ramenée de 30 à 14 : au-delà, le tunnel dépasse 16 pages — lourd à générer
 * comme à éditer, pour un format de challenge qui n'existe pas dans la
 * pratique.
 */
export const MAX_CHALLENGE_DAYS = 14;

/**
 * Durée retenue quand l'utilisateur n'a jamais renseigné le champ (parcours
 * Express IA, ou type choisi sans passer par les champs de l'étape Format).
 *
 * ⚠️ Cette valeur est AUTORITAIRE : le générateur produit ce nombre de pages
 * « Jour N » ET le prompt annonce cette même durée dans le copywriting. Les
 * deux DOIVENT passer par `resolveChallengeDays`, jamais par un littéral —
 * sinon la landing et le tunnel réel se remettent à diverger.
 */
export const DEFAULT_CHALLENGE_DAYS = 5;

/**
 * Normalise une durée de challenge.
 *
 * - absente / non finie (undefined, null, NaN) → `DEFAULT_CHALLENGE_DAYS` ;
 * - décimale → arrondie ;
 * - hors bornes → ramenée dans [`MIN_CHALLENGE_DAYS`, `MAX_CHALLENGE_DAYS`].
 *
 * Le clamp reste une CEINTURE : la validation zod de la route rejette déjà
 * les durées hors bornes. Il couvre les appels internes et les briefs
 * antérieurs à cette validation.
 */
export function resolveChallengeDays(days?: number | null): number {
  if (typeof days !== "number" || !Number.isFinite(days)) {
    return DEFAULT_CHALLENGE_DAYS;
  }
  return Math.max(
    MIN_CHALLENGE_DAYS,
    Math.min(MAX_CHALLENGE_DAYS, Math.round(days)),
  );
}
