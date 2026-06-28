// app/tunnel/[slug]/page.tsx — page d'entrée (home) du funnel publié
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { getHomePage } from "@/lib/funnels/types";
import PublishedFunnelView from "./PublishedFunnelView";

// 🆕 Chantier 3 — caching : page PUBLIQUE identique pour tous → ISR (revalidée
// toutes les 60s) + revalidation ON-DEMAND à la publication (cf. funnelRepository).
export const revalidate = 60;

export default async function PublishedFunnelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const published = await getPublishedFunnelBySlug(slug);
  if (!published) notFound();

  // 🆕 Rendu unifié via FunnelPreview (parité exacte avec l'aperçu).
  const home = getHomePage(published.funnel);
  return <PublishedFunnelView funnel={published.funnel} activePage={home} />;
}
