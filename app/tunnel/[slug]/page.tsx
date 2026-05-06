// app/tunnel/[slug]/page.tsx
import { demoFunnel } from "@/lib/funnels/demo";
import type { Funnel } from "@/lib/funnels/types";
import { PublicFunnelClient } from "@/components/funnel/PublicFunnelClient";
import { PublicFunnelView } from "@/components/funnel/PublicFunnelView";

// Slugs résolus côté serveur (statiques / démo)
const SERVER_FUNNELS: Record<string, Funnel> = {
  demo: demoFunnel,
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TunnelPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const funnel = SERVER_FUNNELS[slug];

  // Slug serveur (demo) : on rend tout côté serveur
  if (funnel) {
    return <PublicFunnelView funnel={funnel} />;
  }

  // Slug inconnu côté serveur : on délègue au client qui lira localStorage
  return <PublicFunnelClient slug={slug} />;
}
