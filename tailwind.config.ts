import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: "#082B4C",
        gold: "#F4C542",
        abaBlack: "#05070B",
        abaGold: "#FFD84D",
        abaGoldDeep: "#D8A928",
        abaWhite: "#FFFDF4",
        abaNavy: "#061B36",
        abaBlue: "#0069B4",
        abaEmerald: "#1ECB83",
        abaCyan: "#28D6D6",
        green: "#35B779",
        deep: "#0B1F3A",
        softBlue: "#EAF3FF",
        lightGold: "#FFF6D8",
        canvas: "#F8FAFC",
        ink: "#101828",
        muted: "#667085",
        line: "#E5E7EB"
      },
      boxShadow: {
        premium: "0 18px 55px rgba(8, 43, 76, 0.12)",
        gold: "0 22px 70px rgba(255, 216, 77, 0.22)",
        dark: "0 30px 90px rgba(5, 7, 11, 0.32)"
      },
      keyframes: {
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        },
        rise: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        }
      },
      animation: {
        sheen: "sheen 4.5s ease-in-out infinite",
        rise: "rise 5s ease-in-out infinite"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
