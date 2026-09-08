import type { CtaConfig, FunnelSection } from "@/lib/funnels/types";

function mergeCtaCopy(
  previous: CtaConfig | undefined,
  generated: CtaConfig | undefined,
): CtaConfig | undefined {
  if (!previous) return generated;
  if (!generated?.label) return previous;
  return { ...previous, label: generated.label };
}

function findGeneratedSection(
  generated: FunnelSection[],
  previous: FunnelSection,
  index: number,
  used: Set<number>,
): { section: FunnelSection; index: number } | null {
  if (generated[index]?.type === previous.type && !used.has(index)) {
    return { section: generated[index], index };
  }
  const sameTypeIndex = generated.findIndex(
    (section, candidateIndex) =>
      !used.has(candidateIndex) && section.type === previous.type,
  );
  return sameTypeIndex >= 0
    ? { section: generated[sameTypeIndex], index: sameTypeIndex }
    : null;
}

/**
 * Une régénération de page existante réécrit le copy, pas le template.
 * Les champs de présentation et les réglages fonctionnels viennent donc de la
 * section existante. Une nouvelle section sans correspondance garde le rendu
 * proposé par le générateur.
 */
export function mergeRegeneratedSections(
  previous: FunnelSection[],
  generated: FunnelSection[],
): FunnelSection[] {
  const used = new Set<number>();

  return previous.map((current, index) => {
    const match = findGeneratedSection(generated, current, index, used);
    if (!match) return current;
    used.add(match.index);
    const next = match.section;

    return {
      ...current,
      eyebrow: next.eyebrow,
      headline: next.headline || current.headline,
      subheadline: next.subheadline,
      body: next.body,
      bullets: next.bullets,
      cta: mergeCtaCopy(current.cta, next.cta),
      secondaryCta: mergeCtaCopy(current.secondaryCta, next.secondaryCta),
      // Les champs et timers sont des réglages, pas du copy. Les autres items
      // riches (FAQ, témoignages, tarifs…) restent régénérables.
      items:
        current.type === "form" || current.type === "booking"
          ? current.items
          : next.items ?? current.items,
    };
  });
}
