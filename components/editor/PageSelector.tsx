"use client";

import { Home, Plus, X } from "lucide-react";
import type { FunnelPage } from "@/lib/funnels/types";

type Props = {
  pages: FunnelPage[];
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  /** 🆕 Ajouter une page vierge (from scratch). */
  onAddPage?: () => void;
  /** 🆕 Supprimer une page (jamais la page d'accueil). */
  onDeletePage?: (pageId: string) => void;
};

const ROLE_LABELS: Record<string, string> = {
  optin: "Inscription",
  thankyou: "Remerciement",
  delivery: "Accès",
  sales: "Vente",
  checkout: "Paiement",
  upsell: "Upsell",
  downsell: "Downsell",
  access: "Accès",
  registration: "Inscription",
  confirmation: "Confirmation",
  replay: "Replay",
  live: "Live",
  landing: "Accueil",
  qualification: "Qualification",
  booking: "Réservation",
  "case-studies": "Études de cas",
  application: "Candidature",
  "challenge-landing": "Challenge",
  "challenge-day": "Jour de challenge",
  custom: "Page",
};

export function PageSelector({
  pages,
  selectedPageId,
  onSelect,
  onAddPage,
  onDeletePage,
}: Props) {
  if (!pages || pages.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/15 bg-zinc-900 p-2 shadow-lg">
      <div className="mb-2 px-1 text-[10px] uppercase tracking-wider text-white/50">
        Pages du tunnel ({pages.length})
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {pages.map((page) => {
          const isSelected = page.id === selectedPageId;
          const label = ROLE_LABELS[page.role] ?? page.name ?? page.role;
          return (
            <div key={page.id} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => onSelect(page.id)}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
                  isSelected
                    ? "border-amber-300/50 bg-amber-300/10 text-amber-200 shadow-sm"
                    : "border-white/10 bg-zinc-950/40 text-white/80 hover:border-white/20 hover:bg-zinc-950/60 hover:text-white",
                ].join(" ")}
                title={`${page.name} (${page.slug})`}
              >
                {page.isHome && (
                  <Home
                    className={`h-3 w-3 ${isSelected ? "text-amber-300" : "text-white/50"}`}
                  />
                )}
                <span>{label}</span>
                <span
                  className={[
                    "rounded-full px-1.5 text-[10px] font-bold",
                    isSelected
                      ? "bg-amber-300/20 text-amber-200"
                      : "bg-white/10 text-white/60",
                  ].join(" ")}
                >
                  {page.sections.length}
                </span>
              </button>

              {/* 🆕 Supprimer (jamais la page d'accueil) */}
              {!page.isHome && onDeletePage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(page.id);
                  }}
                  title="Supprimer cette page"
                  aria-label="Supprimer cette page"
                  className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow group-hover:flex hover:bg-red-400"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* 🆕 Ajouter une page vierge */}
        {onAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            title="Ajouter une page vierge"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-white/20 bg-transparent px-3 py-2 text-xs font-medium text-white/60 transition-all hover:border-amber-300/40 hover:text-amber-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Page
          </button>
        )}
      </div>
    </div>
  );
}
