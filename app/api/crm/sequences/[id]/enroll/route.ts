// app/api/crm/sequences/[id]/enroll/route.ts
// POST → inscrit un contact à la séquence : programme tous ses emails (file
// scheduled_emails) selon les délais. Body : { contactId }.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enrollContact } from "@/lib/crm/sequences";
import { dispatchDueEmailsNow } from "@/lib/crm/deliverScheduled";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ contactId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  try {
    const result = await enrollContact(sb, user.id, id, parsed.data.contactId);
    // 🔒 CORRECTIF EMAILS — envoie immédiatement les emails dus maintenant
    // (ex. premier email de la séquence à délai 0) sans attendre le cron.
    await dispatchDueEmailsNow(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "enroll_failed" },
      { status: 500 },
    );
  }
}
