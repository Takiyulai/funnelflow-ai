// app/api/crm/campaigns/[id]/schedule/route.ts
// POST → PROGRAMME l'envoi d'une newsletter (ne l'envoie pas tout de suite).
//   Body : { audience, scheduledAt }
//   audience = { type:"all" } | { type:"status", status } | { type:"tag", tagId }
//            | { type:"list", listId } | { type:"ids", ids:[] }
//   scheduledAt = ISO string (date/heure future)
// Les emails concrets sont écrits dans `scheduled_emails` ; le cron les enverra.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAudience, scheduleCampaign } from "@/lib/crm/campaigns";
import { getAccess } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Même garde de plan que l'envoi immédiat.
  const access = await getAccess(user.id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { ok: false, error: "subscription_required", message: "Un abonnement actif est requis." },
      { status: 402 },
    );
  }
  if (!access.limits.campaigns) {
    return NextResponse.json(
      { ok: false, error: "feature_not_in_plan", message: "Les campagnes email ne sont pas incluses dans ton plan." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const audience = parseAudience(body?.audience ?? { type: "all" });
  if (!audience) {
    return NextResponse.json({ ok: false, error: "invalid_audience" }, { status: 400 });
  }
  const scheduledAt: string = typeof body?.scheduledAt === "string" ? body.scheduledAt : "";

  if (!scheduledAt) {
    return NextResponse.json({ ok: false, error: "scheduledAt_required" }, { status: 400 });
  }

  try {
    const result = await scheduleCampaign(sb, user.id, id, audience, scheduledAt);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "schedule_failed";
    const publicErrors = new Set([
      "campaign_not_found",
      "subject_required",
      "no_recipients",
      "email_quota_exceeded",
      "list_not_found",
      "invalid_date",
      "date_in_past",
    ]);
    if (!publicErrors.has(detail)) {
      console.error("[campaigns/schedule] programmation échouée", e);
    }
    return NextResponse.json(
      { ok: false, error: publicErrors.has(detail) ? detail : "schedule_failed" },
      { status: 500 },
    );
  }
}
