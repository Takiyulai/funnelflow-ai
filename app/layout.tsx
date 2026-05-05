import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Inter,
  Playfair_Display,
  Bricolage_Grotesque,
  Space_Grotesk,
} from "next/font/google";
// @ts-ignore: CSS module import for global styles
import "./globals.css";
// @ts-ignore: CSS module import for funnel theme
import "./funnel-theme.css";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--ff-font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--ff-font-playfair",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--ff-font-bricolage",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--ff-font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FunnelFlow AI",
  description:
    "Créez un tunnel de vente complet avec l'IA, exportable vers Systeme.io.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${playfair.variable} ${bricolage.variable} ${spaceGrotesk.variable}`}
    >
      <body className={`${inter.className} font-sans antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
