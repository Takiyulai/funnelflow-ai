// app/api/crm/campaigns/[id]/send/route.ts
// POST → envoie la campagne via Resend. Body : { audience }.
//   audience = { type:"all" } | { type:"status", status } | { type:"ids", ids:[] }

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendCampaign, type Audience } from "@/lib/crm/campaigns";
import { resendConfigured } from "@/lib/crm/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!resendConfigured()) {
    return NextResponse.json(
      { ok: false, error: "resend_not_configured" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const audience: Audience = body?.audience ?? { type: "all" };

  try {
    const result = await sendCampaign(sb, user.id, id, audience);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "send_failed" },
      { status: 500 },
    );
  }
}
