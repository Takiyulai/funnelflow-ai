"use client";

import { Wand2, CheckCircle2 } from "lucide-react";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import type {
  Language,
  CopywritingPrefs,
  CopywritingTone,
  CopywritingLength,
} from "@/lib/funnels/types";

const LABELS = {
  fr: {
    title: "Quel style d’écriture souhaitez-vous ?",
    intro:
      "Précisez comment l'IA doit écrire. Toutes les options sont facultatives.",
    toneLabel: "Quel ton souhaitez-vous adopter ?",
    lengthLabel: "Quelle longueur de texte préférez-vous ?",
    exampleLabel: "Quelle phrase représente votre style ? (optionnel)",
    examplePlaceholder:
      "Ex. on ne vend pas un ebook, on transmet une méthode qui a déjà fait ses preuves.",
    avoidLabel: "Quels mots ou expressions souhaitez-vous éviter ? (séparés par une virgule)",
    avoidPlaceholder: "révolutionnaire, incroyable, magique",
  },
  en: {
    title: "What writing style would you like?",
    intro: "Tell the AI how to write. All fields are optional.",
    toneLabel: "What tone would you like to use?",
    lengthLabel: "How long should the copy be?",
    exampleLabel: "Which sentence represents your style? (optional)",
    examplePlaceholder:
      "E.g. we don't sell an ebook, we share a method that already works.",
    avoidLabel: "Which words should be avoided? (comma-separated)",
    avoidPlaceholder: "revolutionary, amazing, magical",
  },
  es: {
    title: "¿Qué estilo de escritura prefieres?",
    intro:
      "Indica cómo debe escribir la IA. Todos los campos son opcionales.",
    toneLabel: "¿Qué tono quieres adoptar?",
    lengthLabel: "¿Qué longitud de texto prefieres?",
    exampleLabel: "¿Qué frase representa tu estilo? (opcional)",
    examplePlaceholder:
      "Ej. no vendemos un ebook, transmitimos un método ya probado.",
    avoidLabel: "¿Qué palabras quieres evitar? (separadas por coma)",
    avoidPlaceholder: "revolucionario, increíble, mágico",
  },
} as const;

const TONES: { value: CopywritingTone; fr: string; en: string; es: string; hint: { fr: string; en: string; es: string } }[] = [
  {
    value: "direct",
    fr: "Direct",
    en: "Direct",
    es: "Directo",
    hint: {
      fr: "Phrases courtes, zéro fioriture, droit au but",
      en: "Short sentences, no fluff, straight to the point",
      es: "Frases cortas, sin adornos, al grano",
    },
  },
  {
    value: "empathique",
    fr: "Empathique",
    en: "Empathetic",
    es: "Empático",
    hint: {
      fr: "Comprend la douleur du lecteur, rassure, humanise",
      en: "Understands the reader's pain, reassures, humanizes",
      es: "Entiende el dolor del lector, tranquiliza, humaniza",
    },
  },
  {
    value: "storytelling",
    fr: "Storytelling",
    en: "Storytelling",
    es: "Storytelling",
    hint: {
      fr: "Avant/après, anecdotes, narration immersive",
      en: "Before/after, anecdotes, immersive narration",
      es: "Antes/después, anécdotas, narración inmersiva",
    },
  },
  {
    value: "expert",
    fr: "Expert",
    en: "Expert",
    es: "Experto",
    hint: {
      fr: "Vocabulaire précis, autorité, méthodologie claire",
      en: "Precise vocabulary, authority, clear methodology",
      es: "Vocabulario preciso, autoridad, metodología clara",
    },
  },
  {
    value: "amical",
    fr: "Amical",
    en: "Friendly",
    es: "Amistoso",
    hint: {
      fr: "Tutoiement, ton accessible, complice",
      en: "Casual, accessible, like talking to a friend",
      es: "Tuteo, tono accesible, cómplice",
    },
  },
  {
    value: "premium",
    fr: "Premium",
    en: "Premium",
    es: "Premium",
    hint: {
      fr: "Sobre, élégant, exigeant, sans superlatifs creux",
      en: "Refined, elegant, demanding, no empty superlatives",
      es: "Sobrio, elegante, exigente, sin superlativos vacíos",
    },
  },
];

const LENGTHS: { value: CopywritingLength; fr: string; en: string; es: string }[] = [
  { value: "concise", fr: "Concis (textes courts)", en: "Concise (short copy)", es: "Conciso (textos cortos)" },
  { value: "balanced", fr: "Équilibré (recommandé)", en: "Balanced (recommended)", es: "Equilibrado (recomendado)" },
  { value: "detailed", fr: "Détaillé (textes plus riches)", en: "Detailed (richer copy)", es: "Detallado (textos más ricos)" },
];

export function CopywritingStep({
  language,
  prefs,
  onChange,
}: {
  language: Language;
  prefs?: CopywritingPrefs;
  onChange: (next: CopywritingPrefs) => void;
}) {
  const L = LABELS[language] ?? LABELS.fr;
  const current = prefs ?? {};

  function update(patch: Partial<CopywritingPrefs>) {
    onChange({ ...current, ...patch });
  }

  function updateAvoidWords(raw: string) {
    const list = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    update({ avoidWords: list.length > 0 ? list : undefined });
  }

  const avoidString = (current.avoidWords ?? []).join(", ");

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <Wand2 className="text-[#31845C]" size={20} />
          <h2 className="text-xl font-black">{L.title}</h2>
        </div>
        <p className="mt-1 text-xs text-muted">{L.intro}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-ink">{L.toneLabel}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TONES.map((t) => {
            const active = current.tone === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ tone: t.value })}
                className={`rounded-lg border p-3 text-left transition-all duration-200 ${
                  active
                    ? "border-[#31845C] bg-[#31845C]/10 shadow-sm"
                    : "border-line bg-white hover:border-[#080E1A]/30"
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-bold text-ink">
                  {t[language] ?? t.fr}
                  {active && (
                    <CheckCircle2 size={14} className="text-[#31845C]" />
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {t.hint[language] ?? t.hint.fr}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Field label={L.lengthLabel}>
        <Select
          value={current.length ?? "balanced"}
          onChange={(e) =>
            update({ length: e.target.value as CopywritingLength })
          }
        >
          {LENGTHS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt[language] ?? opt.fr}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={L.exampleLabel}>
        <Textarea
          value={current.exampleSentence ?? ""}
          onChange={(e) =>
            update({ exampleSentence: e.target.value || undefined })
          }
          placeholder={L.examplePlaceholder}
          rows={3}
        />
      </Field>

      <Field label={L.avoidLabel}>
        <Input
          value={avoidString}
          onChange={(e) => updateAvoidWords(e.target.value)}
          placeholder={L.avoidPlaceholder}
        />
      </Field>
    </div>
  );
}
