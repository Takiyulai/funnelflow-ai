// lib/export/faq-script.ts
//
// ⚠️ Ce fichier n'est plus qu'un ALIAS de rétrocompatibilité.
//
// La logique vivait ici EN DOUBLE avec celle de RawHtmlRenderer.tsx, et les
// deux copies avaient divergé : l'aperçu avait gagné un repli heuristique que
// l'export n'a jamais reçu, si bien qu'une FAQ pouvait fonctionner à l'aperçu
// et rester morte dans le HTML exporté.
//
// Source unique désormais : lib/clone/accordion-runtime.ts — qui gère en plus
// les accordéons Divi / Elementor / Bootstrap et les questions décorées d'un
// emoji (« ¿CUÁNTO TIEMPO…? 👇 »), deux cas sur lesquels l'ancienne version
// échouait silencieusement.

import { ACCORDION_RUNTIME_SCRIPT } from "@/lib/clone/accordion-runtime";

/** @deprecated Importer directement ACCORDION_RUNTIME_SCRIPT. */
export const FAQ_RUNTIME_SCRIPT = ACCORDION_RUNTIME_SCRIPT;

export function pageNeedsFaqRuntime(): boolean {
  return true;
}
