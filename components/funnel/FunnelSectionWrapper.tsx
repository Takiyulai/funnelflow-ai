"use client";

import { useRef, type ReactNode } from "react";
import { useFunnelAnimations } from "@/hooks/useFunnelAnimations";

/**
 * Conteneur des templates bespoke : applique le runtime d'animations
 * (reveal/tilt/parallax/accordéon/countdown) à tout son sous-arbre, et sert de
 * CONTENEUR de requête (container-type: inline-size) pour que les @container
 * du template répondent à la largeur réelle (aperçu wizard OU page publiée).
 */
export function FunnelSectionWrapper({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFunnelAnimations(ref);
  return (
    <div
      ref={ref}
      className={className}
      style={{ containerType: "inline-size", width: "100%" }}
    >
      {children}
    </div>
  );
}

export default FunnelSectionWrapper;
