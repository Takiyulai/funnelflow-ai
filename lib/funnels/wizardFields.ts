// lib/funnels/wizardFields.ts
//
// Quels blocs du wizard afficher selon le type de tunnel.
//
// ── POURQUOI UNE TABLE PLUTÔT QU'UNE CONDITION EN LIGNE ────────────────────
// Le bloc « Offre » était conditionné par `funnelKind !== "webinar"`, une
// exception unique écrite en dur. Un tunnel de PRISE DE RENDEZ-VOUS se voyait
// donc réclamer un prix, un prix barré, un upsell, un downsell, un order bump
// et un lien de paiement — six champs qui n'ont aucun sens quand ce qu'on
// « vend » est un créneau de calendrier.
//
// Une table nommée rend la règle lisible et évite qu'une prochaine exception
// devienne un second `&& funnelKind !== "..."` illisible.

import type { FunnelKind } from "@/lib/funnels/types";

/**
 * Types de tunnel qui NE demandent PAS le bloc commercial
 * (prix, prix barré, upsell, downsell, order bump, lien de paiement, OTO).
 *
 * Liste d'EXCLUSION délibérée : tout type non listé garde exactement le
 * comportement actuel. Ajouter un type ici est un choix explicite ; en oublier
 * un ne casse rien.
 */
const KINDS_WITHOUT_PRICING_BLOCK: FunnelKind[] = [
  // Le webinaire décrit son ÉVÉNEMENT (souvent gratuit) ; ce qui se vend est
  // saisi à part, dans les champs post-webinaire. Exclusion historique.
  "webinar",
  // 🆕 La conversion d'un tunnel de RDV est une réservation, pas un achat.
  "booking",
];

/** Le bloc « Offre » (prix, upsell, downsell, order bump, paiement) s'applique-t-il ? */
export function showsPricingBlock(kind: FunnelKind | undefined): boolean {
  if (!kind) return true;
  return !KINDS_WITHOUT_PRICING_BLOCK.includes(kind);
}

/**
 * La page OTO / tripwire est-elle proposée dans l'aperçu des pages générées ?
 * Elle suppose une offre payante à greffer : sans bloc commercial, elle n'a
 * rien à vendre.
 */
export function showsOtoOption(kind: FunnelKind | undefined): boolean {
  return showsPricingBlock(kind);
}

/**
 * Champs du brief à NETTOYER quand on bascule vers un type qui ne les affiche
 * plus.
 *
 * ⚠️ Indispensable : un utilisateur qui saisit un prix puis change d'avis pour
 * « prise de rendez-vous » ne voit plus le champ, mais sa valeur reste dans le
 * brief et continue d'alimenter la génération — page de commande fantôme, prix
 * collé sur un CTA de réservation. Le masquage sans nettoyage déplace le bug
 * au lieu de le corriger.
 */
export const PRICING_BLOCK_FIELDS = [
  "anchorPrice",
  "upsellOffer",
  "upsellPrice",
  "downsellOffer",
  "downsellPrice",
  "orderBumpName",
  "orderBumpPrice",
  "orderBumpDescription",
  "paymentUrl",
  "otoOfferName",
  "otoPrice",
  "otoPromise",
] as const;
