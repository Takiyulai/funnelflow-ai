"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SectionEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Largeur du drawer en px sur desktop (>= sm). Défaut 440. Sous sm, le drawer est plein écran. */
  width?: number;
}

/**
 * Drawer latéral à GAUCHE — pattern Webflow/Framer sur desktop, plein écran sur mobile.
 * - Desktop (≥ sm) : largeur fixe (440px par défaut), backdrop transparent pour garder la preview visible.
 * - Mobile (< sm) : plein écran, backdrop sombre pour isolation.
 * - Escape ferme le drawer.
 */
export function SectionEditorDrawer({
  open,
  onClose,
  title,
  children,
  width = 440,
}: SectionEditorDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape ferme le drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Empêche le scroll du body quand le drawer est ouvert sur mobile (plein écran)
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 640) return; // sm breakpoint
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop :
          - Mobile (< sm) : sombre, plein écran (le drawer est plein écran).
          - Desktop (≥ sm) : transparent, juste la zone du drawer (préserve l'interactivité de la preview). */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-0 sm:inset-y-0 sm:left-0 sm:right-auto z-40 bg-black/60 sm:bg-transparent transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          // Sur desktop, on limite la largeur du backdrop à celle du drawer
          // (inline style ignoré sur mobile par les classes sm: ci-dessus qui imposent inset-0)
          ["--drawer-width" as string]: `${width}px`,
        }}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-zinc-950 border-r border-white/10 shadow-2xl transition-transform duration-300 ease-out min-w-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "100vw",
          maxWidth: `${width}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/70 px-3 sm:px-4 py-3 min-w-0 shrink-0">
          <h2 className="truncate text-sm font-semibold text-white min-w-0">
            {title ?? "Éditer la section"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Fermer (Esc)"
            className="flex h-8 w-8 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-w-0">
          {children}
        </div>
      </aside>
    </>
  );
}

export default SectionEditorDrawer;
