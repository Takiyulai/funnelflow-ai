// lib/crm/emailStats.ts
// 🆕 Statistiques email AGRÉGÉES d'un utilisateur, calculées à la volée depuis
// les tables CRM (aucune donnée dupliquée / à re-synchroniser). Utilisées par
// le bandeau en haut de l'onglet Emails ET par la carte KPI du Dashboard.
//
//  - Campagnes : total, actives (programmées + en cours d'envoi), envoyées.
//  - Emails envoyés : lignes "sent" de DEUX tables — crm_email_sends
//    (campagnes envoyées immédiatement) ET scheduled_emails (séquences,
//    workflows, envois programmés via le cron). Les deux espaces d'ID sont
//    disjoints (un email vit dans une seule des deux tables, jamais les
//    deux — voir db/email-events-schema.sql), donc additionner les deux
//    comptes ne fait jamais de double-comptage.
//    🔧 CORRIGÉ — avant ce correctif, seul crm_email_sends était compté ici
//    alors que les ouvertures/clics (email_events) proviennent de TOUTES les
//    sources, y compris séquences/workflows via scheduled_emails. Résultat :
//    le dénominateur ne comptait quasiment aucun envoi réel dès que
//    l'utilisateur envoyait surtout via séquences/workflows, ce qui faisait
//    dépasser 100 % de taux d'ouverture (ex. 7 ouvertures / 4 envois
//    "comptés" = 175 %, alors que le vrai total envoyé était de 50).
//  - Taux d'ouverture / de clic : événements email_events (open/click),
//    dédupliqués par message (1 ouverture unique par email envoyé), rapportés
//    au nombre RÉEL total d'emails envoyés (toutes sources confondues).
//  - Séquences actives : crm_sequences au statut "active".

import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailStats = {
  totalCampaigns: number;
  activeCampaigns: number;
  sentCampaigns: number;
  emailsSent: number;
  opens: number;
  clicks: number;
  openRate: number; // %
  clickRate: number; // %
  activeSequences: number;
};

export const EMPTY_EMAIL_STATS: EmailStats = {
  totalCampaigns: 0,
  activeCampaigns: 0,
  sentCampaigns: 0,
  emailsSent: 0,
  opens: 0,
  clicks: 0,
  openRate: 0,
  clickRate: 0,
  activeSequences: 0,
};

export async function getEmailStats(
  sb: SupabaseClient,
  userId: string,
): Promise<EmailStats> {
  try {
    const [totalRes, activeRes, sentRes, deliveredRes, scheduledSentRes, seqRes, eventsRes] =
      await Promise.all([
        sb.from("crm_campaigns").select("id", { count: "exact", head: true }).eq("user_id", userId),
        sb
          .from("crm_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("status", ["scheduled", "sending"]),
        sb
          .from("crm_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "sent"),
        sb
          .from("crm_email_sends")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "sent"),
        // 🆕 Envois via séquences/workflows (file cron) — sans cette ligne, le
        // dénominateur ignorait la quasi-totalité des envois réels.
        sb
          .from("scheduled_emails")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "sent"),
        sb
          .from("crm_sequences")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "active"),
        sb
          .from("email_events")
          .select("kind, message_id, contact_id")
          .eq("user_id", userId)
          .in("kind", ["open", "click"]),
      ]);

    // 🔧 CORRIGÉ — total réel toutes sources (campagnes + séquences/workflows).
    const emailsSent = (deliveredRes.count ?? 0) + (scheduledSentRes.count ?? 0);

    // Dédup : 1 ouverture / clic unique par email (message_id), repli contact.
    const openKeys = new Set<string>();
    const clickKeys = new Set<string>();
    for (const e of (eventsRes.data ?? []) as Array<{
      kind: string;
      message_id: string | null;
      contact_id: string | null;
    }>) {
      const key = e.message_id ?? e.contact_id;
      if (!key) continue;
      if (e.kind === "open") openKeys.add(key);
      else if (e.kind === "click") clickKeys.add(key);
    }
    const opens = openKeys.size;
    const clicks = clickKeys.size;

    return {
      totalCampaigns: totalRes.count ?? 0,
      activeCampaigns: activeRes.count ?? 0,
      sentCampaigns: sentRes.count ?? 0,
      emailsSent,
      opens,
      clicks,
      openRate: emailsSent > 0 ? Math.round((opens / emailsSent) * 100) : 0,
      clickRate: emailsSent > 0 ? Math.round((clicks / emailsSent) * 100) : 0,
      activeSequences: seqRes.count ?? 0,
    };
  } catch (e) {
    console.error("[emailStats] calcul échoué:", e);
    return { ...EMPTY_EMAIL_STATS };
  }
}
