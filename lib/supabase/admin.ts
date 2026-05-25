// lib/supabase/admin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase serveur avec service_role.
 *
 * ⚠️ Ne JAMAIS importer ce module depuis un composant client.
 * ⚠️ Bypasse RLS : à utiliser uniquement pour les opérations
 *    serveur où vous avez déjà validé l'autorisation.
 *
 * Usage typique :
 *   - /api/leads (insertion publique côté tunnel publié)
 *   - /api/leads/export (lecture CSV après vérif user)
 */
let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises côté serveur."
    );
  }

  cachedAdmin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "funnelflow-admin",
      },
    },
  });

  return cachedAdmin;
}
