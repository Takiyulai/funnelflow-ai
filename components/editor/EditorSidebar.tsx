"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Copy,
  Trash2,
  GripVertical,
  Palette,
} from "lucide-react";
import type { FunnelSection } from "@/lib/funnels/types";
import { AddSectionMenu } from "@/components/editor/AddSectionMenu";


type Props = {
  sections: FunnelSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onToggleVisibility: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (section: FunnelSection) => void; // ← AJOUT
  onOpenGlobalStyle: () => void;
};

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  about: "À propos",
  problem: "Problème",
  solution: "Solution",
  benefits: "Bénéfices",
  features: "Fonctionnalités",
  proof: "Preuve sociale",
  testimonials: "Témoignages",
  offer: "Offre",
  pricing: "Tarifs",
  bonus: "Bonus",
  guarantee: "Garantie",
  faq: "FAQ",
  cta: "Appel à l'action",
  form: "Formulaire",
  webinar: "Webinaire",
  vsl: "VSL",
  qualification: "Qualification",
};

export function EditorSidebar({
  sections,
  selectedId,
  onSelect,
  onReorder,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  onAdd,
  onOpenGlobalStyle,
}: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const ids = sections.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggedId);
    onReorder(next);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Sections ({sections.length})
        </h2>
        <button
          type="button"
          onClick={onOpenGlobalStyle}
          title="Style global"
          className="rounded-md border border-white/10 p-1.5 text-white/60 hover:border-amber-300/40 hover:text-amber-300"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
      </div>

      <AddSectionMenu onAdd={onAdd} />

      <ul className="space-y-1">
        {sections.map((section) => {
          const isSelected = section.id === selectedId;
          const isDragOver = section.id === dragOverId && draggedId !== section.id;
          const isDragging = section.id === draggedId;
          const isHidden = section.visible === false;
          const label =
            SECTION_LABELS[section.type] ?? section.type ?? "Section";
          const headline = section.headline?.trim() || label;

          return (
            <li
              key={section.id}
              draggable
              onDragStart={(e) => handleDragStart(e, section.id)}
              onDragOver={(e) => handleDragOver(e, section.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, section.id)}
              onDragEnd={handleDragEnd}
              className={[
                "group flex items-center gap-2 rounded-lg border p-2 transition-all cursor-pointer",
                isSelected
                  ? "border-amber-300/40 bg-amber-300/5"
                  : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]",
                isDragOver ? "ring-2 ring-amber-300/40" : "",
                isDragging ? "opacity-40" : "",
                isHidden ? "opacity-60" : "",
              ].join(" ")}
              onClick={() => onSelect(section.id)}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-white/30 group-hover:text-white/50" />

              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-white/40">
                  {label}
                </div>
                <div
                  className={[
                    "truncate text-xs",
                    isSelected ? "text-amber-200" : "text-white/80",
                    isHidden ? "line-through" : "",
                  ].join(" ")}
                >
                  {headline}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconButton
                  title={isHidden ? "Afficher" : "Masquer"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(section.id);
                  }}
                >
                  {isHidden ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </IconButton>
                <IconButton
                  title="Dupliquer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(section.id);
                  }}
                >
                  <Copy className="h-3 w-3" />
                </IconButton>
                <IconButton
                  title="Supprimer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(section.id);
                  }}
                  danger
                >
                  <Trash2 className="h-3 w-3" />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      {sections.length === 0 && (
        <div className="px-2 py-6 text-center text-xs text-white/40">
          Aucune section
        </div>
      )}

      {/* Confirm delete inline */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-white">
              Supprimer cette section ?
            </h3>
            <p className="mb-4 text-xs text-white/60">
              Cette action peut être annulée avec Ctrl+Z.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function IconButton({
  title,
  onClick,
  children,
  danger = false,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "rounded p-1 transition-colors",
        danger
          ? "text-white/50 hover:bg-rose-500/20 hover:text-rose-300"
          : "text-white/50 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
