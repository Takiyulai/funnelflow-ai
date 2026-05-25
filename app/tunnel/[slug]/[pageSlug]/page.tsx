// app/tunnel/[slug]/[pageSlug]/page.tsx
import { demoFunnel } from "@/lib/funnels/demo";
import type { Funnel } from "@/lib/funnels/types";
import { PublicFunnelClient } from "@/components/funnel/PublicFunnelClient";
import { PublicFunnelView } from "@/components/funnel/PublicFunnelView";

// Slugs résolus côté serveur (statiques / démo)
const SERVER_FUNNELS: Record<string, Funnel> = {
  demo: demoFunnel,
};

type PageProps = {
  params: Promise<{ slug: string; pageSlug: string }>;
};

/**
 * 🆕 Normalise le pageSlug reçu depuis l'URL.
 * Next.js peut transmettre "merci", "/merci" (encodage exotique), ou
 * un slug avec des "/" parasites si jamais le routing change. On nettoie
 * systématiquement pour garantir un matching robuste avec funnel.pages[].slug.
 */
function normalizeIncomingPageSlug(raw: string): string {
  return decodeURIComponent(raw ?? "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .trim();
}

export default async function TunnelSecondaryPage({ params }: PageProps) {
  const { slug, pageSlug } = await params;
  const cleanPageSlug = normalizeIncomingPageSlug(pageSlug);
  const funnel = SERVER_FUNNELS[slug];

  // Slug serveur (demo) : rendu serveur direct
  if (funnel) {
    return <PublicFunnelView funnel={funnel} activePageSlug={cleanPageSlug} />;
  }

  // Slug client : on délègue au client (lecture localStorage)
  return <PublicFunnelClient slug={slug} activePageSlug={cleanPageSlug} />;
}
