// app/api/stats/payments/route.ts
// Statistiques de paiement de l'utilisateur connecté (agrégat des commandes
// payées + leads). Lecture serveur ; aucune donnée sensible Stripe exposée.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFunnelPaymentStats } from "@/lib/billing/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const stats = await getFunnelPaymentStats(user.id);
  return NextResponse.json({ ok: true, ...stats });
}
