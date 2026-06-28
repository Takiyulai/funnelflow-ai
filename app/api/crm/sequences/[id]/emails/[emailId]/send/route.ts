// app/api/crm/sequences/[id]/emails/[emailId]/send/route.ts
// 🆕 ÉTAPE 7 — Envoi manuel d'appoint : envoie immédiatement un email de
// séquence (via Resend) à une adresse donnée (test ou cas particulier).
// Body : { to }.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSequenceEmail } from "@/lib/crm/sequences";
import { sendEmail } from "@/lib/crm/email";
import { renderSequenceEmailHtml } from "@/lib/crm/emailRender";
import { getUserMarketingSender } from "@/lib/email/userSender";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ to: z.string().email() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; emailId: string }> },
) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id, emailId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  try {
    const email = await getSequenceEmail(sb, user.id, id, emailId);
    if (!email) return NextResponse.json({ ok: false, error: "email_not_found" }, { status: 404 });

    const html = renderSequenceEmailHtml(email.content, { email: parsed.data.to });
    // 🆕 Expéditeur MARKETING de l'utilisateur (Option C).
    const sender = await getUserMarketingSender(user.id);
    const result = await sendEmail({
      to: parsed.data.to,
      subject: email.subject || "(sans objet)",
      html,
      from: sender.from,
      replyTo: sender.replyTo,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "send_failed" },
      { status: 500 },
    );
  }
}
