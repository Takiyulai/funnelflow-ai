// lib/funnels/loadPublished.ts
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";

export type PublishedFunnel = { funnel: ReturnType<typeof normalizeFunnel>; name: string };

/**
 * Charge un tunnel PUBLIÉ par son slug public, pour la page publique
 * `/tunnel/[slug]` consultée par des VISITEURS NON AUTHENTIFIÉS.
 *
 * ⚠️ On lit via le client admin (service role) car la RLS sur `funnels`
 * n'autorise que le propriétaire (`auth.uid() = user_id`) ; un visiteur
 * anonyme via le client serveur normal était donc bloqué → la page publique
 * renvoyait 404 alors que le tunnel était bien publié. On n'expose que les
 * colonnes nécessaires et uniquement les lignes `status = 'published'`.
 */
export async function getPublishedFunnelBySlug(
  slug: string,
): Promise<PublishedFunnel | null> {
  const supabase = getSupabaseAdmin();

  // 1) Slug public officiel.
  let { data } = await supabase
    .from("funnels")
    .select("name, published_content, status")
    .eq("published_slug", slug)
    .eq("status", "published")
    .maybeSingle();

  // 2) Repli : certains tunnels publiés tôt n'ont pas de published_slug distinct
  //    du slug brouillon. On tente alors par `slug`.
  if (!data) {
    const byDraft = await supabase
      .from("funnels")
      .select("name, published_content, status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    data = byDraft.data;
  }

  if (!data || !data.published_content) return null;
  return { funnel: normalizeFunnel(data.published_content), name: data.name };
}
