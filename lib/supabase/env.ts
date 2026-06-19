// lib/supabase/env.ts
//
// Lecture + NETTOYAGE des variables Supabase publiques, partagé par le client
// navigateur, le client serveur et le middleware.
//
// Pourquoi nettoyer : une URL Supabase (https://<ref>.supabase.co) et une clé
// anon (JWT) ne contiennent JAMAIS d'espace ni de retour-ligne. Or un copier-
// coller dans Vercel insère parfois un \n ou un espace (y compris AU MILIEU de
// la valeur). Passé tel quel à fetch, ça déclenche l'erreur obscure
// « Failed to execute 'fetch' on 'Window': Invalid value » (caractère invalide
// dans une URL ou un en-tête). On retire donc TOUT caractère blanc.

export type SupabasePublicEnv = { url: string; anonKey: string };

/** Valeurs nettoyées (sans aucun espace). undefined si vides/absentes. */
export function readSupabasePublicEnv(): { url?: string; anonKey?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s+/g, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, "");
  return { url: url || undefined, anonKey: anonKey || undefined };
}

/** Idem mais lève une erreur claire et nommée si une valeur est invalide. */
export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const { url, anonKey } = readSupabasePublicEnv();

  if (!url) {
    throw new Error(
      "Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL est vide ou absente. " +
        "Définis-la dans Vercel (Settings → Environment Variables, scope Production), " +
        "ex. https://xhjhdheskjwbmdjzazoq.supabase.co",
    );
  }
  if (!anonKey) {
    throw new Error(
      "Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_ANON_KEY est vide ou absente. " +
        "Définis-la dans Vercel (scope Production) avec la clé anon/publishable du projet.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Configuration Supabase invalide : NEXT_PUBLIC_SUPABASE_URL ("${url}") n'est pas une URL valide. ` +
        "Format attendu : https://<project-ref>.supabase.co (avec https://, sans espace ni guillemets).",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      `Configuration Supabase invalide : NEXT_PUBLIC_SUPABASE_URL doit commencer par https:// (reçu : "${url}").`,
    );
  }

  return { url, anonKey };
}
