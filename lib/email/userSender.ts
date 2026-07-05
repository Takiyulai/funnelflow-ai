// lib/email/userSender.ts
//
// 🆕 ÉTAPE 3 — Résolution de l'expéditeur des emails MARKETING d'un utilisateur
// (newsletters + séquences), stratégie hybride (Option C) :
//   • Domaine perso VÉRIFIÉ (premium, UI plus tard) → on envoie depuis SON adresse.
//   • Sinon (défaut) → domaine AutoFunnel partagé, nom « <Nom> via AutoFunnel »,
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

  // Cas par DÉFAUT : domaine AutoFunnel partagé, nom du créateur SEUL.
  // 🆕 Suffixe « via AutoFunnel » retiré (décision produit) : le lead voit le
  // nom du business/créateur, pas la plateforme.
  const displayName = senderName || defaultFromName();
  return {
    from: composeFrom(displayName, defaultFromEmail()),
    ...(accountEmail ? { replyTo: accountEmail } : {}),
  };
}

/**
 * 🆕 Expéditeur marketing lié à UN TUNNEL : priorité au nom du business du
 * tunnel (`published_content.meta.businessName`, figé à la publication).
 * FROM = "<Business> <noreply@autofunnelai.cloud>" (sans « via AutoFunnel »),
 * reply-to = email du créateur. Fallback complet sur getUserMarketingSender
 * (nom marketing du profil / domaine perso vérifié) si le tunnel n'a pas de
 * businessName ou n'est pas trouvé.
 */
export async function getFunnelMarketingSender(
  userId: string,
  funnelId?: string | null,
): Promise<Sender> {
  const base = await getUserMarketingSender(userId);

  // Domaine perso vérifié → la préférence premium du profil reste prioritaire.
  if (!funnelId) return base;

  try {
    const admin = getSupabaseAdmin();
    const { data: funnelRow } = await admin
      .from("funnels")
      .select("published_content")
      .eq("id", funnelId)
      .maybeSingle();

    const meta = (funnelRow?.published_content as { meta?: { businessName?: string } } | null)
      ?.meta;
    const businessName = meta?.businessName?.trim();
    if (!businessName) return base;

    // Si l'utilisateur a un domaine perso vérifié, on garde SON adresse mais
    // avec le nom du business du tunnel.
    const emailPart = base.from.match(/<\s*([^>]+)\s*>/)?.[1] ?? defaultFromEmail();
    return {
      from: composeFrom(businessName, emailPart),
      ...(base.replyTo ? { replyTo: base.replyTo } : {}),
    };
  } catch {
    return base;
  }
}
