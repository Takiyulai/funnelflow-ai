// app/api/track/page-view/route.ts
// 🆕 LOT 2 — Déclencheur Workflow `page.visited`. Ne concerne QUE les contacts
// déjà identifiés sur ce navigateur (id posé en localStorage après capture
// d'un lead, cf. FormRenderer + PageViewBeacon) : aucun tracking de visiteur
// anonyme. Silencieux et best-effort — ne doit jamais impacter la navigation.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runWorkflowsForEvent } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  funnelSlug: z.string().min(1).max(100),
  pageSlug: z.string().max(100).nullable().optional(),
  contactId: z.string().uuid(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const admin = getSupabaseAdmin();
    let { data: funnel } = await admin
      .from("funnels")
      .select("id, user_id")
      .eq("published_slug", parsed.data.funnelSlug)
      .maybeSingle();
    if (!funnel) {
      const byDraft = await admin
        .from("funnels")
        .select("id, user_id")
        .eq("slug", parsed.data.funnelSlug)
        .maybeSingle();
      funnel = byDraft.data;
    }
    if (!funnel) return NextResponse.json({ ok: true }); // silencieux

    const { data: lead } = await admin
      .from("leads")
      .select("id, email, name")
      .eq("id", parsed.data.contactId)
      .eq("user_id", funnel.user_id)
      .maybeSingle();
    if (!lead) return NextResponse.json({ ok: true }); // contact inconnu → silencieux

    await runWorkflowsForEvent(admin, funnel.user_id as string, {
      event: "page.visited",
      lead: { id: lead.id as string, email: lead.email as string, name: lead.name as string | null },
      funnelId: funnel.id as string,
      pageSlug: parsed.data.pageSlug || null,
    });
  } catch (e) {
    console.warn("[track/page-view] échoué (non bloquant):", e);
  }

  return NextResponse.json({ ok: true });
}
