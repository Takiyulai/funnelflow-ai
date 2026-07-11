// lib/crm/campaigns.ts
// Service interne CRM — Campagnes email. Logique pure (supabase + userId),
// réutilisable par les routes API et un futur webhook n8n.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, LeadStatus } from "./types";
import { sendEmail } from "./email";
import {
  wrapEmailLinksForTracking,
  appendOpenTrackingPixel,
} from "./emailTracking";
import { getUserMarketingSender } from "@/lib/email/userSender";
import { getAccess } from "@/lib/billing/subscription";
import { consumeQuota } from "@/lib/billing/usage";

const COLS =
  "id, user_id, name, subject, content, status, scheduled_at, segment_id, recipient_ids, recipients_count, sent_count, failed_count, sent_at, created_at, updated_at";

export type CampaignInput = {
  name: string;
  subject?: string;
  content?: string;
};

/** Public de destinataires : tous, par statut, ou sélection d'ids. */
export type Audience =
  | { type: "all" }
  | { type: "status"; status: LeadStatus }
  | { type: "ids"; ids: string[] };

type Recipient = { id: string | null; email: string; name: string | null };

export async function listCampaigns(
  sb: SupabaseClient,
  userId: string,
): Promise<Campaign[]> {
  const { data, error } = await sb
    .from("crm_campaigns")
    .select(COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

export async function getCampaign(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<Campaign | null> {
  const { data, error } = await sb
    .from("crm_campaigns")
    .select(COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Campaign) ?? null;
}

export async function createCampaign(
  sb: SupabaseClient,
  userId: string,
  input: CampaignInput,
): Promise<Campaign> {
  const { data, error } = await sb
    .from("crm_campaigns")
    .insert({
      user_id: userId,
      name: input.name.trim() || "Campagne sans nom",
      subject: input.subject ?? "",
      content: input.content ?? "",
      status: "draft",
    })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Campaign;
}

export async function updateCampaign(
  sb: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<CampaignInput>,
): Promise<Campaign> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim() || "Campagne sans nom";
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.content !== undefined) update.content = patch.content;

  const { data, error } = await sb
    .from("crm_campaigns")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Campaign;
}

async function resolveRecipients(
  sb: SupabaseClient,
  userId: string,
  audience: Audience,
): Promise<Recipient[]> {
  let q = sb
    .from("leads")
    .select("id, email, name")
    .eq("user_id", userId)
    .not("email", "is", null);

  if (audience.type === "status") q = q.eq("status", audience.status);
  if (audience.type === "ids") q = q.in("id", audience.ids);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Recipient[]).filter((r) => !!r.email);
}

/**
 * Transforme le contenu en HTML d'email :
 *  - si l'utilisateur a déjà écrit du HTML (balises présentes), on le garde ;
 *  - sinon (texte simple), on convertit les sauts de ligne en paragraphes/<br>.
 * Pas besoin pour l'utilisateur d'écrire des balises <p>.
 */
