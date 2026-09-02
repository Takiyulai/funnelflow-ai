// lib/i18n/wizard.ts
import type { Language } from "@/lib/funnels/types";

type Dict = Record<string, { fr: string; en: string; es: string }>;

export const WIZARD_DICT: Dict = {
  // Steps
  "step.kind": { fr: "Quel type de tunnel souhaitez-vous ?", en: "What type of funnel would you like?", es: "¿Qué tipo de embudo quieres?" },
  "step.objective": { fr: "Quel est votre objectif ?", en: "What is your goal?", es: "¿Cuál es tu objetivo?" },
  "step.business": { fr: "Quelle est votre marque ?", en: "What is your brand?", es: "¿Cuál es tu marca?" },
  "step.offer": { fr: "Quelle est votre offre ?", en: "What is your offer?", es: "¿Cuál es tu oferta?" },
  "step.audience": { fr: "À qui vous adressez-vous ?", en: "Who is your target audience?", es: "¿A quién te diriges?" },
  "step.about": { fr: "Quel est votre parcours ?", en: "What is your background?", es: "¿Cuál es tu trayectoria?" },
  "step.video": { fr: "Quelle vidéo souhaitez-vous utiliser ?", en: "Which video would you like to use?", es: "¿Qué vídeo quieres utilizar?" },
  "step.cta": { fr: "Quelle action attendez-vous ?", en: "What action should visitors take?", es: "¿Qué acción esperas de tus visitantes?" },
  "step.images": { fr: "Comment illustrer votre tunnel ?", en: "How would you like to illustrate your funnel?", es: "¿Cómo quieres ilustrar tu embudo?" },
  "step.mood": { fr: "Quelle ambiance souhaitez-vous créer ?", en: "What mood would you like to create?", es: "¿Qué ambiente quieres crear?" },
  "step.design": { fr: "Quel modèle préférez-vous ?", en: "Which template do you prefer?", es: "¿Qué plantilla prefieres?" },
  "step.generation": { fr: "Prêt à générer votre tunnel ?", en: "Ready to generate your funnel?", es: "¿Listo para generar tu embudo?" },

  "step.copywriting": { fr: "Quel ton souhaitez-vous adopter ?", en: "What tone would you like to use?", es: "¿Qué tono quieres adoptar?" },
  "step.media": { fr: "Quels médias souhaitez-vous ajouter ?", en: "Which media would you like to add?", es: "¿Qué medios quieres añadir?" },

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
  "kind.title": { fr: "Quel type de tunnel souhaitez-vous créer ?", en: "What type of funnel would you like to create?", es: "¿Qué tipo de embudo quieres crear?" },
  "kind.help": {
    fr: "Choisissez le format. Les étapes suivantes s'adaptent automatiquement",
    en: "Pick the format. Next steps adapt automatically",
    es: "Elige el formato. Los siguientes pasos se adaptan automáticamente",
  },

  // Mood step
  "mood.title": { fr: "Quelle ambiance souhaitez-vous créer ?", en: "What mood would you like to create?", es: "¿Qué ambiente quieres crear?" },
  "mood.help": {
    fr: "Choisissez une intention visuelle. Vous pouvez ajuster les couleurs après",
    en: "Pick a visual intention. You can fine-tune colors afterwards",
    es: "Elige una intención visual. Puedes ajustar los colores después",
  },
  "mood.primary": { fr: "Quelle est votre couleur principale ?", en: "What is your primary color?", es: "¿Cuál es tu color principal?" },
  "mood.secondary": { fr: "Quelle est votre couleur secondaire ?", en: "What is your secondary color?", es: "¿Cuál es tu color secundario?" },

  // About step
  "about.title": { fr: "Quel est votre parcours ?", en: "What is your background?", es: "¿Cuál es tu trayectoria?" },
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
  "video.title": { fr: "Quelle vidéo souhaitez-vous utiliser ?", en: "Which video would you like to use?", es: "¿Qué vídeo quieres utilizar?" },
  "video.help": {
    fr: "Collez l'URL d'une vidéo YouTube, Vimeo ou un lien direct",
    en: "Paste a YouTube, Vimeo or direct link",
    es: "Pega una URL de YouTube, Vimeo o un enlace directo",
  },
  "video.url": { fr: "Quel est le lien de votre vidéo ?", en: "What is your video URL?", es: "¿Cuál es el enlace de tu vídeo?" },
  "video.poster": { fr: "Quelle image de couverture souhaitez-vous ? (optionnel)", en: "Which cover image would you like? (optional)", es: "¿Qué imagen de portada quieres? (opcional)" },

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
