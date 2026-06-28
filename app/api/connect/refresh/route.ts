// app/api/connect/refresh/route.ts
//
// refresh_url de l'Account Link : Stripe redirige ici si le lien d'onboarding a
// expiré. On régénère un lien frais et on redirige le navigateur dessus.

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

export async function GET(req: Request) {
  const base = baseUrl(req);

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(`${base}/paiements?connect=error`);
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${base}/login?next=/paiements`);
  }

  try {
    const accountId = await getOrCreateConnectAccount(user.id, user.email);
    const url = await createOnboardingLink(
      accountId,
      `${base}/paiements?connect=return`,
      `${base}/api/connect/refresh`,
    );
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[api/connect/refresh] stripe error", e);
    return NextResponse.redirect(`${base}/paiements?connect=error`);
  }
}
