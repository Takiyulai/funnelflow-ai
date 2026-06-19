import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";

// 🆕 Singleton : on NE recrée PAS un client à chaque appel. Plusieurs instances
// se disputent le verrou navigator.locks du token d'auth ("Lock not released
// within 5000ms" → "Failed to fetch" dans getUser), ce qui faisait échouer les
// écritures (publication/suppression) avec « Non connecté à Supabase ».
// Un client unique partagé règle la contention de verrou.
type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | undefined;

export function createSupabaseBrowserClient(): BrowserClient {
  if (browserClient) return browserClient;

  // Lecture + nettoyage (retire tout espace/retour-ligne) + validation claire.
  // Centralisé dans lib/supabase/env.ts (partagé client/serveur/middleware).
  const { url, anonKey } = requireSupabasePublicEnv();

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
