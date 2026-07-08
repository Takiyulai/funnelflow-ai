// app/tunnel/[slug]/page.tsx — page d'entrée (home) du funnel publié
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { getHomePage } from "@/lib/funnels/types";
import PublishedFunnelView from "./PublishedFunnelView";

// 🆕 Chantier 3 — caching : page PUBLIQUE identique pour tous → ISR + revalidation
// ON-DEMAND à la publication (cf. funnelRepository). Fenêtre portée à 300s : une
// fois la page en cache, les visiteurs la reçoivent en ~300ms (mesuré) sans
// retoucher la base ; la régénération se fait en arrière-plan (stale-while-
// revalidate). Le seul cas lent restant = le TOUT PREMIER rendu quand la base
// Supabase (offre gratuite) sort de veille (cold start ~15s) — mitigé côté infra
// (garder la base active / plan supérieur), pas par le cache applicatif.
// 🆕 Fenêtre ISR ramenée de 300s à 60s : si la revalidation on-demand à la
// publication échoue (session expirée → /api/revalidate-tunnel renvoie 401),
// la page se régénère au pire en 60s au lieu de 5 min. Le rendu reste rapide
// (stale-while-revalidate : le visiteur reçoit la version en cache pendant la
// régénération en arrière-plan).
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
