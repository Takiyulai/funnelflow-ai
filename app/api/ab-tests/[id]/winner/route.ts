// app/api/ab-tests/[id]/winner/route.ts
// 🆕 MODULE 3 — Désigne la variante gagnante, l'installe dans le tunnel et
// clôture le test.
//
// C'est l'aboutissement du module. Sans lui, l'utilisateur constate que B
// gagne… puis doit refaire ses modifications à la main dans l'éditeur, en
// risquant d'en oublier une — ce qui annule le bénéfice du test.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyAbWinner } from "@/lib/ab/tests";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const winner = body?.winner;
  if (winner !== "a" && winner !== "b") {
    return NextResponse.json({ ok: false, error: "invalid_winner" }, { status: 400 });
  }

  try {
    await applyAbWinner(sb, user.id, id, winner);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "apply_failed";
    const status = message === "not_found" || message === "funnel_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
