"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";
import { SectionRenderer } from "@/components/funnel/SectionRenderer";
import type { FunnelSection } from "@/lib/funnels/types";

type Props = {
  sections: FunnelSection[];
  mode?: "preview" | "public";
};

function getEmbedSrc(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

export function FunnelSectionsClient({ sections, mode = "public" }: Props) {
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={containerRef}>
      {sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          mode={mode}
          videoEmbedUrl={getEmbedSrc(section.video?.url)}
        />
      ))}
    </div>
  );
}
