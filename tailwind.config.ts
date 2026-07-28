// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ═══ 🆕 SYSTÈME DE JETONS — voir l'en-tête de app/globals.css ═══
        //
        // Règle : les gris construisent la hiérarchie, l'accent la ponctue,
        // les couleurs sémantiques signalent un état. Rien d'autre.
        //
        // ⚠️ Nommé `ash` et non `neutral`/`slate` pour ne PAS écraser les
        // palettes natives de Tailwind (ce qui casserait tout code existant
        // utilisant bg-neutral-* ou text-slate-*).
        ash: {
          0: "var(--ash-0)",
          25: "var(--ash-25)",
          50: "var(--ash-50)",
          100: "var(--ash-100)",
          200: "var(--ash-200)",
          300: "var(--ash-300)",
          400: "var(--ash-400)",
          500: "var(--ash-500)",
          600: "var(--ash-600)",
          700: "var(--ash-700)",
          800: "var(--ash-800)",
          900: "var(--ash-900)",
          950: "var(--ash-950)",
        },

        // Accent UNIQUE. `accent` = aplats/bordures ; `accent-ink` = TEXTE sur
        // fond clair (l'or clair échoue le contraste WCAG sur blanc).
        accent: {
          DEFAULT: "var(--ff-accent)",
          ink: "var(--ff-accent-ink)",
          soft: "var(--ff-accent-soft)",
          contrast: "var(--ff-accent-contrast)",
        },

        // Sémantique : ÉTAT uniquement, jamais décoratif, jamais un CTA.
        success: {
          DEFAULT: "var(--ff-success)",
          ink: "var(--ff-success-ink)",
          soft: "var(--ff-success-soft)",
        },
        warning: {
          DEFAULT: "var(--ff-warning)",
          ink: "var(--ff-warning-ink)",
          soft: "var(--ff-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--ff-danger)",
          ink: "var(--ff-danger-ink)",
          soft: "var(--ff-danger-soft)",
        },
        info: {
          DEFAULT: "var(--ff-info)",
          ink: "var(--ff-info-ink)",
          soft: "var(--ff-info-soft)",
        },

        // ─── Palette AutoFunnel AI (source de vérité) ─────────────────────
        // Couleurs marketing utilisées dans la landing
        brand: {
          ink: "#080E1A",        // fond profond landing
          surface: "#0D1628",    // surface sombre landing
          green: "#31845C",      // vert signature (succès, validation)
          gold: "#C7A436",       // or signature (CTA, accents)
          blue: "#08498D",       // bleu signature (info, profondeur)
        },

        // ─── Palette dashboard (clair, dense, utilitaire) ─────────────────
        // 🆕 Tokens pilotés par variables CSS → mode dark/light (cf. :root et
        // .ff-theme-dark dans globals.css). Valeurs claires identiques à
        // l'origine : aucun changement visuel en mode clair.
        ink: "var(--ff-ink)",        // texte principal
        muted: "var(--ff-muted)",    // texte secondaire
        line: "var(--ff-line)",      // bordures
        canvas: "var(--ff-canvas)",  // fond doux
        surface: "var(--ff-surface)",// fond cartes

        // Couleurs d'action dashboard (alignées sur la landing)
        navy: "#08498D",         // bleu accent dashboard
        gold: "#C7A436",         // CTA primaire
        green: "#31845C",        // succès
        red: "#DC2626",          // erreur

        // Variantes douces pour fonds et badges
        softBlue: "#E8F1FB",
        lightGold: "#FAF3D9",
        softGreen: "#E5F1EB",

        // ─── Aliases descendants (compatibilité ancien code) ──────────────
        // Conservés pour ne rien casser, mappés sur la nouvelle palette
        abaBlack: "#080E1A",
        abaGold: "#C7A436",
        abaGoldDeep: "#A8881F",
        abaWhite: "#F8FAFC",
        abaNavy: "#0D1628",
        abaBlue: "#08498D",
        abaEmerald: "#31845C",
        abaCyan: "#28D6D6",
        deep: "#080E1A",
      },
      // 🆕 DEUX niveaux d'élévation réels, au lieu de six.
      // Les six anciens noms sont conservés — donc rien ne casse — mais ils
      // pointent désormais sur l'un des deux niveaux. Six profondeurs dans une
      // interface d'outil, l'œil ne les distingue pas : ça ne produit pas de
      // la richesse, ça produit du flou.
      // `premium`, `gold` et `dark` restent distincts : ils servent la LANDING
      // (surfaces sombres, mise en scène marketing), pas l'interface.
      boxShadow: {
        sm: "var(--ff-elev-1)",
        card: "var(--ff-elev-1)",
        elevated: "var(--ff-elev-2)",
        premium: "0 18px 55px rgba(8, 73, 141, 0.10)",
        gold: "0 12px 32px rgba(199, 164, 54, 0.20)",
        dark: "0 24px 64px rgba(8, 14, 26, 0.30)",
      },
      borderRadius: {
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
      },
      keyframes: {
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        rise: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        sheen: "sheen 4.5s ease-in-out infinite",
        rise: "rise 5s ease-in-out infinite",
        pulseSoft: "pulseSoft 1.4s ease-in-out infinite",
      },
      fontFamily: {
        sans: ['"DM Sans"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Bebas Neue"', '"DM Sans"', "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