function toHtmlBody(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed; // déjà du HTML
  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Enveloppe HTML basique + personnalisation simple ({{prenom}}, {{email}}). */
function renderEmailHtml(content: string, r: Recipient): string {
  const name = r.name || "";
  const personalized = content
    .replace(/\{\{\s*(prenom|name|nom)\s*\}\}/gi, name)
    .replace(/\{\{\s*email\s*\}\}/gi, r.email);
  const body = toHtmlBody(personalized);
  return (
    `<!doctype html><html><head><meta charset="utf-8" /></head>` +
    `<body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6;">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">${body}</div>` +
    `</body></html>`
  );
}

/**
 * Envoie une campagne. Résout les destinataires, envoie via Resend, journalise
 * chaque envoi (crm_email_sends) et met à jour le statut + compteurs.
 */
export async function sendCampaign(
  sb: SupabaseClient,
  userId: string,
  id: string,
  audience: Audience,
): Promise<{ sent: number; failed: number; total: number; error?: string }> {
  const campaign = await getCampaign(sb, userId, id);
  if (!campaign) throw new Error("campaign_not_found");
  if (!campaign.subject.trim()) throw new Error("subject_required");

  const recipients = await resolveRecipients(sb, userId, audience);
  if (recipients.length === 0) throw new Error("no_recipients");

  // 🆕 Quota mensuel d'emails du plan (consommé pour tout le lot).
  const access = await getAccess(userId);
  const emailQuota = await consumeQuota(
    userId,
    "email_send",
    access.limits.monthlyEmailSends,
    recipients.length,
  );
  if (!emailQuota.ok) throw new Error("email_quota_exceeded");

  let firstError: string | undefined;

  await sb
    .from("crm_campaigns")
    .update({
      status: "sending",
      recipients_count: recipients.length,
      recipient_ids: recipients.map((r) => r.id),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id);

  // 🆕 Expéditeur MARKETING résolu pour cet utilisateur (Option C).
  const sender = await getUserMarketingSender(userId);

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    // 🆕 LOT 3 — La ligne d'envoi est créée AVANT l'envoi pour disposer de son
    // id (messageId) dans les liens trackés et le pixel d'ouverture. En cas
    // d'échec d'insertion (rare), on envoie quand même, sans tracking stats.
    const { data: sendRow } = await sb
      .from("crm_email_sends")
      .insert({
        campaign_id: id,
        contact_id: r.id,
        user_id: userId,
        email: r.email,
        status: "pending",
      })
      .select("id")
      .single();

    const tracking = {
      userId,
      contactId: r.id,
      messageId: (sendRow?.id as string | undefined) ?? null,
      sourceType: "newsletter",
      campaignId: id,
    };
    const html = appendOpenTrackingPixel(
      wrapEmailLinksForTracking(renderEmailHtml(campaign.content, r), tracking),
      tracking,
    );
    const result = await sendEmail({
      to: r.email,
      subject: campaign.subject,
      html,
      from: sender.from,
      replyTo: sender.replyTo,
    });
    if (sendRow?.id) {
      await sb
        .from("crm_email_sends")
        .update({
          status: result.ok ? "sent" : "failed",
          resend_id: result.id ?? null,
          error: result.error ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
        })
        .eq("id", sendRow.id);
    } else {
      await sb.from("crm_email_sends").insert({
        campaign_id: id,
        contact_id: r.id,
        user_id: userId,
        email: r.email,
        status: result.ok ? "sent" : "failed",
        resend_id: result.id ?? null,
        error: result.error ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      });
    }
    if (result.ok) sent++;
    else {
      failed++;
      if (!firstError) firstError = result.error;
    }
  }

  await sb
    .from("crm_campaigns")
    .update({
      status: failed === recipients.length ? "failed" : "sent",
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id);

  return { sent, failed, total: recipients.length, error: firstError };
}

/**
 * 🆕 PROGRAMME une newsletter : ne l'envoie PAS maintenant. On résout les
 * destinataires, on fige (snapshot) l'email rendu par destinataire dans la file
 * `scheduled_emails` à la date voulue, et on passe la campagne en "scheduled".
 * Le cron (ÉTAPE 6) enverra ces emails quand leur date sera atteinte.
 */
export async function scheduleCampaign(
  sb: SupabaseClient,
  userId: string,
  id: string,
  audience: Audience,
  scheduledAtISO: string,
): Promise<{ scheduled: number; total: number; scheduledAt: string }> {
  const campaign = await getCampaign(sb, userId, id);
  if (!campaign) throw new Error("campaign_not_found");
  if (!campaign.subject.trim()) throw new Error("subject_required");

  const when = new Date(scheduledAtISO);
  if (Number.isNaN(when.getTime())) throw new Error("invalid_date");
  // Tolérance d'1 min pour éviter les faux « passé » dus à la latence/UI.
  if (when.getTime() < Date.now() - 60_000) throw new Error("date_in_past");

  const recipients = await resolveRecipients(sb, userId, audience);
  if (recipients.length === 0) throw new Error("no_recipients");

  // 🆕 Quota mensuel d'emails : on RÉSERVE le volume dès la programmation
  // (les emails sont engagés dans la file ; le cron se contentera d'envoyer).
  const access = await getAccess(userId);
  const emailQuota = await consumeQuota(
    userId,
    "email_send",
    access.limits.monthlyEmailSends,
    recipients.length,
  );
  if (!emailQuota.ok) throw new Error("email_quota_exceeded");

  // Re-programmation : on purge les emails encore EN ATTENTE de cette campagne.
  await sb
    .from("scheduled_emails")
    .delete()
    .eq("user_id", userId)
    .eq("campaign_id", id)
    .eq("status", "pending");

  const whenISO = when.toISOString();
  const rows = recipients.map((r) => ({
    user_id: userId,
    source_type: "newsletter",
    campaign_id: id,
    contact_id: r.id,
    recipient_email: r.email,
    subject: campaign.subject,
    content: renderEmailHtml(campaign.content, r), // snapshot personnalisé
    scheduled_at: whenISO,
    status: "pending",
  }));

  // Insertion par lots (évite une requête trop volumineuse).
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from("scheduled_emails").insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }

  await sb
    .from("crm_campaigns")
    .update({
      status: "scheduled",
      scheduled_at: whenISO,
      recipients_count: recipients.length,
      recipient_ids: recipients.map((r) => r.id),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id);

  return { scheduled: rows.length, total: recipients.length, scheduledAt: whenISO };
}
