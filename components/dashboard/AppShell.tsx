// components/dashboard/AppShell.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TawkToWidget } from "@/components/support/TawkToWidget";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const THEME_KEY = "ff:theme";
type Theme = "light" | "dark";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  // Email de l'utilisateur connecté → pré-rempli dans Tawk.to (savoir qui écrit).
  useEffect(() => {
    let active = true;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (active) setUserEmail(session?.user?.email ?? undefined);
      });
    } catch {
      /* Supabase indisponible : widget standard sans pré-remplissage */
    }
    return () => {
      active = false;
    };
  }, []);

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
            AutoFunnel <span className="text-gold">AI</span>
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

      <div className="lg:flex lg:items-stretch">
        {/* 🆕 Colonne sidebar qui s'étire sur TOUTE la hauteur (fond sombre),
            pour éviter le « trou » clair sous la sidebar sticky quand le contenu
            de la page est plus long que l'écran. La sidebar reste sticky à
            l'intérieur. Sur mobile, l'aside est `fixed` → ce wrapper n'a aucun
            impact visuel. */}
        <div className="lg:shrink-0 lg:bg-[#0D1628]">
          <Sidebar
            mobileOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>

        {/* overflow-x-clip (et non hidden) : empêche le débordement horizontal
            SANS faire de <main> un conteneur de défilement — sinon les éléments
            `sticky top-0` (topbar de l'éditeur) collaient au bord du padding et
            le contenu passait par-dessus. */}
        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {/* Widget support Tawk.to — UNIQUEMENT dans l'espace connecté (jamais sur
          les tunnels publics, qui n'utilisent pas AppShell). */}
      <TawkToWidget visitorEmail={userEmail} />
    </div>
  );
}
