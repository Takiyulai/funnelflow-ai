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
        // ─── Palette FunnelFlow AI (source de vérité) ─────────────────────
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
      boxShadow: {
        sm: "0 1px 2px rgba(15, 23, 42, 0.04)",
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        elevated: "0 8px 24px rgba(15, 23, 42, 0.08)",
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
