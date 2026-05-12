"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  templateId?: string | null;
  buttonAnim?: "lift" | "glow" | "pulse" | "shine";
  animationsEnabled?: boolean;
  overrides?: {
    primary?: string;
    accent?: string;
    accentInk?: string;
    bg?: string;
    ink?: string;
    /** Multiplicateur taille du texte (1 = défaut) */
    textScale?: number;
    /** Multiplicateur taille des boutons (1 = défaut) */
    buttonScale?: number;
    /** Couleur de fond personnalisée (templates clean) */
    customBg?: string;
    /** Active la couleur de fond personnalisée */
    customBgEnabled?: boolean;
  };
  className?: string;
  children: ReactNode;
};

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

    const targets = root.querySelectorAll<HTMLElement>("[data-ff-anim]");
    if (targets.length === 0) return;

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

  // ─── Variables CSS injectées au root du template ───────────────
  const inlineVars: Record<string, string> = {};
  if (overrides?.primary)   inlineVars["--ff-primary"]    = overrides.primary;
  if (overrides?.accent)    inlineVars["--ff-accent"]     = overrides.accent;
  if (overrides?.accentInk) inlineVars["--ff-accent-ink"] = overrides.accentInk;
  if (overrides?.bg)        inlineVars["--ff-bg"]         = overrides.bg;
  if (overrides?.ink)       inlineVars["--ff-ink"]        = overrides.ink;

  // Lot 3 : multiplicateurs et fond custom
  if (typeof overrides?.textScale === "number") {
    inlineVars["--ff-text-scale"] = String(clamp(overrides.textScale, 0.85, 1.25));
  }
  if (typeof overrides?.buttonScale === "number") {
    inlineVars["--ff-btn-scale"] = String(clamp(overrides.buttonScale, 0.85, 1.25));
  }
  if (overrides?.customBgEnabled && overrides.customBg) {
    inlineVars["--ff-custom-bg"] = overrides.customBg;
  }

  const customBgActive = Boolean(
    overrides?.customBgEnabled && overrides.customBg
  );

  return (
    <div
      ref={rootRef}
      data-ff-template={templateId ?? "default"}
      data-ff-btn-anim={buttonAnim}
      data-ff-animations={animationsEnabled ? "on" : "off"}
      data-ff-custom-bg={customBgActive ? "true" : "false"}
      className={`ff-template-root ${className ?? ""}`}
      style={inlineVars as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(max, Math.max(min, n));
}
