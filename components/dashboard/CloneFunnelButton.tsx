// components/dashboard/CloneFunnelButton.tsx
"use client";

import { useState } from "react";
import { CloneFunnelModal } from "./CloneFunnelModal";

type Props = {
  className?: string;
};

export function CloneFunnelButton({ className = "" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 🆕 Tokens de thème (surface/ink/line) au lieu de gris codés en dur :
        // le texte reste net et contrasté en mode sombre comme en clair.
        className={`inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
        Cloner un tunnel
      </button>

      <CloneFunnelModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
