"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  FunnelSection,
  FunnelSectionType,
  SectionItem,
} from "@/lib/funnels/types";

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

/**
 * Génère un set d'items de démo pour les sections qui en attendent.
 * Retourne undefined pour les sections qui n'ont pas besoin d'items.
 */
function buildDefaultItems(type: FunnelSectionType): SectionItem[] | undefined {
  switch (type) {
    case "pricing":
    case "offer":
      return [
        {
          kind: "pricing",
          data: {
            name: "Starter",
            price: "29€",
            period: "/mois",
            description: "Pour démarrer rapidement",
            features: ["Fonctionnalité 1", "Fonctionnalité 2", "Fonctionnalité 3"],
            highlighted: false,
            featureIcon: { name: "check", size: "md", animation: "none" },
          },
        },
        {
          kind: "pricing",
          data: {
            name: "Pro",
            price: "79€",
            period: "/mois",
            description: "Le plus populaire",
            features: [
              "Tout du Starter",
              "Fonctionnalité avancée 1",
              "Fonctionnalité avancée 2",
              "Support prioritaire",
            ],
            highlighted: true,
            badge: "Populaire",
            featureIcon: { name: "checkCircle", size: "md", animation: "none" },
          },
        },
      ];


    case "bonus":
      return [
        {
          kind: "bonus",
          data: {
            title: "Bonus 1",
            description: "Description du premier bonus inclus",
            value: "Valeur 49€",
            iconName: "gift",
          },
        },
        {
          kind: "bonus",
          data: {
            title: "Bonus 2",
            description: "Description du deuxième bonus inclus",
            value: "Valeur 29€",
            iconName: "sparkles",
          },
        },
      ];

    case "proof":
      return [
        {
          kind: "testimonial",
          data: {
            quote: "Un produit qui a vraiment changé ma façon de travailler.",
            authorName: "Prénom Nom",
            authorRole: "Métier · Entreprise",
            rating: 5,
          },
        },
        {
          kind: "testimonial",
          data: {
            quote: "Je recommande sans hésiter, le retour sur investissement est rapide.",
            authorName: "Prénom Nom",
            authorRole: "Métier · Entreprise",
            rating: 5,
          },
        },
      ];

    case "faq":
      return [
        {
          kind: "faq",
          data: {
            question: "Première question fréquente ?",
            answer: "Réponse claire et rassurante à la première question.",
          },
        },
        {
          kind: "faq",
          data: {
            question: "Deuxième question fréquente ?",
            answer: "Réponse claire et rassurante à la deuxième question.",
          },
        },
        {
          kind: "faq",
          data: {
            question: "Troisième question fréquente ?",
            answer: "Réponse claire et rassurante à la troisième question.",
          },
        },
      ];

    case "guarantee":
      return [
        {
          kind: "guarantee",
          data: {
            title: "Garantie satisfait ou remboursé",
            description:
              "Si vous n'êtes pas satisfait, on vous rembourse intégralement, sans question.",
            duration: "30 jours",
            iconName: "shield",
          },
        },
      ];

    case "form":
      return [
        {
          kind: "formField",
          data: {
            name: "prenom",
            label: "Prénom",
            placeholder: "Votre prénom",
            type: "text",
            required: true,
            width: "half",
          },
        },
        {
          kind: "formField",
          data: {
            name: "email",
            label: "Email",
            placeholder: "vous@exemple.com",
            type: "email",
            required: true,
            width: "half",
          },
        },
        {
          kind: "formField",
          data: {
            name: "rgpd",
            label: "J'accepte de recevoir des emails et la politique de confidentialité",
            type: "checkbox",
            required: true,
            width: "full",
          },
        },
      ];

    default:
      return undefined;
  }
}

/**
 * CTA par défaut pour certains types (notamment form, cta, webinar).
 */
function buildDefaultCta(type: FunnelSectionType): FunnelSection["cta"] | undefined {
  switch (type) {
    case "form":
      return {
        mode: "anchor",
        label: "Recevoir l'accès",
        anchorId: "lead-form",
        target: "_self",
      };
    case "cta":
      return {
        mode: "anchor",
        label: "Je veux commencer",
        anchorId: "lead-form",
        target: "_self",
      };
    case "webinar":
      return {
        mode: "anchor",
        label: "Réserver ma place",
        anchorId: "lead-form",
        target: "_self",
      };
    default:
      return undefined;
  }
}

/**
 * Sous-titre par défaut pour les sections où ça aide à comprendre le rendu.
 */
function buildDefaultSubheadline(type: FunnelSectionType): string | undefined {
  switch (type) {
    case "pricing":
    case "offer":
      return "Choisissez le plan qui vous correspond";
    case "bonus":
      return "Inclus gratuitement avec votre achat";
    case "proof":
      return "Ce que disent nos clients";
    case "faq":
      return "Vous avez des questions, on a les réponses";
    case "form":
      return "Remplissez ce formulaire pour recevoir l'accès immédiatement";
    case "guarantee":
      return undefined;
    default:
      return undefined;
  }
}

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
    const items = buildDefaultItems(type);
    const cta = buildDefaultCta(type);
    const subheadline = buildDefaultSubheadline(type);

    const newSection: FunnelSection = {
      id,
      type,
      headline: DEFAULT_HEADLINES[type] ?? "Nouvelle section",
      ...(subheadline ? { subheadline } : {}),
      ...(cta ? { cta } : {}),
      ...(items ? { items } : {}),
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
