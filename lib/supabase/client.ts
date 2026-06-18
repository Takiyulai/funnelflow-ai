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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requises."
    );
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
