// app/api/crm/email-stats/route.ts
// 🆕 Stats email agrégées de l'utilisateur (pour la carte KPI du Dashboard).
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEmailStats, EMPTY_EMAIL_STATS } from "@/lib/crm/emailStats";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, stats: EMPTY_EMAIL_STATS }, { status: 401 });
  }
  const stats = await getEmailStats(sb, user.id);
  return NextResponse.json({ ok: true, stats });
}
