import { createBrowserClient } from "@supabase/ssr";

// 🆕 Singleton : on NE recrée PAS un client à chaque appel. Plusieurs instances
// se disputent le verrou navigator.locks du token d'auth ("Lock not released
// within 5000ms" → "Failed to fetch" dans getUser), ce qui faisait échouer les
// écritures (publication/suppression) avec « Non connecté à Supabase ».
// Un client unique partagé règle la contention de verrou.
type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | undefined;

export function createSupabaseBrowserClient(): BrowserClient {
  if (browserClient) return browserClient;

  // On trim : un retour à la ligne ou un espace collé dans Vercel suffit à
  // rendre l'URL invalide → fetch échoue avec "Invalid value".
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw new Error(
      "Configuration Supabase manquante : la variable NEXT_PUBLIC_SUPABASE_URL est vide ou absente. " +
        "Définis-la dans Vercel (Settings → Environment Variables, scope Production) avec l'URL de ton projet, " +
        "ex. https://xhjhdheskjwbmdjzazoq.supabase.co",
    );
  }
  if (!anonKey) {
    throw new Error(
      "Configuration Supabase manquante : la variable NEXT_PUBLIC_SUPABASE_ANON_KEY est vide ou absente. " +
        "Définis-la dans Vercel (Settings → Environment Variables, scope Production) avec la clé anon/publishable du projet.",
    );
  }

  // Validation explicite de l'URL pour transformer le "Failed to execute
  // 'fetch' on 'Window': Invalid value" obscur en message lisible (cas d'un
  // https:// oublié, d'un espace, de guillemets, ou d'un placeholder).
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

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
