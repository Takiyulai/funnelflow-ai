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
import { readSupabasePublicEnv } from "@/lib/supabase/env";
import { AB_COOKIE } from "@/lib/ab/cookie";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// 🆕 MODULE 3 — Identifiant visiteur anonyme pour l'A/B testing.
//
// POURQUOI UN COOKIE ET PAS localStorage. L'analytics existant utilise
// `ff_vid` en localStorage, mais il est lu par du JavaScript de navigateur.
// Ici, il faut choisir la variante AVANT de rendre la page, côté serveur —
// sinon on afficherait A puis on la remplacerait par B sous les yeux du
// visiteur, sur une page de vente. Seul un cookie est lisible au rendu.
//
// Le middleware est le seul endroit où ce cookie peut être POSÉ : un Server
// Component de Next 15 ne peut pas écrire de cookie pendant son rendu.
//
// Contenu : un UUID aléatoire, rien d'autre. Aucune donnée personnelle,
// aucun lien avec un compte ou un email — même nature que `ff_vid`.
function ensureAbVisitorCookie(request: NextRequest): NextResponse {
  const existing = request.cookies.get(AB_COOKIE)?.value;
  const visitorKey = existing || crypto.randomUUID();

  // Poser la valeur sur la REQUÊTE avant de construire la réponse : c'est ce
  // qui la rend lisible par le Server Component dès ce premier passage. Sans
  // ça, le tout premier visiteur ne serait affecté à aucune variante.
  if (!existing) request.cookies.set(AB_COOKIE, visitorKey);

  const response = NextResponse.next({ request });
  if (!existing) {
    response.cookies.set(AB_COOKIE, visitorKey, {
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 jours : un test dure rarement plus
      sameSite: "lax",
      httpOnly: false,
    });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  // 🆕 Trafic PUBLIC des tunnels : on ne fait QUE poser l'identifiant visiteur.
  // Surtout pas de rafraîchissement de session Supabase — ces visiteurs n'ont
  // pas de compte, et l'appel réseau ralentirait chaque page de vente. C'est
  // exactement la raison pour laquelle `tunnel/` était exclu du matcher ; il y
  // rentre désormais, mais par cette branche courte uniquement.
  if (request.nextUrl.pathname.startsWith("/tunnel/")) {
    return ensureAbVisitorCookie(request);
  }

  let response = NextResponse.next({ request });

  const { url, anonKey } = readSupabasePublicEnv();
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
  // On exécute le middleware partout SAUF : assets statiques, images et le
  // webhook Stripe (corps brut sensible à la signature).
  //
  // 🆕 `tunnel/` n'est PLUS exclu : ces pages ont besoin de l'identifiant
  // visiteur pour l'A/B testing. La branche en tête de `middleware()` leur
  // évite tout le travail Supabase — le comportement pour ces requêtes reste
  // donc aussi léger qu'avant, à un cookie près.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
