// lib/i18n/wizard.ts
import type { Language } from "@/lib/funnels/types";

type Dict = Record<string, { fr: string; en: string; es: string }>;

export const WIZARD_DICT: Dict = {
  // Steps
  "step.kind": { fr: "Format", en: "Format", es: "Formato" },
  "step.objective": { fr: "Objectif", en: "Goal", es: "Objetivo" },
  "step.business": { fr: "Marque", en: "Brand", es: "Marca" },
  "step.offer": { fr: "Offre", en: "Offer", es: "Oferta" },
  "step.audience": { fr: "Audience", en: "Audience", es: "Audiencia" },
  "step.about": { fr: "À propos", en: "About", es: "Acerca de" },
  "step.video": { fr: "Vidéo", en: "Video", es: "Video" },
  "step.cta": { fr: "Action", en: "Action", es: "Acción" },
  "step.images": { fr: "Visuels", en: "Visuals", es: "Visuales" },
  "step.mood": { fr: "Ambiance", en: "Mood", es: "Ambiente" },
  "step.design": { fr: "Design", en: "Design", es: "Diseño" },
  "step.generation": { fr: "Génération", en: "Generation", es: "Generación" },

  // Common actions
  "action.next": { fr: "Suivant", en: "Next", es: "Siguiente" },
  "action.back": { fr: "Retour", en: "Back", es: "Atrás" },
  "action.generate": { fr: "Générer le tunnel", en: "Generate funnel", es: "Generar el embudo" },
  "action.skip": { fr: "Passer cette étape", en: "Skip this step", es: "Saltar este paso" },
  "action.confirm": { fr: "Confirmer", en: "Confirm", es: "Confirmar" },
  "action.cancel": { fr: "Annuler", en: "Cancel", es: "Cancelar" },
  "action.delete": { fr: "Supprimer", en: "Delete", es: "Eliminar" },
  "action.duplicate": { fr: "Dupliquer", en: "Duplicate", es: "Duplicar" },
  "action.edit": { fr: "Modifier", en: "Edit", es: "Modificar" },
  "action.publish": { fr: "Publier", en: "Publish", es: "Publicar" },

  // Kind step
  "kind.title": { fr: "Format du tunnel", en: "Funnel format", es: "Formato del embudo" },
  "kind.help": {
    fr: "Choisissez le format. Les étapes suivantes s'adaptent automatiquement",
    en: "Pick the format. Next steps adapt automatically",
    es: "Elige el formato. Los siguientes pasos se adaptan automáticamente",
  },

  // Mood step
  "mood.title": { fr: "Ambiance et palette", en: "Mood and palette", es: "Ambiente y paleta" },
  "mood.help": {
    fr: "Choisissez une intention visuelle. Vous pouvez ajuster les couleurs après",
    en: "Pick a visual intention. You can fine-tune colors afterwards",
    es: "Elige una intención visual. Puedes ajustar los colores después",
  },
  "mood.primary": { fr: "Couleur principale", en: "Primary color", es: "Color principal" },
  "mood.secondary": { fr: "Couleur secondaire", en: "Secondary color", es: "Color secundario" },

  // About step
  "about.title": { fr: "À propos de vous", en: "About you", es: "Acerca de ti" },
  "about.help": {
    fr: "Quelques lignes sur votre parcours, votre légitimité, votre histoire courte",
    en: "A few lines about your background, credibility, short story",
    es: "Unas líneas sobre tu trayectoria, legitimidad, historia corta",
  },
  "about.placeholder": {
    fr: "Ex : Coach business depuis 8 ans, accompagne plus de 200 entrepreneurs",
    en: "Ex: Business coach for 8 years, helped 200+ entrepreneurs",
    es: "Ej: Coach de negocios desde hace 8 años, acompaña a más de 200 emprendedores",
  },

  // Video step
  "video.title": { fr: "Vidéo principale", en: "Main video", es: "Video principal" },
  "video.help": {
    fr: "Collez l'URL d'une vidéo YouTube, Vimeo ou un lien direct",
    en: "Paste a YouTube, Vimeo or direct link",
    es: "Pega una URL de YouTube, Vimeo o un enlace directo",
  },
  "video.url": { fr: "URL de la vidéo", en: "Video URL", es: "URL del video" },
  "video.poster": { fr: "Image de couverture (optionnel)", en: "Poster image (optional)", es: "Imagen de portada (opcional)" },

  // Generation
  "gen.checking": { fr: "Vérification de la clé IA…", en: "Checking AI key…", es: "Verificando la clave IA…" },
  "gen.keyMissing": { fr: "Clé OpenAI absente, le mode démo sera utilisé", en: "OpenAI key missing, demo mode will be used", es: "Falta la clave OpenAI, se usará el modo demo" },
  "gen.keyInvalid": { fr: "Clé OpenAI invalide. Vérifiez votre configuration", en: "Invalid OpenAI key. Check your configuration", es: "Clave OpenAI inválida. Comprueba tu configuración" },
  "gen.keyOk": { fr: "Clé IA opérationnelle", en: "AI key working", es: "Clave IA operativa" },
};

export function tWizard(lang: Language, key: string): string {
  const entry = WIZARD_DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.fr;
}
