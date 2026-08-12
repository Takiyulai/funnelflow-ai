// components/dashboard/AppShell.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChatWidget } from "@/components/chatbot/ChatWidget";

const THEME_KEY = "ff:theme";
type Theme = "light" | "dark";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  // Lecture du thème persistant au montage (évite le flash : on n'applique la
  // classe qu'au niveau du wrapper AppShell, pas sur <html>).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY) as Theme | null;
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {
      /* localStorage indisponible : on reste en clair */
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* non bloquant */
      }
      return next;
    });
  };

  const ThemeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink transition hover:bg-canvas"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );

  return (
    <div className={`ff-app min-h-screen bg-canvas ${theme === "dark" ? "ff-theme-dark" : ""}`}>
      {/* Header mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <a href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md text-xs font-black text-white" style={{ background: "linear-gradient(135deg,#31845C,#08498D)" }}>
            AF
          </span>
          <span className="text-sm font-bold text-ink">
            AutoFunnel <span className="text-accent-ink">AI</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {ThemeButton}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink hover:bg-canvas"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* 🆕 La sidebar est désormais `fixed` (hors du flux) : plus de colonne
          flex à sa gauche, plus de wrapper de fond à étirer, et surtout plus
          de bande vide sous le menu quand le contenu de droite est court.
          Le décalage se fait par `lg:pl-72`, qui vaut exactement la largeur de
          la sidebar (w-72). */}
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="lg:pl-72">
        {/* overflow-x-clip (et non hidden) : empêche le débordement horizontal
            SANS faire de <main> un conteneur de défilement — sinon les éléments
            `sticky top-0` (topbar de l'éditeur) collaient au bord du padding et
            le contenu passait par-dessus. Le défilement reste celui de la page,
            donc la sidebar fixe ne bouge pas pendant qu'on parcourt le contenu. */}
        <main className="min-w-0 overflow-x-clip px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {/* 🆕 Chatbot IA maison (bas-droite) — UNIQUEMENT dans l'espace connecté
          (jamais sur les tunnels publics, qui n'utilisent pas AppShell).
          Répond automatiquement à partir de la base de connaissances. */}
      <ChatWidget />
    </div>
  );
}
