"use client";

import type { FunnelSection } from "@/lib/funnels/types";
import { SectionRenderer } from "@/components/funnel/SectionRenderer";
import { getVideoEmbed } from "@/lib/funnels/video";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type Props = {
  sections: FunnelSection[];
  /** Conservé pour rétro-compatibilité ; les couleurs viennent désormais du thème CSS */
  accent?: string;
  dark?: string;
};

/**
 * Rendu animé de la liste des sections du tunnel public.
 * Délègue le rendu visuel à SectionRenderer (centralisé, thémisé).
 * Le hook useScrollReveal gère uniquement les animations au scroll.
 */
export function FunnelSectionsAnimated({ sections }: Props) {
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={containerRef}>
      {sections.map((section) => {
        // Pré-calcul de l'URL d'embed vidéo (YouTube/Vimeo/etc.)
        const videoEmbedUrl = section.video?.url
          ? getVideoEmbed(section.video.url).embedUrl
          : null;

        return (
          <SectionRenderer
            key={section.id}
            section={section}
            mode="public"
            videoEmbedUrl={videoEmbedUrl}
          />
        );
      })}
    </div>
  );
}
