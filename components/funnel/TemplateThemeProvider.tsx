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
    "family=Bebas+Neue",
    "family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600",
    "family=DM+Sans:wght@400;500;600;700",
    "family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500",
    "family=IBM+Plex+Mono:wght@400;500;600",
    "family=IBM+Plex+Sans:wght@400;500;600;700",
    "family=Inter:wght@400;500;600;700;800;900",
    "family=JetBrains+Mono:wght@400;500;600",
    "family=Lora:ital,wght@0,400;0,500;0,600;1,400",
    "family=Montserrat:wght@400;500;600;700;800",
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
  "editorial-warm",
  "aurora-glow",
  "mint-fresh",
  "cosmos-night",
  "sunset-coral",
  "neo-brutalist",
  "coaching-premium",
  "bold-energy",
  "premium-minimal",
  "sharp-launch",
  "trust-pro",
  "lead-snap",
  "story-sell",
  // 🆕 Nouveaux templates (identité CSS définie dans funnel-theme.css)
  "vsl-focus",
  "webinar-live",
  "showcase",
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
    /** 🆕 3ᵉ couleur de marque (design.accentColor) → var(--ff-accent2). */
    accent2?: string;
    /** 🆕 4ᵉ couleur de marque (design.accentColor2) → var(--ff-accent3). */
    accent3?: string;
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

  // 🆕 FIX : l'ancien effet d'animation posé ICI faisait doublon avec
  // `useScrollReveal` (hooks/useScrollReveal.ts), déjà branché par
  // FunnelPreview.tsx sur le conteneur englobant CHAQUE usage de ce provider
  // (seul consommateur dans tout le repo). Ce hook lit déjà l'attribut
  // `data-ff-animations` posé ci-dessous pour savoir si les animations sont
  // actives, gère lui-même `prefers-reduced-motion`, ET couvre en plus (ce que
  // l'effet ici ne faisait PAS) : le contenu qui apparaît APRÈS le montage
  // initial (changement de page, ajout de section dans l'éditeur) — l'ancien
  // effet ici avait ses dépendances figées sur [animationsEnabled, theme], donc
  // ne se ré-exécutait JAMAIS pour du contenu ajouté ensuite, qui restait sans
  // animation (voire bloqué à opacity:0 si le composant ne remonte pas). Deux
  // systèmes concurrents sur les mêmes classes CSS (ff-anim-ready/.ff-in)
  // n'apportaient rien et risquaient des états incohérents ; un seul suffit.

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
  // 🆕 FIX contraste (diagnostic navigateur, capture à l'appui — "Événement
  // Dark" affichait un texte bleu-nuit illisible sur son hero, alors que la
  // section "problem" juste en dessous était correcte) : `app/globals.css`
  // définit `--ff-brand-ink: #080E1A` au `:root` du DASHBOARD (couleur de
  // marque AutoFunnel AI pour l'UI de l'app — sidebar, boutons…), SANS
  // rapport avec la marque du TUNNEL. Le skin factory (factory.tsx,
  // `brandAware()`) consomme `var(--ff-brand-ink, <ink du template>)` en
  // supposant cette variable ABSENTE tant qu'aucune marque de tunnel n'est
  // active — mais comme le :root du dashboard la définit TOUJOURS, le
  // fallback `<ink du template>` ne se déclenche jamais : chaque section
  // pilotée par le skin factory (hero, cartes, témoignages, pricing, faq,
  // cta) héritait de ce bleu-nuit du dashboard au lieu de l'encre du
  // template. Invisible sur les templates clairs (bleu-nuit ≈ lisible sur
  // fond blanc, coïncidence), mais illisible sur les templates sombres
  // (bleu-nuit sur fond sombre : story-sell, etc.). On neutralise donc CETTE
  // fuite ICI, à la racine du tunnel : `initial` réinitialise la variable
  // pour tout le sous-arbre du tunnel, ce qui réactive le fallback du skin
  // factory. Le bloc plus bas (`if (overrides?.bg)`) reprend la main dessus
  // avec la VRAIE couleur de marque du tunnel quand elle est active.
  inlineVars["--ff-brand-ink"] = "initial";
  if (overrides?.primary) inlineVars["--ff-primary"] = overrides.primary;
  if (overrides?.accent) {
    inlineVars["--ff-accent"] = overrides.accent;
    // 🆕 Certains templates nommés figent --ff-btn-bg / --ff-btn-ink en dur
    // (au lieu de les dériver de --ff-accent) : on les repose explicitement
    // pour que le bouton CTA suive bien la couleur de marque choisie.
    inlineVars["--ff-btn-bg"] = "var(--ff-accent)";
    inlineVars["--ff-btn-ink"] = "var(--ff-accent-ink)";
  }
  if (overrides?.accent2) inlineVars["--ff-accent2"] = overrides.accent2;
  if (overrides?.accent3) inlineVars["--ff-accent3"] = overrides.accent3;
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

  // 🆕 Quand une couleur de fond de marque est active, on redérive TOUTE la
  // palette dépendante (surface, cartes, bandes de section, bordures) à
  // partir de --ff-bg/--ff-ink/--ff-accent — exactement les formules par
  // défaut de funnel-theme.css (color-mix). Sans ça, un template nommé qui
  // fige ces valeurs en dur (ex: coaching-premium, sunset-coral…) ignorait
  // silencieusement les couleurs de marque de l'utilisateur pour tout ce qui
  // n'est pas le titre/l'eyebrow. Les variables posées ici, inline sur
  // l'élément, gagnent toujours face aux règles [data-ff-template="…"].
  if (overrides?.bg) {
    inlineVars["--ff-surface"] = "color-mix(in srgb, var(--ff-ink) 4%, var(--ff-bg))";
    inlineVars["--ff-ink-soft"] = "color-mix(in srgb, var(--ff-ink) 78%, transparent)";
    inlineVars["--ff-muted"] = "color-mix(in srgb, var(--ff-ink) 55%, transparent)";
    inlineVars["--ff-border"] = "color-mix(in srgb, var(--ff-ink) 10%, transparent)";
    inlineVars["--ff-card-bg"] = "color-mix(in srgb, var(--ff-accent) 6%, var(--ff-surface))";
    inlineVars["--ff-card-border"] = "color-mix(in srgb, var(--ff-accent) 16%, transparent)";
    inlineVars["--ff-section-alt-1"] = "color-mix(in srgb, var(--ff-accent) 4%, var(--ff-bg))";
    inlineVars["--ff-section-alt-2"] = "color-mix(in srgb, var(--ff-accent) 7%, var(--ff-bg))";
    inlineVars["--ff-section-alt-border"] = "color-mix(in srgb, var(--ff-accent) 12%, transparent)";
    // 🆕 Header (brand-bar) et footer suivent maintenant aussi la marque —
    // signalé manquant par l'utilisateur ("le header et le footer aussi
    // doivent être pris en compte"). Bandeau légèrement plus sombre/clair que
    // le fond pour rester distinct, texte via le même contraste automatique.
    inlineVars["--ff-brand-bar-bg"] = "color-mix(in srgb, var(--ff-ink) 6%, var(--ff-bg))";
    inlineVars["--ff-brand-bar-ink"] = "var(--ff-ink)";
    inlineVars["--ff-footer-bg"] = "color-mix(in srgb, var(--ff-ink) 8%, var(--ff-bg))";
    inlineVars["--ff-footer-ink"] = "color-mix(in srgb, var(--ff-ink) 65%, transparent)";
    inlineVars["--ff-footer-business-ink"] = "var(--ff-ink)";

    // 🆕 SKINS (bold-energy, clean-light, premium-minimal, trust-pro, lead-snap,
    // story-sell…) : leurs tokens figent le texte/les cartes EN DUR (ink #000,
    // body #4B4B4B, cardBg #fff…) et ignoraient donc les couleurs de marque →
    // texte foncé illisible sur un fond de marque sombre. Ces variables
    // `--ff-brand-*` ne sont posées QUE lorsqu'une vraie couleur de marque est
    // active ; les tokens des skins les consomment avec le défaut du template en
    // repli (`var(--ff-brand-ink, #000)`), donc les tunnels SANS marque restent
    // strictement identiques, et ceux AVEC marque héritent du contraste correct.
    inlineVars["--ff-brand-ink"] = "var(--ff-ink)";
    inlineVars["--ff-brand-body"] = "color-mix(in srgb, var(--ff-ink) 72%, transparent)";
    inlineVars["--ff-brand-muted"] = "color-mix(in srgb, var(--ff-ink) 50%, transparent)";
    inlineVars["--ff-brand-card-bg"] = "var(--ff-card-bg)";
    inlineVars["--ff-brand-card-border"] = "var(--ff-card-border)";
  }

  const customBgActive = Boolean(overrides?.customBgEnabled && overrides.customBg);
  // 🆕 FIX RÉGRESSION : n'active le bloc d'override CSS (funnel-theme.css,
  // "BRANDING UTILISATEUR") QUE quand une vraie couleur de marque a été posée
  // (overrides.bg vient de FunnelPreview, lui-même gardé par
  // design.brandColorsEnabled). Auparavant posé INCONDITIONNELLEMENT : le
  // bloc CSS remplaçait alors le fond dégradé signature de templates comme
  // bold-energy/story-sell par une couleur plate même SANS branding actif.
  const brandedActive = Boolean(overrides?.bg);

  return (
    <div
      ref={rootRef}
      // .ff-page  : compat avec l'export SIO et theme-css.ts
      // data-ff-theme    : utilisé par theme-css.ts (export SIO)
      // data-ff-template : utilisé par funnel-theme.css (preview AutoFunnel)
      // Les deux coexistent sans conflit : chaque CSS cible son propre sélecteur.
      className={`ff-page${className ? ` ${className}` : ""}`}
      data-ff-theme={theme}
      data-ff-template={theme}
      data-ff-btn-anim={normalizedBtnAnim}
      data-ff-animations={animationsEnabled ? "on" : "off"}
      data-ff-custom-bg={customBgActive ? "true" : "false"}
      // 🆕 Accroche de spécificité CSS (funnel-theme.css, bloc "BRANDING
      // UTILISATEUR") : certains templates codent EN DUR le fond de section
      // (`background:` littéral) et la couleur du CTA (`!important` + hex fixe)
      // au lieu de dériver de var(--ff-bg)/var(--ff-btn-bg). N'est posé QUE
      // quand une vraie couleur de marque est active (brandedActive) — sinon
      // le template garde son identité par défaut intacte (dégradés inclus).
      data-ff-branded={brandedActive ? "true" : undefined}
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
