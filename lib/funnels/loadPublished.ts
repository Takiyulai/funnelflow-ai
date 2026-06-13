// lib/funnels/loadPublished.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";

export type PublishedFunnel = { funnel: ReturnType<typeof normalizeFunnel>; name: string };

export async function getPublishedFunnelBySlug(
  slug: string,
): Promise<PublishedFunnel | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("funnels")
    .select("name, published_content, status")
    .eq("published_slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data || !data.published_content) return null;
  return { funnel: normalizeFunnel(data.published_content), name: data.name };
}
