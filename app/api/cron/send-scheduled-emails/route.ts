// app/api/cron/send-scheduled-emails/route.ts
// 🆕 ÉTAPE 6 — CRON d'envoi des emails programmés (newsletters ET séquences).
// Lit la file `scheduled_emails` (status=pending, scheduled_at<=now) via le
// client ADMIN (service role, tous utilisateurs) et envoie via Resend.
//
// SÉCURITÉ : route protégée par un secret. Vercel Cron envoie automatiquement
// l'en-tête `Authorization: Bearer <CRON_SECRET>` quand la variable CRON_SECRET
// est définie. On refuse toute requête sans ce secret.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/crm/email";
import { getUserMarketingSender } from "@/lib/email/userSender";
import type { Sender } from "@/lib/email/sender";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 100;

type DueRow = {
  id: string;
  user_id: string;
  recipient_email: string;
  subject: string | null;
  content: string | null;
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas de secret configuré → on refuse par sécurité
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function processDue(): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("scheduled_emails")
    .select("id, user_id, recipient_email, subject, content")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DueRow[];
  let sent = 0;
  let failed = 0;

  // 🆕 Expéditeur MARKETING résolu PAR utilisateur (Option C), mis en cache sur
  // la durée du run pour éviter des lookups répétés.
  const senderCache = new Map<string, Sender>();
  async function senderFor(userId: string): Promise<Sender> {
    const cached = senderCache.get(userId);
    if (cached) return cached;
    const resolved = await getUserMarketingSender(userId);
    senderCache.set(userId, resolved);
    return resolved;
  }

  for (const row of rows) {
    if (!row.recipient_email) {
      await sb
        .from("scheduled_emails")
        .update({ status: "failed", error: "missing_recipient", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      failed++;
      continue;
    }
    const sender = await senderFor(row.user_id);
    const result = await sendEmail({
      to: row.recipient_email,
      subject: row.subject || "(sans objet)",
      html: row.content || "",
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
  }

  return { processed: rows.length, sent, failed };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDue();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cron_failed" },
      { status: 500 },
    );
  }
}

// Permet aussi un déclenchement manuel/POST (même protection).
export async function POST(request: Request) {
  return GET(request);
}
