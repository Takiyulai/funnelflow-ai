// app/auth/callback/route.ts
//
// Callback OAuth (Google) pour Supabase en flux PKCE avec @supabase/ssr.
// Google renvoie l'utilisateur ici avec un ?code=… ; on échange ce code contre
// une SESSION (pose les cookies sb-*) côté serveur, PUIS on redirige vers la
// destination finale (par défaut /dashboard).
//
// C'est l'étape qui manquait : avant, redirectTo pointait directement sur
// /dashboard, donc le code n'était jamais échangé → aucune session → retour
// à l'accueil.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  // Destination finale après connexion (whitelist : chemins internes seulement).
  const rawNext = url.searchParams.get("next") || "/dashboard";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  // Derrière le proxy Vercel, on reconstruit l'origin depuis les en-têtes
  // forwarded pour éviter une redirection vers une mauvaise origine.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession a échoué:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_exchange`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
