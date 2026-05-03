// lib/funnels/moods.ts
import type { MoodPreset, MoodId } from "./types";

export const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "premium-calm",
    label: {
      fr: "Premium et calme",
      en: "Premium and calm",
      es: "Premium y tranquilo",
    },
    description: {
      fr: "Crédibilité haut de gamme, espaces aérés, contraste maîtrisé",
      en: "High-end credibility, airy spacing, controlled contrast",
      es: "Credibilidad de alta gama, espacios amplios, contraste medido",
    },
    primary: "#080E1A",
    secondary: "#C7A436",
    accent: "#31845C",
  },
  {
    id: "energetic",
    label: {
      fr: "Énergique et direct",
      en: "Energetic and direct",
      es: "Enérgico y directo",
    },
    description: {
      fr: "Couleurs vives, rythme rapide, message percutant",
      en: "Bright colors, fast rhythm, punchy message",
      es: "Colores vivos, ritmo rápido, mensaje contundente",
    },
    primary: "#0A1020",
    secondary: "#FFB020",
    accent: "#1ECB83",
  },
  {
    id: "institutional-trust",
    label: {
      fr: "Confiance institutionnelle",
      en: "Institutional trust",
      es: "Confianza institucional",
    },
    description: {
      fr: "Bleu profond, sérieux, rassurant pour les décideurs",
      en: "Deep blue, serious, reassuring for decision-makers",
      es: "Azul profundo, serio, tranquilizador para directivos",
    },
    primary: "#061B36",
    secondary: "#08498D",
    accent: "#28D6D6",
  },
  {
    id: "creative-warm",
    label: {
      fr: "Créatif et chaleureux",
      en: "Creative and warm",
      es: "Creativo y cálido",
    },
    description: {
      fr: "Tons chauds, personnalité, proche du créateur indépendant",
      en: "Warm tones, personality, close to the indie creator",
      es: "Tonos cálidos, personalidad, cerca del creador independiente",
    },
    primary: "#1E1208",
    secondary: "#E07A3E",
    accent: "#C7A436",
  },
];

export function getMood(id?: MoodId | string): MoodPreset | undefined {
  if (!id) return undefined;
  return MOOD_PRESETS.find((m) => m.id === id);
}
