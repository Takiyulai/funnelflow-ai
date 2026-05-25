"use client";

import { Home } from "lucide-react";
import type { FunnelPage } from "@/lib/funnels/types";

type Props = {
  pages: FunnelPage[];
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
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

export function PageSelector({ pages, selectedPageId, onSelect }: Props) {
  if (!pages || pages.length <= 1) return null;

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
            <button
              key={page.id}
              type="button"
              onClick={() => onSelect(page.id)}
              className={[
                "group flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
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
          );
        })}
      </div>
    </div>
  );
}
