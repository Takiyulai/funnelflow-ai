"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FunnelSection, FunnelSectionType } from "@/lib/funnels/types";

type Props = {
  onAdd: (section: FunnelSection) => void;
};

type Group = {
  label: string;
  items: { type: FunnelSectionType; label: string; hint: string }[];
};

const GROUPS: Group[] = [
  {
    label: "Accroche",
    items: [
      { type: "hero", label: "Hero", hint: "Section d'introduction" },
      { type: "about", label: "À propos", hint: "Présentation auteur/marque" },
      { type: "video", label: "Vidéo", hint: "Bloc vidéo isolé" },
    ],
  },
  {
    label: "Persuasion",
    items: [
      { type: "problem", label: "Problème", hint: "Identifie le pain point" },
      { type: "solution", label: "Solution", hint: "Présente ta réponse" },
      { type: "benefits", label: "Bénéfices", hint: "Liste de bénéfices" },
      { type: "proof", label: "Preuve", hint: "Témoignages/résultats" },
    ],
  },
  {
    label: "Offre",
    items: [
      { type: "offer", label: "Offre", hint: "Détail de l'offre" },
      { type: "pricing", label: "Tarifs", hint: "Tableau de prix" },
      { type: "bonus", label: "Bonus", hint: "Bonus inclus" },
      { type: "guarantee", label: "Garantie", hint: "Garantie de remboursement" },
      { type: "program", label: "Programme", hint: "Détail des modules" },
      { type: "process", label: "Processus", hint: "Étapes" },
    ],
  },
  {
    label: "Conversion",
    items: [
      { type: "cta", label: "CTA", hint: "Bouton d'action" },
      { type: "form", label: "Formulaire", hint: "Capture de leads" },
      { type: "qualification", label: "Qualification", hint: "Questions de qualif" },
      { type: "webinar", label: "Webinaire", hint: "Inscription webinaire" },
    ],
  },
  {
    label: "Autres",
    items: [
      { type: "faq", label: "FAQ", hint: "Questions fréquentes" },
      { type: "thank_you", label: "Remerciement", hint: "Page de merci" },
    ],
  },
];

const DEFAULT_HEADLINES: Record<FunnelSectionType, string> = {
  hero: "Votre nouveau titre accrocheur",
  about: "À propos",
  problem: "Le vrai problème",
  solution: "Notre solution",
  benefits: "Ce que vous obtenez",
  proof: "Ils en parlent",
  offer: "L'offre complète",
  bonus: "Bonus exclusifs",
  guarantee: "Garantie satisfait ou remboursé",
  faq: "Questions fréquentes",
  cta: "Prêt à commencer ?",
  form: "Demander l'accès",
  thank_you: "Merci !",
  program: "Le programme",
  pricing: "Tarifs",
  process: "Comment ça marche",
  webinar: "Réservez votre place",
  video: "Découvrez en vidéo",
  qualification: "Êtes-vous au bon endroit ?",
};

export function AddSectionMenu({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open]);

  const handleAdd = (type: FunnelSectionType) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const newSection: FunnelSection = {
      id,
      type,
      headline: DEFAULT_HEADLINES[type] ?? "Nouvelle section",
      visible: true,
      layoutVariant: "centered",
      animations: { headline: "fade-up", body: "fade-up", cta: "fade-up" },
    };
    onAdd(newSection);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/70 hover:border-amber-300/40 hover:bg-amber-300/[0.03] hover:text-amber-200"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter une section
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[400px] overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 p-1.5 shadow-2xl">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-1.5 last:mb-0">
              <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </div>
              <ul>
                {group.items.map((item) => (
                  <li key={item.type}>
                    <button
                      type="button"
                      onClick={() => handleAdd(item.type)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-white">
                          {item.label}
                        </div>
                        <div className="truncate text-[10px] text-white/40">
                          {item.hint}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
