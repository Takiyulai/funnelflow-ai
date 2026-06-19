import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";

type CookieOptions = Parameters<
  Awaited<ReturnType<typeof cookies>>["set"]
>[2];

export async function createSupabaseServerClient() {
  // Lecture nettoyée (sans espace/retour-ligne) + validation claire.
  const { url, anonKey } = requireSupabasePublicEnv();

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Appelé depuis un Server Component : Next interdit l'écriture cookies ici.
          // L'erreur est ignorée volontairement, le middleware s'en charge.
        }
      }
    }
  });
}
