// app/api/stats/public/route.ts
//
// 🆕 Compteurs PUBLICS (agrégés, non nominatifs) pour la preuve sociale de la
// landing : nombre total de tunnels générés et de leads capturés sur la
// plateforme. Lecture via le client admin (agrégat cross-comptes), sans exposer
// aucune donnée personnelle. Mis en cache côté CDN (5 min).

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 🆕 Baseline de LANCEMENT (ajustable par toi) : ajoutée aux compteurs réels
// pour un affichage crédible tant que le volume réel est faible. Mets 0 pour un
// affichage 100 % réel. C'est une décision marketing — à toi de l'assumer.
// Réglée pour que les deux compteurs dépassent confortablement 100.
const BASELINE = { funnels: 100, leads: 90 };

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const [funnelsRes, leadsRes] = await Promise.all([
      sb.from("funnels").select("id", { count: "exact", head: true }),
      sb.from("leads").select("id", { count: "exact", head: true }),
    ]);
    return NextResponse.json(
      {
        ok: true,
        funnels: (funnelsRes.count ?? 0) + BASELINE.funnels,
        leads: (leadsRes.count ?? 0) + BASELINE.leads,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    // Jamais bloquant pour la landing : on renvoie 0 (le composant a un repli).
    return NextResponse.json({ ok: false, funnels: 0, leads: 0 });
  }
}
