"use client";

import { useEffect, useState } from "react";
import type { SectionBackground } from "@/lib/funnels/types";
import { getMedia, IDB_MEDIA_PREFIX } from "@/lib/store/mediaStore";

type Props = {
  background?: SectionBackground;
  children: React.ReactNode;
  /** Permet de passer une className au wrapper (pour conserver les classes
   *  Tailwind appliquées par la section elle-même : padding, max-width, etc.) */
  className?: string;
  /** Style additionnel injecté sur le wrapper (couleur de fond de la section
   *  par exemple, pour servir de "filet de sécurité" sous l'image). */
  style?: React.CSSProperties;
};

export default function SectionBackgroundLayer({
  background,
  children,
  className,
  style,
}: Props) {
  const initialUrl = background?.imageUrl;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    initialUrl && !initialUrl.startsWith(IDB_MEDIA_PREFIX) ? initialUrl : undefined,
  );

  // Résolution async des références idb-media:// → data:image/...
  useEffect(() => {
    let cancelled = false;
    const url = background?.imageUrl;
    if (!url) {
      setResolvedUrl(undefined);
      return;
    }
    if (!url.startsWith(IDB_MEDIA_PREFIX)) {
      setResolvedUrl(url);
      return;
    }
    const id = url.slice(IDB_MEDIA_PREFIX.length);
    getMedia(id)
      .then((dataUrl) => {
        if (!cancelled) setResolvedUrl(dataUrl ?? undefined);
      })
      .catch((err) => {
        console.warn("[SectionBackgroundLayer] getMedia échec:", err);
        if (!cancelled) setResolvedUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [background?.imageUrl]);

  const hasImage = !!resolvedUrl;
  const overlayOpacity = Math.min(100, Math.max(0, background?.overlayOpacity ?? 0));
  const hasOverlay = overlayOpacity > 0;

  // Si ni image ni voile, on rend le contenu sans wrapper supplémentaire
  if (!hasImage && !hasOverlay) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  const position = background?.position ?? "center";
  const size = background?.size ?? "cover";
  const attachment = background?.attachment ?? "scroll";
  const blur = Math.min(20, Math.max(0, background?.blur ?? 0));
  const overlayColor = background?.overlayColor ?? "#000000";

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}
    >
      {/* Calque image */}
      {hasImage && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${resolvedUrl}")`,
            backgroundSize: size,
            backgroundPosition: position,
            backgroundRepeat: "no-repeat",
            backgroundAttachment: attachment,
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
            transform: blur > 0 ? "scale(1.05)" : undefined,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Voile (overlay) */}
      {hasOverlay && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: overlayColor,
            opacity: overlayOpacity / 100,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Contenu */}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}
