// app/api/crm/campaigns/[id]/send/route.ts
// POST → envoie la campagne via Resend. Body : { audience }.
//   audience = { type:"all" } | { type:"status", status } | { type:"tag", tagId }
//            | { type:"list", listId } | { type:"ids", ids:[] }

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAudience, sendCampaign } from "@/lib/crm/campaigns";
import { resendConfigured } from "@/lib/crm/email";
import { getAccess } from "@/lib/billing/subscription";

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

  // Garde de plan : l'envoi de campagnes doit être inclus dans l'abonnement.
  const access = await getAccess(user.id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { ok: false, error: "subscription_required", message: "Un abonnement actif est requis." },
      { status: 402 },
    );
  }
  if (!access.limits.campaigns) {
    return NextResponse.json(
      {
        ok: false,
        error: "feature_not_in_plan",
        message: "Les campagnes email ne sont pas incluses dans ton plan.",
      },
      { status: 403 },
    );
  }

  if (!resendConfigured()) {
    return NextResponse.json(
      { ok: false, error: "resend_not_configured" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const audience = parseAudience(body?.audience ?? { type: "all" });
  if (!audience) {
    return NextResponse.json({ ok: false, error: "invalid_audience" }, { status: 400 });
  }

  try {
    const result = await sendCampaign(sb, user.id, id, audience);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "send_failed";
    const publicErrors = new Set([
      "campaign_not_found",
      "subject_required",
      "no_recipients",
      "email_quota_exceeded",
      "list_not_found",
    ]);
    if (!publicErrors.has(detail)) {
      console.error("[campaigns/send] envoi échoué", e);
    }
    return NextResponse.json(
      { ok: false, error: publicErrors.has(detail) ? detail : "send_failed" },
      { status: 500 },
    );
  }
}
