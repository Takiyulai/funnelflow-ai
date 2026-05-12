"use client";

import type { Funnel } from "@/lib/funnels/types";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";

type Props = {
  funnel: Funnel;
};

/**
 * Vue publique du tunnel — affichée sur /tunnel/[slug].
 *
 * Utilise FunnelPreview en mode "raw" qui rend le tunnel pleine largeur,
 * sans frame, sans toolbar, sans scroll-container. Le tunnel s'intègre
 * directement dans le flux du document, exactement comme un vrai site.
 */
export function PublicFunnelView({ funnel }: Props) {
  const logoSrc = (funnel.meta as any)?.logoUrl as string | undefined;

  return (
    <main className="min-h-screen w-full">
      <FunnelPreview
        funnel={funnel}
        forcedMode="raw"
        showToolbar={false}
        viewportHeight="auto"
        logoSrc={logoSrc}
      />
    </main>
  );
}
