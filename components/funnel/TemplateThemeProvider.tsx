"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Google Fonts — chargées UNIQUEMENT côté preview (jamais dans l'export SIO).
// Le <link> est injecté une seule fois par session dans <head>, idempotent.
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Archivo+Black",
    "family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600",
    "family=DM+Sans:wght@400;500;600;700",
    "family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500",
    "family=IBM+Plex+Mono:wght@400;500;600",
    "family=IBM+Plex+Sans:wght@400;500;600;700",
    "family=Inter:wght@400;500;600;700;800;900",
    "family=JetBrains+Mono:wght@400;500;600",
    "family=Lora:ital,wght@0,400;0,500;0,600;1,400",
    "family=Playfair+Display:wght@400;500;600;700",
    "family=Sora:wght@400;500;600;700;800",
    "family=Space+Grotesk:wght@400;500;600;700",
  ].join("&") +
  "&display=swap";

const GOOGLE_FONTS_PRECONNECT = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

function ensureGoogleFontsLoaded(): void {
  if (typeof document === "undefined") return;

  // Idempotent : un seul <link> par document.
  if (document.querySelector('link[data-ff-google-fonts="true"]')) return;

  // Preconnects pour accélérer le chargement.
  GOOGLE_FONTS_PRECONNECT.forEach((href, idx) => {
    if (document.querySelector(`link[data-ff-google-preconnect="${idx}"]`)) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = href;
    if (idx === 1) pre.crossOrigin = "anonymous";
    pre.setAttribute("data-ff-google-preconnect", String(idx));
    document.head.appendChild(pre);
  });

  // Stylesheet principale.
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_HREF;
  link.setAttribute("data-ff-google-fonts", "true");
  document.head.appendChild(link);
}

// ─────────────────────────────────────────────────────────────────────────────
// Liste blanche des thèmes (alignée sur theme-css.ts)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_THEMES = [
  "clean-light",
  "clean-dark",
  "coaching-premium",
  "bold-energy",
  "premium-minimal",
  "sharp-launch",
  "trust-pro",
  "lead-snap",
  "story-sell",
] as const;

type ThemeId = (typeof ALLOWED_THEMES)[number];

function normalizeTheme(id: string | null | undefined): ThemeId {
  if (id && (ALLOWED_THEMES as readonly string[]).includes(id)) {
    return id as ThemeId;
  }
  return "clean-light";
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  templateId?: string | null;
  /** Animation du hover sur les boutons. "pulse" et "shine" → fallback "lift" en CSS. */
  buttonAnim?: "lift" | "glow" | "pulse" | "shine" | "none";
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

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function TemplateThemeProvider({
  templateId,
  buttonAnim = "lift",
  animationsEnabled = true,
  overrides,
  className,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const theme = normalizeTheme(templateId);

  // ─── Charger les Google Fonts (preview uniquement, jamais en export) ─────
  useEffect(() => {
    ensureGoogleFontsLoaded();
  }, []);

  // ─── Animations : pose .ff-anim-ready puis observe les [data-ff-anim] ────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Si animations désactivées ou reduce-motion : tout visible, pas de flag.
    if (!animationsEnabled || prefersReduced) {
      root.classList.remove("ff-anim-ready");
      root.querySelectorAll<HTMLElement>("[data-ff-anim]").forEach((el) => {
        el.classList.add("ff-in");
      });
      return;
    }

    // 1. Marquer le root prêt : les éléments passent alors à opacity:0 + transform initial.
    //    (Si le JS ne s'exécute jamais — éditeur SIO sans JS — la classe n'est pas posée
    //     et le contenu reste visible par défaut. Sécurité maximale.)
    root.classList.add("ff-anim-ready");

    // 2. Observer les éléments pour leur ajouter .ff-in au scroll.
    const targets = root.querySelectorAll<HTMLElement>("[data-ff-anim]");
    if (targets.length === 0) return;

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
    return () => {
      io.disconnect();
      root.classList.remove("ff-anim-ready");
    };
  }, [animationsEnabled, theme]);

  // ─── Normalisation buttonAnim : seuls "lift" et "glow" sont gérés en CSS.
  //     Les valeurs legacy "pulse" / "shine" tombent sur "lift".
  const normalizedBtnAnim: "lift" | "glow" | "none" =
    buttonAnim === "glow"
      ? "glow"
      : buttonAnim === "none"
        ? "none"
        : "lift";

  // ─── Variables CSS injectées au root ─────────────────────────────────────
  const inlineVars: Record<string, string> = {};
  if (overrides?.primary) inlineVars["--ff-primary"] = overrides.primary;
  if (overrides?.accent) inlineVars["--ff-accent"] = overrides.accent;
  if (overrides?.accentInk) inlineVars["--ff-accent-ink"] = overrides.accentInk;
  if (overrides?.bg) inlineVars["--ff-bg"] = overrides.bg;
  if (overrides?.ink) inlineVars["--ff-ink"] = overrides.ink;

  if (typeof overrides?.textScale === "number") {
    inlineVars["--ff-text-scale"] = String(clamp(overrides.textScale, 0.85, 1.25));
  }
  if (typeof overrides?.buttonScale === "number") {
    inlineVars["--ff-btn-scale"] = String(clamp(overrides.buttonScale, 0.85, 1.25));
  }
  if (overrides?.customBgEnabled && overrides.customBg) {
    inlineVars["--ff-custom-bg"] = overrides.customBg;
  }

  const customBgActive = Boolean(overrides?.customBgEnabled && overrides.customBg);

  return (
    <div
      ref={rootRef}
      // .ff-page  : compat avec l'export SIO et theme-css.ts
      // data-ff-theme    : utilisé par theme-css.ts (export SIO)
      // data-ff-template : utilisé par funnel-theme.css (preview FunnelFlow)
      // Les deux coexistent sans conflit : chaque CSS cible son propre sélecteur.
      className={`ff-page${className ? ` ${className}` : ""}`}
      data-ff-theme={theme}
      data-ff-template={theme}
      data-ff-btn-anim={normalizedBtnAnim}
      data-ff-animations={animationsEnabled ? "on" : "off"}
      data-ff-custom-bg={customBgActive ? "true" : "false"}
      style={inlineVars as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(max, Math.max(min, n));
}
