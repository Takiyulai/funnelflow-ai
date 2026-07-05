// app/api/license/validate/route.ts
// 🆕 Chariow Niveau 1 — activation/validation d'une clé de licence par
// l'utilisateur connecté.
//   POST { licenseKey } → valide auprès de l'API Chariow, enregistre dans
//                         user_licenses (service role), renvoie le statut.
//   GET                 → statut de la licence de l'utilisateur (lecture locale).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateChariowLicense,
  activateChariowLicense,
  upsertUserLicense,
  getActiveChariowLicense,
  chariowLicensePlan,
} from "@/lib/billing/chariow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let licenseKey = "";
  try {
    const body = (await request.json()) as { licenseKey?: string; license_key?: string };
    licenseKey = (body.licenseKey ?? body.license_key ?? "").trim();
  } catch {
    /* corps invalide → géré ci-dessous */
  }
  if (!licenseKey) {
    return NextResponse.json({ ok: false, error: "missing_license_key" }, { status: 400 });
  }

  let check = await validateChariowLicense(licenseKey);
  if (check.error === "missing_api_key") {
    return NextResponse.json(
      { ok: false, error: "chariow_not_configured" },
      { status: 503 },
    );
  }

  // 🆕 Une licence toute fraîche (jamais activée) est "pending_activation" chez
  // Chariow, PAS invalide. Il faut appeler l'endpoint dédié POST .../activate
  // pour la faire passer à "active" (1ère activation = pose expires_at).
  // Sans cet appel, toute nouvelle licence remontait "invalid" à tort.
  if (check.isPendingActivation) {
    check = await activateChariowLicense(licenseKey, user.id);
  }

  // On enregistre le résultat (même expiré/révoqué : trace utile côté support).
  const saved = await upsertUserLicense({
    userId: user.id,
    licenseKey,
    status: check.status,
    expiresAt: check.expiresAt,
    productId: check.productId,
  });
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: check.ok,
    status: check.status,
    plan: check.ok ? chariowLicensePlan() : null,
    expiresAt: check.expiresAt,
    error: check.ok ? undefined : check.error,
  });
}

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const license = await getActiveChariowLicense(user.id);
  return NextResponse.json({
    ok: true,
    active: !!license,
    status: license?.status ?? null,
    plan: license?.plan ?? null,
    expiresAt: license?.expires_at ?? null,
  });
}
