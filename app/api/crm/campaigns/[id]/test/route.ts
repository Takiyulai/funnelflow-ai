import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampaign, renderCampaignHtml } from "@/lib/crm/campaigns";
import { resendConfigured, sendEmail } from "@/lib/crm/email";
import { getUserMarketingSender } from "@/lib/email/userSender";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ to: z.string().email() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!resendConfigured()) return NextResponse.json({ ok: false, error: "resend_not_configured" }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  const { id } = await params;
  try {
    const campaign = await getCampaign(sb, user.id, id);
    if (!campaign) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const sender = await getUserMarketingSender(user.id);
    const result = await sendEmail({
      to: parsed.data.to,
      subject: campaign.subject || "(sans objet)",
      html: renderCampaignHtml(campaign, { id: null, email: parsed.data.to, name: null }),
      from: sender.from,
      replyTo: sender.replyTo,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "send_failed" }, { status: 502 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[campaign-test] send failed", error);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }
}
