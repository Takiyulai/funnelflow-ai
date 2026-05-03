// components/dashboard/FunnelRowMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical, Pencil, Trash2, ExternalLink, Copy, Download,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type FunnelRowItem = {
  id: string;
  name: string;
};

type Props = {
  funnel: FunnelRowItem;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
};

export function FunnelRowMenu({ funnel, onDelete, onDuplicate }: Props) {
  const [open, setOpen] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleDeleteConfirmed() {
    setAskDelete(false);
    onDelete?.(funnel.id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Options du tunnel"
        className="grid h-8 w-8 place-items-center rounded-md border border-line bg-white text-muted transition hover:border-[#08498D]/40 hover:text-ink"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-lg border border-line bg-white shadow-lg animate-[fadeIn_0.15s_ease-out]"
        >
          <MenuItem
            icon={<Pencil size={13} />}
            label="Modifier le tunnel"
            onClick={() => go(`/editor/${funnel.id}`)}
          />
          <MenuItem
            icon={<ExternalLink size={13} />}
            label="Ouvrir l'aperçu"
            onClick={() => go(`/funnels/${funnel.id}`)}
          />
          <MenuItem
            icon={<Download size={13} />}
            label="Exporter vers systeme.io"
            onClick={() => go(`/export-systeme?id=${encodeURIComponent(funnel.id)}`)}
          />
          {onDuplicate && (
            <MenuItem
              icon={<Copy size={13} />}
              label="Dupliquer"
              onClick={() => { setOpen(false); onDuplicate(funnel.id); }}
            />
          )}
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<Trash2 size={13} />}
            label="Supprimer"
            danger
            onClick={() => { setOpen(false); setAskDelete(true); }}
          />
        </div>
      )}

      <ConfirmDialog
        open={askDelete}
        tone="danger"
        title={`Supprimer « ${funnel.name} » ?`}
        description="Cette action est définitive. Le tunnel et ses paramètres seront retirés du tableau de bord"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setAskDelete(false)}
      />
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition ${
        danger
          ? "text-red hover:bg-red/5"
          : "text-ink hover:bg-canvas"
      }`}
    >
      <span className="grid h-6 w-6 place-items-center">{icon}</span>
      {label}
    </button>
  );
}
