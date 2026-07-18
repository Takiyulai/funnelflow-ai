// lib/crm/sequences.ts
// 🆕 ÉTAPE 5 — Service interne SÉQUENCES (CRUD). Logique pure : prend un client
// Supabase + userId. Réutilisable par les routes API (session) ET par un futur
// webhook n8n (client admin + userId). RLS propriétaire côté base.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Sequence,
  SequenceEmail,
  SequenceWithEmails,
  SequenceInput,
} from "./types";
import { renderSequenceEmailHtml } from "./emailRender";

const SEQ_COLS =
  "id, user_id, name, type, roles, context, language, funnel_id, status, created_at, updated_at";
const SEQ_EMAIL_COLS =
  "id, sequence_id, user_id, position, delay_days, delay_hours, subject, content, created_at, updated_at";

export async function listSequences(
  sb: SupabaseClient,
  userId: string,
): Promise<Sequence[]> {
  const { data, error } = await sb
    .from("crm_sequences")
    .select(SEQ_COLS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Sequence[];
}

export async function getSequenceWithEmails(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<SequenceWithEmails | null> {
  const { data: seq, error } = await sb
    .from("crm_sequences")
    .select(SEQ_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!seq) return null;

  const { data: emails, error: e2 } = await sb
    .from("crm_sequence_emails")
    .select(SEQ_EMAIL_COLS)
    .eq("user_id", userId)
    .eq("sequence_id", id)
    .order("position", { ascending: true });
  if (e2) throw new Error(e2.message);

  return { ...(seq as Sequence), emails: (emails ?? []) as SequenceEmail[] };
}

/** Réécrit l'ensemble des emails d'une séquence (delete + insert ordonné). */
async function replaceEmails(
  sb: SupabaseClient,
  userId: string,
  sequenceId: string,
  emails: SequenceInput["emails"],
): Promise<void> {
  await sb
    .from("crm_sequence_emails")
    .delete()
    .eq("user_id", userId)
    .eq("sequence_id", sequenceId);

  if (emails.length === 0) return;
  const rows = emails.map((e, i) => ({
    sequence_id: sequenceId,
    user_id: userId,
    position: i,
    delay_days: Math.max(0, Math.round(e.delay_days) || 0),
    delay_hours: Math.min(23, Math.max(0, Math.round(e.delay_hours ?? 0) || 0)),
    subject: e.subject ?? "",
    content: e.content ?? "",
  }));
  const { error } = await sb.from("crm_sequence_emails").insert(rows);
  if (error) throw new Error(error.message);
}

export async function createSequence(
  sb: SupabaseClient,
  userId: string,
  input: SequenceInput,
): Promise<SequenceWithEmails> {
  const { data, error } = await sb
    .from("crm_sequences")
    .insert({
      user_id: userId,
      name: input.name.trim() || "Séquence sans nom",
      type: input.type,
      roles: input.roles ?? null,
      context: input.context ?? null,
      language: input.language,
      funnel_id: input.funnel_id ?? null,
      status: input.status ?? "draft",
    })
    .select(SEQ_COLS)
    .single();
  if (error) throw new Error(error.message);

  const seq = data as Sequence;
  await replaceEmails(sb, userId, seq.id, input.emails);
  const full = await getSequenceWithEmails(sb, userId, seq.id);
  if (!full) throw new Error("sequence_reload_failed");
  return full;
}

export async function updateSequence(
  sb: SupabaseClient,
  userId: string,
  id: string,
  input: SequenceInput,
): Promise<SequenceWithEmails> {
  const { error } = await sb
    .from("crm_sequences")
    .update({
      name: input.name.trim() || "Séquence sans nom",
      type: input.type,
      roles: input.roles ?? null,
      context: input.context ?? null,
      language: input.language,
      funnel_id: input.funnel_id ?? null,
      ...(input.status ? { status: input.status } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);

  await replaceEmails(sb, userId, id, input.emails);
  const full = await getSequenceWithEmails(sb, userId, id);
  if (!full) throw new Error("sequence_not_found");
  return full;
}

export async function deleteSequence(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await sb
    .from("crm_sequences")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Récupère un email précis d'une séquence (vérifie l'appartenance). */
export async function getSequenceEmail(
  sb: SupabaseClient,
  userId: string,
  sequenceId: string,
  emailId: string,
): Promise<SequenceEmail | null> {
  const { data, error } = await sb
    .from("crm_sequence_emails")
    .select(SEQ_EMAIL_COLS)
    .eq("user_id", userId)
    .eq("sequence_id", sequenceId)
    .eq("id", emailId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SequenceEmail) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 ÉTAPE 5b — Inscription d'un contact à une séquence : on calcule la date
// d'envoi de CHAQUE email (entrée + delay_days) et on crée les lignes concrètes
// dans la file `scheduled_emails` (que le CRON enverra — étape 6).
// ─────────────────────────────────────────────────────────────────────────────

export async function enrollContact(
  sb: SupabaseClient,
  userId: string,
  sequenceId: string,
  contactId: string,
  /** 🆕 Délai supplémentaire (ms) avant le PREMIER email — reporté sur TOUS les
   *  emails de la séquence. Permet à un workflow "Attendre" placé avant
   *  "Inscrire dans une séquence" de réellement décaler l'inscription au lieu
   *  d'être silencieusement ignoré (l'inscription démarrait toujours selon le
   *  calendrier propre de la séquence, jamais après le wait du workflow). */
  extraDelayMs = 0,
): Promise<{ scheduled: number }> {
  const seq = await getSequenceWithEmails(sb, userId, sequenceId);
  if (!seq) throw new Error("sequence_not_found");
  if (seq.emails.length === 0) throw new Error("sequence_empty");

  const { data: contact, error: cErr } = await sb
    .from("leads")
    .select("id, email, name")
    .eq("user_id", userId)
    .eq("id", contactId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!contact || !contact.email) throw new Error("contact_not_found");

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const startAt = now + Math.max(0, extraDelayMs);
  const recipient = { name: contact.name as string | null, email: contact.email as string };

  const rows = seq.emails.map((em) => ({
    user_id: userId,
    source_type: "sequence",
    campaign_id: null,
    sequence_id: sequenceId,
    sequence_email_id: em.id,
    contact_id: contact.id,
    recipient_email: contact.email,
    subject: em.subject,
    content: renderSequenceEmailHtml(em.content, recipient), // snapshot perso
    scheduled_at: new Date(
      startAt + Math.max(0, em.delay_days) * DAY_MS + Math.max(0, em.delay_hours ?? 0) * HOUR_MS,
    ).toISOString(),
    status: "pending",
  }));

  const { error } = await sb.from("scheduled_emails").insert(rows);
  if (error) throw new Error(error.message);
  return { scheduled: rows.length };
}
