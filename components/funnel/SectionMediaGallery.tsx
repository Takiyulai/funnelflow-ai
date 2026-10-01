"use client";

import type { SectionMedia } from "@/lib/funnels/types";
import { getVideoEmbed } from "@/lib/funnels/video";

export function SectionMediaGallery({ medias }: { medias?: SectionMedia[] }) {
  const visible = (medias ?? []).filter((media) => media.url?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="ff-section-media-gallery" data-ff-media-gallery="true">
      {visible.map((media, index) => {
        const url = media.url.trim();
        const animationDelay = `${Math.min(index, 8) * 90}ms`;
        if (media.kind === "image") {
          return (
            <figure
              key={media.id}
              className="ff-section-media-item"
              data-ff-anim="fade-up"
              style={{ animationDelay }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={media.alt ?? ""} loading="lazy" />
            </figure>
          );
        }

        const parsed = getVideoEmbed(url);
        if (!parsed.embedUrl) return null;
        return (
          <div
            key={media.id}
            className="ff-section-media-item"
            data-ff-anim="fade-up"
            style={{ animationDelay }}
          >
            {parsed.kind === "file" ? (
              <video controls preload="metadata" poster={media.posterUrl}>
                <source src={parsed.embedUrl} />
              </video>
            ) : (
              <iframe
                src={parsed.embedUrl}
                title={media.alt || "Vidéo"}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
