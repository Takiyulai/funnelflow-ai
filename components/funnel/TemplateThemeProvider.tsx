"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  templateId?: string | null;
  /** Animation par défaut des boutons : lift | glow | pulse | shine */
  buttonAnim?: "lift" | "glow" | "pulse" | "shine";
  /** Si false → désactive toutes les animations */
  animationsEnabled?: boolean;
  /** Couleurs personnalisées qui surchargent celles du template */
  overrides?: {
    primary?: string;
    accent?: string;
    accentInk?: string;
    bg?: string;
    ink?: string;
  };
  className?: string;
  children: ReactNode;
};

/**
 * Wrapper qui pose data-ff-template + data-ff-btn-anim + data-ff-animations
 * et qui anime les éléments [data-ff-anim] quand ils entrent dans le viewport.
 *
 * Tous les composants à l'intérieur héritent automatiquement des CSS variables
 * définies dans app/funnel-theme.css.
 */
export function TemplateThemeProvider({
  templateId,
  buttonAnim = "lift",
  animationsEnabled = true,
  overrides,
  className,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // IntersectionObserver pour révéler [data-ff-anim] au scroll
    const targets = root.querySelectorAll<HTMLElement>("[data-ff-anim]");
    if (targets.length === 0) return;

    // Si l'utilisateur préfère réduire les animations, on rend tout visible immédiatement
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || !animationsEnabled) {
      targets.forEach((el) => el.classList.add("ff-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("ff-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [animationsEnabled, templateId]);

  // Construction des styles inline pour les overrides (jamais hardcodés)
  const inlineVars: Record<string, string> = {};
  if (overrides?.primary) inlineVars["--ff-primary"] = overrides.primary;
  if (overrides?.accent) inlineVars["--ff-accent"] = overrides.accent;
  if (overrides?.accentInk) inlineVars["--ff-accent-ink"] = overrides.accentInk;
  if (overrides?.bg) inlineVars["--ff-bg"] = overrides.bg;
  if (overrides?.ink) inlineVars["--ff-ink"] = overrides.ink;

  return (
    <div
      ref={rootRef}
      data-ff-template={templateId ?? "default"}
      data-ff-btn-anim={buttonAnim}
      data-ff-animations={animationsEnabled ? "on" : "off"}
      className={className}
      style={inlineVars as React.CSSProperties}
    >
      {children}
    </div>
  );
}
