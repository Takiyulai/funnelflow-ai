// app/api/connect/onboard/route.ts
//
// Démarre (ou reprend) l'onboarding Stripe Connect du créateur.
// Crée le compte Express si absent puis renvoie l'URL d'onboarding hébergé.
// Le front redirige le navigateur vers cette URL ; Stripe renvoie ensuite vers
// /paiements (return_url). Aucune clé en dur : tout vient de l'env.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrCreateConnectAccount,
  createOnboardingLink,
} from "@/lib/billing/connect";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers.get("host");
  return host ? `https://${host}` : "";
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const accountId = await getOrCreateConnectAccount(user.id, user.email);
    const base = baseUrl(req);
    const url = await createOnboardingLink(
      accountId,
      `${base}/paiements?connect=return`,
      `${base}/api/connect/refresh`,
    );
    return NextResponse.json({ ok: true, url }, { status: 200 });
  } catch (e) {
    console.error("[api/connect/onboard] stripe error", e);
    return NextResponse.json(
      {
        ok: false,
        error: "connect_error",
        message:
          "Impossible de démarrer la connexion Stripe. Réessayez dans un instant.",
      },
      { status: 502 },
    );
  }
}
