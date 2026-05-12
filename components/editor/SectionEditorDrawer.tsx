"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SectionEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Largeur du drawer en px. Défaut 440. */
  width?: number;
}

/**
 * Drawer latéral à GAUCHE — pattern Webflow/Framer.
 * - La preview à droite reste visible et interactive pendant l'édition.
 * - Le backdrop est très léger (ne masque pas la preview).
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

  // On rend toujours le DOM (même fermé) pour permettre la transition CSS
  return (
    <>
      {/* Backdrop très léger — ne couvre PAS la preview à droite, juste
          la zone où le drawer va apparaître. Cliquer ferme. */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          width: `${width}px`,
          background: "transparent",
        }}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-zinc-950 border-r border-white/10 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: `${width}px` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/70 px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-white">
            {title ?? "Éditer la section"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Fermer (Esc)"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}

export default SectionEditorDrawer;
