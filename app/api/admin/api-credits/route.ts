// app/api/admin/api-credits/route.ts
// 🆕 Consommation et solde des clés API, pour l'onglet « Clés API » du
// dashboard admin.
//
// 🔒 Strictement réservé aux administrateurs (requireAdminApi). La réponse ne
// contient JAMAIS de clé en clair — uniquement un aperçu masqué des 4 derniers
// caractères, produit par lib/admin/apiCredits.ts.

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getApiKeyStatuses } from "@/lib/admin/apiCredits";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  try {
    const providers = await getApiKeyStatuses(getSupabaseAdmin());
    return NextResponse.json(
      { ok: true, providers, fetchedAt: new Date().toISOString() },
      // Les soldes changent en permanence : aucun cache, ni navigateur ni CDN.
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[admin/api-credits] échec :", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "internal" },
      { status: 500 },
    );
  }
}
