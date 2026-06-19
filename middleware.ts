// middleware.ts
//
// Rafraîchissement de session Supabase (@supabase/ssr) à chaque requête de page.
// Sans ce middleware, le token d'accès expire sans être renouvelé : l'utilisateur
// est « déconnecté » après un moment ou après un refresh, et les Server
// Components (dont app/(app)/layout.tsx qui protège /dashboard) lisent une
// session périmée.
//
// Rôle STRICT : revalider le token et réécrire les cookies sb-* sur la réponse.
// Il NE redirige PAS — le gating (redirection vers /login ou /abonnement) reste
// dans app/(app)/layout.tsx. Séparer les deux limite les risques de boucle.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  // Pas de config Supabase → on ne bloque rien (laisse passer la requête).
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // 1) refléter sur la requête (pour la suite du pipeline)
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // 2) réémettre une réponse portant les cookies mis à jour
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT : getUser() force la revalidation/rafraîchissement du token.
  // Ne pas insérer de logique entre createServerClient et getUser().
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // On exécute le middleware partout SAUF : assets statiques, images, le webhook
  // Stripe (corps brut sensible à la signature) et les pages PUBLIQUES de tunnel
  // (aucune auth requise, trafic visiteurs → inutile de rafraîchir une session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|tunnel/|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
