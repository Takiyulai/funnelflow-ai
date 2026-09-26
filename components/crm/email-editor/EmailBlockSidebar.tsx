"use client";

import { Heading, Image, Link2, Minus, Space, Type } from "lucide-react";
import type { EmailBlockType } from "@/lib/email-editor/types";

const GROUPS: Array<{
  label: string;
  items: Array<{ type: EmailBlockType; label: string; icon: typeof Type }>;
}> = [
  {
    label: "Contenu",
    items: [
      { type: "richText", label: "Texte", icon: Type },
      { type: "heading", label: "Titre", icon: Heading },
      { type: "image", label: "Image", icon: Image },
      { type: "button", label: "Bouton", icon: Link2 },
    ],
  },
  {
    label: "Structure",
    items: [
      { type: "divider", label: "Séparateur", icon: Minus },
      { type: "spacer", label: "Espacement", icon: Space },
    ],
  },
];

export function EmailBlockSidebar({ onAdd }: { onAdd: (type: EmailBlockType) => void }) {
  return (
    <div className="grid gap-6 p-4">
      <div>
        <h2 className="text-sm font-black text-ink">Ajouter un bloc</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Ajoute uniquement les éléments nécessaires à ton message.
        </p>
      </div>
      {GROUPS.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {group.items.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => onAdd(type)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 text-left text-sm font-semibold text-ink transition hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-[color:var(--ff-accent)]">
                  <Icon size={16} />
                </span>
                {label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
