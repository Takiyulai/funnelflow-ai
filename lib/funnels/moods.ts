// lib/funnels/moods.ts
import type { MoodPreset, MoodId } from "./types";

export const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "premium-calm",
    label: {
      fr: "Luxe et Sérénité",
      en: "Luxury & Calm",
      es: "Lujo y Serenidad",
    },
    description: {
      fr: "Espaces aérés, typographie fine, contrastes doux pour offres exclusives.",
      en: "Airy spaces, fine typography, soft contrasts for exclusive offers.",
      es: "Espacios aireados, tipografía fina, contrastes suaves para ofertas exclusivas.",
    },
    primary: "#0A0A0A",
    secondary: "#D4AF37",
    accent: "#E5E7EB",
  },
  {
    id: "energetic",
    label: {
      fr: "Impact et Momentum",
      en: "Impact & Momentum",
      es: "Impacto y Momentum",
    },
    description: {
      fr: "Couleurs vibrantes, rythme rapide, message percutant et direct.",
      en: "Vibrant colors, fast rhythm, punchy and direct message.",
      es: "Colores vibrantes, ritmo rápido, mensaje directo y potente.",
    },
    primary: "#000000",
    secondary: "#3B82F6",
    accent: "#10B981",
  },
  {
    id: "institutional-trust",
    label: {
      fr: "Autorité Professionnelle",
      en: "Professional Authority",
      es: "Autoridad Profesional",
    },
    description: {
      fr: "Bleu profond, sérieux, rassurant pour le B2B et la tech.",
      en: "Deep blue, serious, reassuring for B2B and tech.",
      es: "Azul profundo, serio, tranquilizador para B2B y tecnología.",
    },
    primary: "#0B1E3D",
    secondary: "#06B6D4",
    accent: "#64748B",
  },
  {
    id: "creative-warm",
    label: {
      fr: "Chaleur Créative",
      en: "Creative Warmth",
      es: "Calidez Creativa",
    },
    description: {
      fr: "Tons terreux, authenticité, proche de l'humain et du créateur.",
      en: "Earthy tones, authenticity, human-centric and creative.",
      es: "Tonos tierra, autenticidad, centrado en lo humano y creativo.",
    },
    primary: "#1A0F08",
    secondary: "#E07A3E",
    accent: "#F59E0B",
  },
  {
    id: "modern-minimal",
    label: { fr: "Minimaliste Moderne", en: "Modern Minimalist", es: "Minimalista Moderno" },
    description: { fr: "Style Linear : gris neutres, accents subtils, précision.", en: "Linear style: neutral greys, subtle accents, precision.", es: "Estilo Linear: grises neutros, acentos sutiles, précision." },
    primary: "#09090B",
    secondary: "#FFFFFF",
    accent: "#3B82F6",
  },
];


export function getMood(id?: MoodId | string): MoodPreset | undefined {
  if (!id) return undefined;
  return MOOD_PRESETS.find((m) => m.id === id);
}
