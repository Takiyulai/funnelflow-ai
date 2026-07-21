import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Inter,
  Playfair_Display,
  Bricolage_Grotesque,
  Space_Grotesk,
} from "next/font/google";
// @ts-ignore
import "./globals.css";
// CSS dédié à la preview AutoFunnel (sélecteurs [data-ff-template]).
// L'export Systeme.io utilise sa propre source (lib/export/theme-css.ts)
// injectée par html.ts au moment de l'export — aucun conflit.
// @ts-ignore
import "./funnel-theme.css";
import "../styles/funnel-animations.css";
import { ToastProvider } from "@/components/ui/Toast";
import { CelebrationProvider } from "@/components/ui/Celebration";

const inter = Inter({ subsets: ["latin"], variable: "--ff-font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--ff-font-playfair", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--ff-font-bricolage", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--ff-font-space", display: "swap" });

export const metadata: Metadata = {
  title: "AutoFunnel AI",
  description: "Créez un tunnel de vente complet avec l'IA, exportable vers Systeme.io.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${playfair.variable} ${bricolage.variable} ${spaceGrotesk.variable}`}
    >
      <body
  className={`${inter.className} font-sans antialiased`}
  suppressHydrationWarning
>
  <ToastProvider>
    <CelebrationProvider>{children}</CelebrationProvider>
  </ToastProvider>
</body>

    </html>
  );
}
