// lib/crm/goals.ts
// 🆕 CONDITIONS DE SORTIE (« goals ») — arrêt des relances quand le contact
// a converti.
//
// LE PROBLÈME QUE ÇA RÉSOUT
// Une séquence de relance en 5 emails partait jusqu'au bout, même si le contact
// achetait au 2ᵉ : il recevait ensuite 3 emails lui demandant d'acheter ce
// qu'il venait de payer. Le seul filtre existant côté file d'envoi ne couvrait
// que les désinscrits (RGPD) — rien n'arrêtait une relance devenue sans objet.
// C'est le genre de détail qui abîme la confiance dans l'outil en une seule
// campagne.
//
// COMMENT
// Les emails déjà programmés vivent dans `scheduled_emails` avec le statut
// `pending`. Il suffit de les basculer en `canceled` — statut DÉJÀ prévu par la
// contrainte SQL (`scheduled-emails-sending-status.sql`) mais jamais utilisé
// jusqu'ici. Aucune migration n'est donc nécessaire.
//
// DEUX GARDE-FOUS IMPORTANTS
//  1. On n'annule QUE le marketing (séquences, workflows, campagnes). Les
//     emails `source_type='delivery'` — livraison de ressource, accès produit —
//     sont transactionnels : les annuler priverait le client de ce qu'il vient
//     d'acheter.
//  2. On n'annule QUE les `pending`. Une ligne déjà en `sending` est en cours
//     de traitement par le cron : y toucher rouvrirait la fenêtre de double
//     envoi que le claim atomique referme.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Motif d'annulation, journalisé dans la colonne `error` pour l'audit. */
export type GoalReason = "purchase_completed" | "manual" | "status_client";

export type CancelResult = {
  canceled: number;
  error: string | null;
};

/**
 * Annule les emails MARKETING encore en attente pour un contact.
 *
 * ⚠️ ORDRE D'APPEL. À invoquer AVANT de déclencher les workflows
 * `purchase.completed`. Dans l'autre sens, une séquence d'accueil post-achat
 * inscrite par ces mêmes workflows serait annulée dans la foulée.
 *
 * Best-effort : ne lève jamais. Un échec d'annulation ne doit pas faire échouer
 * la promotion d'un contact en client — mieux vaut un email de trop qu'un
 * paiement non enregistré.
 */
export async function cancelPendingMarketingEmails(
  admin: SupabaseClient,
  params: { userId: string; contactId: string; reason: GoalReason },
): Promise<CancelResult> {
  const { userId, contactId, reason } = params;
  if (!contactId) return { canceled: 0, error: null };

  try {
    const { data, error } = await admin
      .from("scheduled_emails")
      .update({
        status: "canceled",
        error: `goal:${reason}`,
      })
      .eq("user_id", userId)
      .eq("contact_id", contactId)
      // Uniquement ce qui n'est pas encore parti ni en cours de traitement.
      .eq("status", "pending")
      // Le transactionnel n'est jamais annulé (livraison, accès produit).
      .neq("source_type", "delivery")
      .select("id");

    if (error) {
      console.warn("[goals] annulation des relances échouée :", error.message);
      return { canceled: 0, error: error.message };
    }

    const count = (data ?? []).length;
    if (count > 0) {
      console.log(
        `[goals] ${count} email(s) de relance annulé(s) pour le contact ${contactId} (motif : ${reason}).`,
      );
    }
    return { canceled: count, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    console.warn("[goals] annulation des relances échouée :", message);
    return { canceled: 0, error: message };
  }
}
