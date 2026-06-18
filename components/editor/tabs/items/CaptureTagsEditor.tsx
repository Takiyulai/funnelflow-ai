"use client";

import type { FunnelSection } from "@/lib/funnels/types";
import { TagsInput, TagsInputLabel } from "./TagsInput";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

/**
 * 🆕 Panneau « Tags appliqués » par formulaire.
 *
 * Édite section.formConfig.captureTags : la liste de tags CRM posés
 * automatiquement sur chaque lead qui soumet ce formulaire. La saisie elle-même
 * est déléguée au composant générique TagsInput (chips + autocomplétion +
 * création CRM).
 */
export function CaptureTagsEditor({ section, onChange }: Props) {
  const tags = section.formConfig?.captureTags ?? [];

  const commit = (next: string[]) => {
    onChange({
      formConfig: {
        // On préserve la config existante (redirection, submitLabel, etc.)
        ...(section.formConfig ?? {}),
        // provider est obligatoire sur FormSectionConfig : on garde l'existant
        // ou on retombe sur "internal" (formulaire FunnelFlow → Supabase).
        provider: section.formConfig?.provider ?? "internal",
        captureTags: next,
      },
    });
  };

  return (
    <div className="space-y-2">
      <TagsInputLabel />
      <TagsInput value={tags} onChange={commit} />
      <p className="text-[10px] text-white/40">
        Chaque lead qui envoie ce formulaire reçoit automatiquement ces tags dans
        le CRM. Tapez un nom puis Entrée, ou choisissez un tag existant. Un tag
        inexistant sera créé.
      </p>
    </div>
  );
}
