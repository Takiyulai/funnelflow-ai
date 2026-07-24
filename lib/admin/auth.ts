// lib/admin/auth.ts
// 🆕 MODULE 4 — Vérification d'accès admin, PARTAGÉE entre la page /admin
// (Server Component) et les routes API /api/admin/*. Reprend l'allowlist
// ADMIN_EMAILS déjà utilisée par /api/admin/cleanup-media : un seul point de
// vérité pour la liste des administrateurs de la plateforme.
//
// 🔒 Sécurité : ce contrôle est fait CÔTÉ SERVEUR, à partir de la session
// Supabase lue depuis les cookies (jamais un flag/rôle stocké côté client ou
// déduit du JS du navigateur). Un utilisateur normal qui tape /admin dans son
// navigateur est redirigé côté serveur AVANT que la page ne s'affiche — il ne
// peut pas contourner ça en modifiant le DOM ou en désactivant du JS.
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function adminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ??
    "takiyulai0dramane@gmail.com,jwdemanou@gmail.com";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}

/**
 * À utiliser en tête de `app/(app)/admin/**\/page.tsx` (Server Components
 * uniquement). Redirige :
 *   - vers /login si pas de session du tout ;
 *   - vers /dashboard si l'utilisateur est connecté mais N'EST PAS admin.
 * Ne renvoie JAMAIS pour un non-admin — il n'y a pas de "rendu partiel puis
 * masquage" côté client, la redirection est le seul chemin possible.
 */
export async function requireAdminPage(): Promise<{ userId: string; email: string }> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard?admin=forbidden");
  return { userId: user.id, email: user.email as string };
}

/**
 * À utiliser en tête de chaque handler de `app/api/admin/**\/route.ts`.
 * Renvoie un 403 JSON (jamais de redirection HTML — ceci est une API).
 */
export async function requireAdminApi(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; res: NextResponse }
> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, userId: user.id, email: user.email as string };
}
