// lib/funnels/sectionVariants.ts
//
// 🆕 Anti-monotonie : attribue à chaque section « cartes » d'une page une
// VARIANTE de disposition (0..N-1) de façon DÉTERMINISTE (seedée par le tunnel
// → identique en SSR et à l'hydratation, pas de Math.random) et ORDONNÉE (deux
// sections cartes voisines n'ont jamais la même variante). Consommé par les
// skins (components/funnel/templates/skins/factory.tsx) via la prop `variant`.

/** Hash de chaîne stable (djb2), renvoie un entier non signé. */
export function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (((h << 5) + h) + input.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Types de sections « cartes » éligibles aux variantes de disposition.
 *  (qualification / solution / benefits passent tous par makeCards → sans
 *  variante ils rendaient un style de cartes IDENTIQUE, d'où la monotonie.
 *  process/program ont leur propre rendu — non concernés ici.) */
export const CARD_VARIANT_TYPES: ReadonlySet<string> = new Set([
  "qualification",
  "solution",
  "benefits",
]);

/** Nombre de variantes de cartes disponibles dans la factory. */
export const CARD_VARIANT_COUNT = 3;

type OrderedSection = { id: string; type: string };

/**
 * Attribue une variante déterministe à chaque section « cartes », dans l'ordre
 * de la page, sans jamais répéter la variante de la section cartes précédente.
 * `seed` : identifiant stable du tunnel/page (ex : `${funnelName}:${pageId}`).
 */
export function assignCardVariants(
  ordered: OrderedSection[],
  seed: string,
): Map<string, number> {
  const map = new Map<string, number>();
  if (CARD_VARIANT_COUNT <= 1) return map;
  let prev = -1;
  for (const s of ordered) {
    if (!CARD_VARIANT_TYPES.has(s.type)) continue;
    let v = stableHash(`${seed}:${s.id}`) % CARD_VARIANT_COUNT;
    if (v === prev) v = (v + 1) % CARD_VARIANT_COUNT;
    map.set(s.id, v);
    prev = v;
  }
  return map;
}
