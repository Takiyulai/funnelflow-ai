// lib/ab/assign.ts
//
// 🆕 MODULE 3 — Affectation d'un visiteur à une variante.
//
// LE PIÈGE À ÉVITER. Le réflexe est `Math.random() < 0.5`. Il produit un test
// qui ne mesure RIEN : le visiteur voit la variante A, recharge, voit la B,
// revient le lendemain, voit la A. Ses vues se répartissent entre les deux
// colonnes et sa conversion atterrit sur celle qu'il avait au moment du
// formulaire — sans rapport avec la page qui l'a convaincu.
//
// LA SOLUTION RETENUE. L'affectation est DÉTERMINISTE : on hache l'identifiant
// du test concaténé à l'identifiant visiteur, et on compare le reste modulo
// 100 au pourcentage de répartition. Conséquences :
//   • même visiteur + même test → toujours la même variante, sans rien stocker ;
//   • deux tests différents affectent le même visiteur indépendamment (l'id du
//     test entre dans le hachage), donc pas de corrélation parasite entre
//     tests simultanés sur des pages différentes.
//
// Le hachage est FNV-1a 32 bits : rapide, sans dépendance, et surtout
// disponible à l'identique côté serveur et côté client. Ce n'est PAS un
// hachage cryptographique et il n'a pas à l'être — il n'y a rien à protéger
// ici, seulement à répartir uniformément.

/** FNV-1a 32 bits. Déterministe, stable dans le temps et entre exécutions. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Math.imul : multiplication 32 bits exacte (l'opérateur * passerait en
    // flottant au-delà de 2^53 et casserait l'uniformité de la répartition).
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Variant = "a" | "b";

/**
 * Variante servie à ce visiteur pour ce test.
 *
 * @param visitorKey    identifiant anonyme du visiteur (cookie ff_ab)
 * @param testId        identifiant du test
 * @param splitPercentB pourcentage du trafic dirigé vers B (1 à 99)
 */
export function pickVariant(
  visitorKey: string,
  testId: string,
  splitPercentB: number,
): Variant {
  // Bornes défensives : une valeur hors plage viderait une des deux colonnes
  // sans que personne ne comprenne pourquoi le test ne converge jamais.
  const split = Math.min(99, Math.max(1, Math.round(splitPercentB)));
  const bucket = fnv1a32(`${testId}:${visitorKey}`) % 100;
  return bucket < split ? "b" : "a";
}

/**
 * Taux de conversion d'une variante, en pourcentage. Retourne 0 sans vue —
 * jamais NaN, qui se propagerait jusque dans l'affichage.
 */
export function conversionRate(views: number, conversions: number): number {
  if (!views) return 0;
  return (conversions / views) * 100;
}

/**
 * Lecture HONNÊTE d'un résultat de test.
 *
 * Un tableau de bord qui annonce « B gagne de 12 % » sur 30 visiteurs pousse à
 * de mauvaises décisions : à ce volume, l'écart est du bruit. On refuse donc de
 * désigner un gagnant sous un seuil minimal, et on le dit explicitement.
 *
 * Le calcul reste volontairement simple (pas de test statistique complet) : il
 * s'agit d'empêcher les conclusions hâtives, pas de publier un article. Le
 * seuil de 100 vues par variante est un garde-fou pragmatique, pas une vérité
 * mathématique.
 */
export const MIN_VIEWS_PER_VARIANT = 100;

export type AbReading = {
  rateA: number;
  rateB: number;
  /** Écart relatif de B par rapport à A, en pourcentage. */
  liftPercent: number;
  /** Volume suffisant pour se prononcer ? */
  conclusive: boolean;
  leader: Variant | null;
  /** Phrase prête à afficher, formulée sans surpromesse. */
  summary: string;
};

export function readResult(
  a: { views: number; conversions: number },
  b: { views: number; conversions: number },
): AbReading {
  const rateA = conversionRate(a.views, a.conversions);
  const rateB = conversionRate(b.views, b.conversions);
  const liftPercent = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : rateB > 0 ? 100 : 0;

  const enoughData =
    a.views >= MIN_VIEWS_PER_VARIANT && b.views >= MIN_VIEWS_PER_VARIANT;
  const leader = rateB > rateA ? "b" : rateA > rateB ? "a" : null;

  if (!enoughData) {
    const missing = Math.max(
      MIN_VIEWS_PER_VARIANT - a.views,
      MIN_VIEWS_PER_VARIANT - b.views,
    );
    return {
      rateA,
      rateB,
      liftPercent,
      conclusive: false,
      leader,
      summary: `Trop tôt pour conclure — il manque environ ${missing} visiteur${missing > 1 ? "s" : ""} sur la variante la moins vue.`,
    };
  }

  if (!leader) {
    return {
      rateA,
      rateB,
      liftPercent,
      conclusive: true,
      leader: null,
      summary: "Les deux variantes convertissent au même rythme.",
    };
  }

  const sign = liftPercent >= 0 ? "+" : "";
  return {
    rateA,
    rateB,
    liftPercent,
    conclusive: true,
    leader,
    summary:
      leader === "b"
        ? `La variante B convertit mieux (${sign}${liftPercent.toFixed(1)} % par rapport à A).`
        : `La variante A reste devant (B fait ${sign}${liftPercent.toFixed(1)} %).`,
  };
}
