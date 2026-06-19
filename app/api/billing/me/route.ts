// app/api/billing/me/route.ts
// Résumé d'abonnement de l'utilisateur connecté (pour l'UI : Sidebar, etc.).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/billing/subscription";
import { PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const access = await getAccess(user.id);
  return NextResponse.json({
    ok: true,
    planId: access.planId,
    planName: access.planId ? PLANS[access.planId].name : null,
    status: access.status,
    hasAccess: access.hasAccess,
    enforced: access.enforced,
  });
}
