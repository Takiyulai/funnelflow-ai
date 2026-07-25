// lib/crm/deliverScheduled.ts
//
// 🆕 CORRECTIF EMAILS — Traitement PARTAGÉ de la file `scheduled_emails`.
// Extrait du cron (app/api/cron/send-scheduled-emails) pour être appelable :
//   1. par le CRON (toutes lignes dues, tous utilisateurs) — filet de sécurité ;
//   2. IMMÉDIATEMENT après une capture de lead / un enrôlement de séquence
//      (lignes dues MAINTENANT pour CET utilisateur) → les emails « instantanés »
//      partent en quelques secondes, sans attendre le passage du cron.
//
// ANTI DOUBLE-ENVOI : chaque ligne est « réclamée » par une mise à jour atomique
// `pending` → `sending` (garde .eq status='pending'). Si le cron et un envoi
// immédiat se chevauchent, un seul des deux obtient la ligne. Les lignes
// `sending` bloquées depuis > 10 min (crash process) sont remises en `pending`.
//
// ⚠️ Nécessite la valeur 'sending' dans la contrainte CHECK de
// scheduled_emails.status — voir db/scheduled-emails-sending-status.sql.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/crm/email";
import { getFunnelMarketingSender } from "@/lib/email/userSender";
import type { Sender } from "@/lib/email/sender";
import {
  wrapEmailLinksForTracking,
  appendOpenTrackingPixel,
} from "@/lib/crm/emailTracking";
import { appendUnsubscribeFooter } from "@/lib/crm/unsubscribe";

const DEFAULT_BATCH = 100;
/** Délai au-delà duquel une ligne `sending` est considérée abandonnée (crash). */
const STALE_SENDING_MS = 10 * 60 * 1000;

export type DeliverOptions = {
  /** Limiter aux emails de CET utilisateur (envoi immédiat post-capture). */
  userId?: string;
  /** Taille max du lot (défaut 100). */
  limit?: number;
};

export type DeliverResult = { processed: number; sent: number; failed: number };

type DueRow = {
  id: string;
  user_id: string;
  funnel_id: string | null;
  contact_id: string | null;
  recipient_email: string;
  subject: string | null;
  content: string | null;
  source_type: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  sequence_email_id: string | null;
};

/** Remet en `pending` les lignes `sending` abandonnées (best-effort). */
async function recoverStaleSending(): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - STALE_SENDING_MS).toISOString();
    await sb
      .from("scheduled_emails")
      .update({ status: "pending" })
      .eq("status", "sending")
      .lt("sent_at", cutoff);
  } catch {
    /* jamais bloquant */
  }
}

/**
 * Envoie les emails DUS (status=pending, scheduled_at<=now). Sûr à appeler en
 * concurrence (claim atomique par ligne). Retourne un décompte du lot traité.
 */
export async function processDueScheduledEmails(
  opts: DeliverOptions = {},
): Promise<DeliverResult> {
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_BATCH, DEFAULT_BATCH));

  await recoverStaleSending();

  let query = sb
    .from("scheduled_emails")
    .select(
      "id, user_id, funnel_id, contact_id, recipient_email, subject, content, source_type, campaign_id, sequence_id, sequence_email_id",
    )
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DueRow[];
  let sent = 0;
  let failed = 0;
  let processed = 0;

  // RGPD : contacts désinscrits parmi ce lot (un seul lookup). Pas d'email
  // MARKETING à un désinscrit ; les emails 'delivery' ne sont pas concernés.
  const marketingContactIds = Array.from(
    new Set(
      rows
        .filter((r) => r.source_type !== "delivery" && r.contact_id)
        .map((r) => r.contact_id as string),
    ),
  );
  const unsubscribed = new Set<string>();
  if (marketingContactIds.length > 0) {
    const { data: unsubRows } = await sb
      .from("leads")
      .select("id")
      .in("id", marketingContactIds)
      .not("unsubscribed_at", "is", null);
    for (const u of unsubRows ?? []) unsubscribed.add((u as { id: string }).id);
  }

  // Expéditeur marketing résolu par (utilisateur, tunnel), avec cache de run.
  const senderCache = new Map<string, Sender>();
  async function senderFor(userId: string, funnelId: string | null): Promise<Sender> {
    const key = `${userId}::${funnelId ?? ""}`;
    const cached = senderCache.get(key);
    if (cached) return cached;
    const resolved = await getFunnelMarketingSender(userId, funnelId);
    senderCache.set(key, resolved);
    return resolved;
  }

  for (const row of rows) {
    // 🔒 CLAIM ATOMIQUE — seul le runner qui bascule pending→sending traite la
    // ligne. `sent_at` sert d'horodatage de claim (pour la récupération des
    // lignes abandonnées) et sera écrasé par l'heure d'envoi réelle.
    try {
      const { data: claimed, error: claimErr } = await sb
        .from("scheduled_emails")
        .update({ status: "sending", sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id");
      if (claimErr || !claimed || claimed.length === 0) continue; // pris ailleurs
      processed++;

      if (!row.recipient_email) {
        await sb
          .from("scheduled_emails")
          .update({ status: "failed", error: "missing_recipient", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        failed++;
        continue;
      }
      const isMarketing = row.source_type !== "delivery";
      if (isMarketing && row.contact_id && unsubscribed.has(row.contact_id)) {
        await sb
          .from("scheduled_emails")
          .update({ status: "failed", error: "recipient_unsubscribed", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        failed++;
        continue;
      }
      const sender = await senderFor(row.user_id, row.funnel_id);
      const tracking = {
        userId: row.user_id,
        contactId: row.contact_id,
        messageId: row.id,
        sourceType: row.source_type,
        campaignId: row.campaign_id,
        sequenceId: row.sequence_id,
        sequenceEmailId: row.sequence_email_id,
      };
      let html = appendOpenTrackingPixel(
        wrapEmailLinksForTracking(row.content || "", tracking),
        tracking,
      );
      if (isMarketing) html = appendUnsubscribeFooter(html, row.contact_id);
      const result = await sendEmail({
        to: row.recipient_email,
        subject: row.subject || "(sans objet)",
        html,
        from: sender.from,
        replyTo: sender.replyTo,
      });
      await sb
        .from("scheduled_emails")
        .update({
          status: result.ok ? "sent" : "failed",
          error: result.ok ? null : result.error ?? "send_failed",
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (result.ok) sent++;
      else failed++;
    } catch (e) {
      console.error(`[deliverScheduled] ligne "${row.id}" en erreur, on continue :`, e);
      try {
        await sb
          .from("scheduled_emails")
          .update({
            status: "failed",
            error: e instanceof Error ? e.message.slice(0, 500) : "unexpected_error",
            sent_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } catch {
        /* on continue le lot */
      }
      failed++;
    }
  }

  return { processed, sent, failed };
}

/**
 * Variante « fire-and-forget » utilisée juste après une capture de lead ou un
 * enrôlement : envoie les emails dus maintenant pour CET utilisateur. Toute
 * erreur est avalée — ne bloque jamais la réponse HTTP de l'appelant.
 */
export async function dispatchDueEmailsNow(userId: string): Promise<void> {
  try {
    await processDueScheduledEmails({ userId, limit: 25 });
  } catch (e) {
    console.warn("[deliverScheduled] dispatch immédiat échoué (non bloquant):", e);
  }
}
