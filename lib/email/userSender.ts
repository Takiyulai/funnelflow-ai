// lib/email/userSender.ts
//
// 🆕 ÉTAPE 3 — Résolution de l'expéditeur des emails MARKETING d'un utilisateur
// (newsletters + séquences), stratégie hybride (Option C) :
//   • Domaine perso VÉRIFIÉ (premium, UI plus tard) → on envoie depuis SON adresse.
//   • Sinon (défaut) → domaine FunnelFlow partagé, nom « <Nom> via FunnelFlow »,
//     reply-to = email réel du créateur.
//
// Fonction UNIQUE utilisée partout où on envoie un email marketing (campagnes,
// cron, envoi manuel de séquence). Aucune adresse en dur : tout vient de l'env
// (cf. lib/email/sender.ts) ou du profil utilisateur. Utilise le client ADMIN
// pour fonctionner aussi hors session (cron).

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  type Sender,
  defaultFromName,
  defaultFromEmail,
  composeFrom,
} from "@/lib/email/sender";

/**
 * Résout l'expéditeur marketing d'un utilisateur. Retourne { from, replyTo }.
 * Le reply-to pointe vers l'email réel du créateur (cas domaine partagé) pour
 * que les réponses lui parviennent.
 */
export async function getUserMarketingSender(userId: string): Promise<Sender> {
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("marketing_sender_name, custom_email_from, custom_email_status")
    .eq("user_id", userId)
    .maybeSingle();

  // Email réel du compte (reply-to). Lecture via service role.
  let accountEmail: string | undefined;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    accountEmail = data.user?.email ?? undefined;
  } catch {
    /* ignore : on enverra sans reply-to si indisponible */
  }

  const senderName =
    (profile?.marketing_sender_name as string | null)?.trim() || "";

  // Cas PREMIUM : domaine perso vérifié → expéditeur sur son propre domaine.
  if (
    profile?.custom_email_status === "verified" &&
    typeof profile?.custom_email_from === "string" &&
    profile.custom_email_from.trim()
  ) {
    return {
      from: composeFrom(senderName || defaultFromName(), profile.custom_email_from.trim()),
      ...(accountEmail ? { replyTo: accountEmail } : {}),
    };
  }

  // Cas par DÉFAUT (Option C) : domaine FunnelFlow partagé.
  const displayName = senderName ? `${senderName} via FunnelFlow` : defaultFromName();
  return {
    from: composeFrom(displayName, defaultFromEmail()),
    ...(accountEmail ? { replyTo: accountEmail } : {}),
  };
}
