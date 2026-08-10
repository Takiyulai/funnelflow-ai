// components/editor/tabs/items/PopupFieldsEditor.tsx
"use client";

// 🆕 CAPTURE CLONE — Éditeur des champs du formulaire ouvert par un CTA cloné.
//
// Pourquoi un composant distinct de `FormFieldsEditor` : celui-ci est couplé à
// `section.items` (des `SectionItem` de kind "formField") et écrit via
// `onChange({ items })`. Ici, les champs vivent dans
// `rawHtmlPatches.links[id].popup.fields`, c'est-à-dire un simple
// `FormFieldItem[]`. Adapter l'autre composant aurait demandé de lui greffer un
// second mode de stockage — plus de risque que de gain pour une UI de cette
// taille.

import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { FormFieldItem, FormFieldType } from "@/lib/funnels/types";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Texte court" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Téléphone" },
  { value: "number", label: "Nombre" },
  { value: "textarea", label: "Texte long" },
  { value: "select", label: "Liste déroulante" },
  { value: "checkbox", label: "Case à cocher" },
];

/**
 * Champs par défaut, alignés sur `DEFAULT_FIELDS` de PopupForm.tsx.
 * Proposés au premier clic sur « Personnaliser les champs » pour que
 * l'utilisateur parte de ce qu'il voit déjà, au lieu d'une liste vide.
 */
export const DEFAULT_POPUP_FIELDS: FormFieldItem[] = [
  {
    name: "name",
    type: "text",
    label: "Prénom",
    placeholder: "Votre prénom",
    required: true,
    width: "full",
  },
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "vous@exemple.com",
    required: true,
    width: "full",
  },
];

/** Nom technique du champ, dérivé du libellé. Sert de clé côté /api/leads. */
function slugifyName(label: string, fallbackIndex: number): string {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || `field_${fallbackIndex + 1}`
  );
}

export function PopupFieldsEditor({
  fields,
  onChange,
}: {
  fields: FormFieldItem[] | undefined;
  onChange: (fields: FormFieldItem[] | undefined) => void;
}) {
  const list = fields ?? [];
  const isCustom = list.length > 0;

  const update = (idx: number, patch: Partial<FormFieldItem>) => {
    const next = list.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  };

  const move = (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    // Liste vidée → on retire la clé : le popup retombe sur ses champs par
    // défaut (prénom + email) plutôt que d'afficher un formulaire sans champ.
    onChange(next.length > 0 ? next : undefined);
  };

  const add = () => {
    onChange([
      ...list,
      {
        name: `field_${list.length + 1}`,
        type: "text",
        label: "",
        placeholder: "",
        required: false,
        width: "full",
      },
    ]);
  };

  if (!isCustom) {
    return (
      <div className="rounded border border-white/10 bg-black/20 p-2">
        <p className="text-[10px] leading-relaxed text-white/50">
          Champs demandés : <strong className="text-white/75">Prénom</strong> et{" "}
          <strong className="text-white/75">Email</strong>.
        </p>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(DEFAULT_POPUP_FIELDS.map((f) => ({ ...f })))}
          className="mt-1.5 flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-2.5 w-2.5" />
          Personnaliser les champs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded border border-white/10 bg-black/20 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-white/40">
          Champs du formulaire ({list.length})
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(undefined)}
          className="text-[9px] text-white/40 transition-colors hover:text-white/80"
          title="Revenir aux champs par défaut (prénom + email)"
        >
          Réinitialiser
        </button>
      </div>

      {list.map((field, idx) => (
        <div
          key={idx}
          className="rounded border border-white/10 bg-black/40 p-1.5 space-y-1"
        >
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={field.label ?? ""}
              onChange={(e) => {
                const label = e.target.value;
                // Le nom technique suit le libellé tant que l'utilisateur ne
                // l'a pas figé : il sert de clé dans le CRM, une clé vide ou
                // dupliquée rendrait le lead illisible.
                update(idx, { label, name: slugifyName(label, idx) });
              }}
              placeholder="Libellé du champ"
              className="min-w-0 flex-1 rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[11px] text-white outline-none focus:border-emerald-300/40"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="rounded p-1 text-white/40 transition-colors hover:text-white disabled:opacity-20"
              title="Monter"
            >
              <ArrowUp className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => move(idx, 1)}
              disabled={idx === list.length - 1}
              className="rounded p-1 text-white/40 transition-colors hover:text-white disabled:opacity-20"
              title="Descendre"
            >
              <ArrowDown className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => remove(idx)}
              className="rounded p-1 text-white/40 transition-colors hover:text-red-300"
              title="Supprimer ce champ"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <select
              value={field.type}
              onChange={(e) =>
                update(idx, { type: e.target.value as FormFieldType })
              }
              className="min-w-0 flex-1 rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[10px] text-white outline-none focus:border-emerald-300/40"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="flex shrink-0 items-center gap-1 text-[10px] text-white/60">
              <input
                type="checkbox"
                checked={field.required === true}
                onChange={(e) => update(idx, { required: e.target.checked })}
                className="h-3 w-3 accent-emerald-400"
              />
              Requis
            </label>
          </div>

          {field.type !== "checkbox" && (
            <input
              type="text"
              value={field.placeholder ?? ""}
              onChange={(e) => update(idx, { placeholder: e.target.value })}
              placeholder="Texte d'exemple (optionnel)"
              className="w-full rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[10px] text-white outline-none focus:border-emerald-300/40"
            />
          )}

          {field.type === "select" && (
            <input
              type="text"
              value={(field.options ?? []).join(", ")}
              onChange={(e) =>
                update(idx, {
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Options séparées par des virgules"
              className="w-full rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[10px] text-white outline-none focus:border-emerald-300/40"
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={add}
        className="flex w-full items-center justify-center gap-1 rounded bg-white/5 px-2 py-1 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-2.5 w-2.5" />
        Ajouter un champ
      </button>

      <p className="text-[9px] leading-relaxed text-white/35">
        Un champ de type Email est nécessaire : sans adresse, le lead ne peut
        pas être enregistré.
      </p>
    </div>
  );
}
