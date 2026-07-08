"use client";

// 🆕 Éditeur RÉUTILISABLE du popup interne AutoFunnel (titre, texte, champs à
// capturer, tags CRM, identifiant). Utilisé par l'onglet CTA (par section) ET
// par le panneau Style global (action commune des boutons), pour que le popup
// interne soit personnalisable des DEUX côtés — même expérience.

import type {
  CtaConfig,
  FormFieldItem,
  FormFieldType,
} from "@/lib/funnels/types";
import { TagsInput } from "./TagsInput";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40";

export const DEFAULT_POPUP_FIELDS: FormFieldItem[] = [
  { name: "name", type: "text", label: "Prénom", placeholder: "Votre prénom", required: true, width: "full" },
  { name: "email", type: "email", label: "Email", placeholder: "vous@exemple.com", required: true, width: "full" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/70">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-white/40">{hint}</p>}
    </div>
  );
}

export function InternalPopupEditor({
  cta,
  onChange,
  idBase,
}: {
  cta: CtaConfig;
  /** Applique un patch partiel au CtaConfig édité. */
  onChange: (patch: Partial<CtaConfig>) => void;
  /** Base utilisée pour le placeholder de l'identifiant technique. */
  idBase?: string;
}) {
  const popupFields = cta.popupFields;

  const setPopupFields = (fields: FormFieldItem[]) =>
    onChange({ popupFields: fields });

  const addPopupField = () => {
    const current = popupFields ?? DEFAULT_POPUP_FIELDS;
    setPopupFields([
      ...current,
      {
        name: `field_${current.length + 1}`,
        type: "text",
        label: "Nouveau champ",
        required: false,
        width: "full",
      },
    ]);
  };

  const updatePopupField = (idx: number, patch: Partial<FormFieldItem>) => {
    const current = popupFields ?? DEFAULT_POPUP_FIELDS;
    setPopupFields(current.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removePopupField = (idx: number) => {
    const current = popupFields ?? DEFAULT_POPUP_FIELDS;
    if (current.length <= 1) return;
    setPopupFields(current.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-[11px] text-emerald-200/80">
        ✓ Ce popup s&apos;affiche directement sur votre tunnel AutoFunnel. Aucune
        configuration externe nécessaire.
      </div>

      <Field label="Titre du popup">
        <input
          type="text"
          value={cta.popupTitle ?? ""}
          onChange={(e) => onChange({ popupTitle: e.target.value })}
          className={inputClass}
          placeholder="Recevez votre accès"
        />
      </Field>

      <Field label="Texte d'introduction" hint="1 à 2 phrases courtes">
        <textarea
          value={cta.popupBody ?? ""}
          onChange={(e) => onChange({ popupBody: e.target.value })}
          className={`${inputClass} min-h-[60px] resize-y py-2`}
          placeholder="Laissez vos coordonnées, l'accès vous est envoyé immédiatement."
        />
      </Field>

      {/* === Éditeur de champs à capturer === */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Champs à capturer
          </div>
          <button
            type="button"
            onClick={addPopupField}
            className="rounded border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10px] font-medium text-white/60 hover:border-white/20 hover:text-white"
          >
            + Ajouter
          </button>
        </div>

        {(popupFields ?? DEFAULT_POPUP_FIELDS).map((f, idx) => (
          <div
            key={idx}
            className="rounded-md border border-white/10 bg-black/30 p-2 space-y-1.5"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={f.label ?? ""}
                onChange={(e) => updatePopupField(idx, { label: e.target.value })}
                className={`${inputClass} flex-1`}
                placeholder="Libellé"
              />
              <select
                value={f.type}
                onChange={(e) =>
                  updatePopupField(idx, { type: e.target.value as FormFieldType })
                }
                className={inputClass}
                style={{ width: 120 }}
              >
                <option value="text">Texte</option>
                <option value="email">Email</option>
                <option value="tel">Téléphone</option>
                <option value="number">Nombre</option>
                <option value="textarea">Zone texte</option>
                <option value="checkbox">Case à cocher</option>
              </select>
              <button
                type="button"
                onClick={() => removePopupField(idx)}
                className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:border-red-300/40 hover:text-red-300"
                aria-label="Supprimer ce champ"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={f.name}
                onChange={(e) =>
                  updatePopupField(idx, {
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  })
                }
                className={`${inputClass} flex-1`}
                placeholder="nom_technique"
              />
              <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-white/60">
                <input
                  type="checkbox"
                  checked={f.required ?? false}
                  onChange={(e) => updatePopupField(idx, { required: e.target.checked })}
                  className="h-3.5 w-3.5 accent-amber-300"
                />
                Requis
              </label>
            </div>
          </div>
        ))}

        <p className="text-[10px] text-white/40">
          Au moins un champ Email est recommandé, sinon le lead ne pourra pas être
          enregistré.
        </p>
      </div>

      {/* Tags CRM appliqués aux leads capturés par ce popup */}
      <Field
        label="Tags appliqués"
        hint="Tags CRM posés automatiquement sur chaque lead capturé par ce popup. Un tag inexistant est créé."
      >
        <TagsInput
          value={cta.captureTags ?? []}
          onChange={(next) => onChange({ captureTags: next })}
        />
      </Field>

      <Field
        label="Identifiant technique"
        hint="Généré automatiquement, modifiez seulement si nécessaire"
      >
        <input
          type="text"
          value={cta.popupId ?? ""}
          onChange={(e) =>
            onChange({
              popupId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
            })
          }
          className={inputClass}
          placeholder={`popup-${idBase ?? "global"}`}
        />
      </Field>
    </div>
  );
}

export default InternalPopupEditor;
