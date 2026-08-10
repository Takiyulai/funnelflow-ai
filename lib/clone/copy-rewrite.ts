// lib/clone/copy-rewrite.ts
//
// Réécriture du COPY d'une page clonée par l'IA — noyau pur.
//
// ── L'INVARIANT, ET POURQUOI IL TIENT ──────────────────────────────────────
// L'utilisateur doit pouvoir réécrire les textes d'un tunnel cloné par un
// prompt, SANS que le squelette, la mise en page, le design ni les médias ne
// bougent. Cette garantie n'est PAS confiée au modèle : elle est structurelle.
//
// Un clone se compose de deux choses stockées séparément :
//   • le HTML capturé, jamais modifié ;
//   • un `RawHtmlPatch`, appliqué par-dessus au rendu.
//
// Ce module ne produit qu'une forme réduite de patch :
//
//     { texts?: Record<id, string>, links?: Record<id, { label: string }> }
//
// Jamais `images`, jamais `colors`, jamais `background`, et jamais `href` dans
// `links` (cf. toRawHtmlCopyPatch, qui est le seul point de sortie). Le modèle
// ne renvoie que des chaînes indexées par identifiant : il n'a aucun moyen
// d'exprimer une balise, une classe, une couleur ou une URL. Une réécriture
// ratée produit du mauvais texte — jamais une page cassée. Et l'annuler, c'est
// supprimer le patch : le clone d'origine est toujours là, intact.
//
// ── CE QUE LE MODÈLE PEUT QUAND MÊME CASSER ────────────────────────────────
// Une chose : la LONGUEUR. Un titre de quatre mots remplacé par vingt fait
// sauter la mise en page sans qu'une seule règle CSS n'ait changé. C'est le
// seul vrai risque, et c'est pour lui qu'existe le budget de longueur
// ci-dessous. Les boutons sont les plus fragiles, d'où un budget plus serré.
//
// ── PURETÉ ─────────────────────────────────────────────────────────────────
// Aucun accès au DOM, aucun appel réseau, aucun import à effet de bord : les
// deux seuls imports sont un type (effacé à la compilation) et une fonction de
// normalisation à base de regex. Ce module est donc testable intégralement en
// unitaire, sans navigateur ni jsdom.

import { normalize, type Spot, type TextSubKind } from "./raw-html-walker";

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

/** Nature du texte du point de vue du copy — pas du DOM. */
export type CopyKind = "text" | "link-label";

/**
 * Un emplacement de copy, projeté hors du DOM.
 *
 * `Spot` porte une référence `element` vivante : inutilisable côté serveur et
 * insérialisable. `CopyItem` en est la projection sérialisable — c'est elle
 * qui voyage jusqu'au modèle et revient.
 */
export interface CopyItem {
  /** Identifiant du spot, tel que produit par le walker (collisions résolues). */
  id: string;
  kind: CopyKind;
  /** Texte actuel, normalisé. */
  text: string;
  /** Rôle éditorial — sert à guider le modèle (titre court, paragraphe…). */
  subKind: TextSubKind;
  /** Balise d'origine (h1, p, a, button…), indice de hiérarchie visuelle. */
  tag: string;
}

export interface CopyLengthBudget {
  min: number;
  max: number;
}

export interface CopyRewriteLimits {
  /** Facteur d'allongement toléré pour un texte courant. */
  textMaxRatio: number;
  /** Facteur d'allongement toléré pour un libellé de bouton/lien. */
  linkMaxRatio: number;
  /**
   * Marge absolue en caractères, ajoutée au plafond proportionnel.
   * Sans elle, un libellé de 6 caractères aurait un plafond de 7 : intenable.
   */
  textSlack: number;
  linkSlack: number;
  /**
   * En dessous de ce seuil, aucun plancher proportionnel n'est appliqué :
   * raccourcir « Réservez votre place » en « Réserver » est légitime.
   */
  shortTextThreshold: number;
  /** Plancher proportionnel au-delà du seuil, pour éviter l'effondrement. */
  minRatio: number;
  /** Plafond dur, aligné sur MAX_TEXT_LEN du walker. */
  hardMax: number;
}

export const DEFAULT_COPY_LIMITS: CopyRewriteLimits = {
  textMaxRatio: 1.3,
  linkMaxRatio: 1.15,
  textSlack: 12,
  linkSlack: 6,
  shortTextThreshold: 24,
  minRatio: 0.45,
  hardMax: 1200,
};

export type FrozenReason =
  | "too-short"
  | "no-letters"
  | "price"
  | "legal";

export type RejectionReason =
  | "unknown-id"
  | "not-a-string"
  | "empty"
  | "contains-markup"
  | "too-long"
  | "too-short"
  | "frozen";

export interface CopyRejection {
  id: string;
  reason: RejectionReason;
  /** Ce que le modèle a proposé, tronqué — pour l'affichage du rapport. */
  proposed: string;
  /** Budget applicable, renseigné pour les rejets de longueur. */
  budget?: CopyLengthBudget;
}

export interface CopyRewriteReview {
  /** Réécritures retenues : id → nouveau texte. */
  accepted: Record<string, string>;
  /** Identifiants renvoyés inchangés — non repris dans le patch. */
  unchanged: string[];
  /** Identifiants soumis au modèle mais absents de sa réponse. */
  missing: string[];
  rejected: CopyRejection[];
  /**
   * Vrai quand la réponse est inexploitable dans son ensemble (format invalide,
   * ou aucune réécriture retenue alors que des emplacements ont été soumis).
   * L'appelant doit alors relancer plutôt que d'appliquer un patch vide.
   */
  fatal: boolean;
  stats: {
    submitted: number;
    accepted: number;
    unchanged: number;
    rejected: number;
    missing: number;
  };
}

/**
 * La seule forme de patch que ce module sait produire.
 *
 * Volontairement plus étroite que `RawHtmlPatch` : pas de `images`, pas de
 * `colors`, pas de `background`, et `links` sans `href`. Elle est assignable à
 * `RawHtmlPatch` — c'est un sous-ensemble, pas un type parallèle.
 */
export interface RawHtmlCopyPatch {
  texts?: Record<string, string>;
  links?: Record<string, { label: string }>;
}

// ───────────────────────────────────────────────────────────────────────────
// Emplacements gelés
// ───────────────────────────────────────────────────────────────────────────

/** Au moins une lettre latine (fr/en/es couverts, accents inclus). */
const HAS_LETTER = /[a-zà-öø-ÿ]/i;

/** « 97 € », « $1,997 », « 29,90 EUR », « 15000 FCFA » et leurs inversions. */
const PRICE_ONLY =
  /^\s*(?:(?:€|\$|£|USD|EUR|XOF|XAF|CHF|CAD|MAD|DZD|TND)\s*[\d\s.,]+|[\d\s.,]+\s*(?:€|\$|£|USD|EUR|XOF|XAF|F\s?CFA|FCFA|CFA|CHF|CAD|MAD|DZD|TND))\s*$/i;

const LEGAL_HINT =
  /^\s*(?:©|copyright\b|tous droits réservés|all rights reserved|todos los derechos|mentions légales|conditions générales|cgv\b|cgu\b|politique de confidentialité|privacy policy|terms of service|aviso legal)/i;

/**
 * Emplacements qu'on ne soumet jamais au modèle.
 *
 * Il ne s'agit pas de prudence excessive : laisser un modèle réécrire « 97 € »
 * ou « 00:04:59 » produit au mieux du bruit, au pire un prix faux affiché à des
 * prospects. Ces textes ne relèvent pas du copy.
 */
export function isFrozenCopy(text: string): FrozenReason | null {
  const t = normalize(text);
  if (t.length < 3) return "too-short";
  if (!HAS_LETTER.test(t)) return "no-letters";
  if (PRICE_ONLY.test(t)) return "price";
  if (LEGAL_HINT.test(t)) return "legal";
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Collecte
// ───────────────────────────────────────────────────────────────────────────

/**
 * Projette les spots du walker en emplacements de copy soumissibles.
 *
 * Prend `readonly Spot[]` : l'appelant remplit ce tableau via l'option
 * `collectInto` d'`applyRawHtmlPatches`, seul endroit qui connaisse les
 * identifiants définitifs (suffixés en cas de collision). Ne JAMAIS recalculer
 * un identifiant par hachage ici : deux textes identiques partagent le même
 * hash et seul l'ordre de parcours les distingue.
 *
 * Les spots `image` sont ignorés — ce module ne touche pas aux médias.
 */
export function collectCopyItems(spots: readonly Spot[]): CopyItem[] {
  const items: CopyItem[] = [];
  const seen = new Set<string>();

  for (const spot of spots) {
    if (spot.kind === "image") continue;

    const text = normalize(
      spot.kind === "text" ? spot.original : spot.label,
    );
    if (!text) continue;
    if (isFrozenCopy(text)) continue;

    // Garde-fou : `collectInto` garantit déjà l'unicité, mais un patch appliqué
    // deux fois de suite pourrait la rompre. Le premier gagne.
    if (seen.has(spot.id)) continue;
    seen.add(spot.id);

    items.push(
      spot.kind === "text"
        ? {
            id: spot.id,
            kind: "text",
            text,
            subKind: spot.subKind,
            tag: spot.tag,
          }
        : {
            id: spot.id,
            kind: "link-label",
            text,
            subKind: "short",
            tag: spot.isCta ? "button" : "a",
          },
    );
  }

  return items;
}

/**
 * Découpe en lots tenant dans une enveloppe de caractères.
 *
 * Une page clonée dépasse couramment les 300 emplacements : tout envoyer d'un
 * bloc coûte cher et dégrade la qualité en fin de liste. Le découpage préserve
 * l'ordre du document, ce qui garde la cohérence narrative à l'intérieur d'un
 * lot. Un emplacement plus gros que l'enveloppe part seul plutôt que d'être
 * tronqué.
 */
export function chunkCopyItems(
  items: readonly CopyItem[],
  maxCharsPerChunk = 6000,
): CopyItem[][] {
  const chunks: CopyItem[][] = [];
  let current: CopyItem[] = [];
  let size = 0;

  for (const item of items) {
    // ~24 caractères d'enveloppe JSON par entrée (identifiant, guillemets,
    // séparateurs) : approximation volontairement généreuse.
    const cost = item.text.length + item.id.length + 24;
    if (current.length > 0 && size + cost > maxCharsPerChunk) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += cost;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ───────────────────────────────────────────────────────────────────────────
// Budget de longueur
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fourchette de longueur admissible pour un emplacement.
 *
 * C'est la seule protection réelle de la mise en page : le HTML ne bouge pas,
 * mais un texte trois fois plus long déborde de son conteneur, casse une grille
 * ou fait passer un bouton sur deux lignes.
 */
export function lengthBudget(
  item: CopyItem,
  limits: CopyRewriteLimits = DEFAULT_COPY_LIMITS,
): CopyLengthBudget {
  const len = item.text.length;
  const isLink = item.kind === "link-label";
  const ratio = isLink ? limits.linkMaxRatio : limits.textMaxRatio;
  const slack = isLink ? limits.linkSlack : limits.textSlack;

  const max = Math.min(
    limits.hardMax,
    Math.max(Math.round(len * ratio), len + slack),
  );

  // Raccourcir un texte court est presque toujours une amélioration ; ce n'est
  // qu'au-delà d'un certain volume qu'un effondrement trahit une réponse
  // tronquée ou un modèle qui a abandonné.
  const min =
    len <= limits.shortTextThreshold
      ? 1
      : Math.max(1, Math.floor(len * limits.minRatio));

  return { min, max };
}

// ───────────────────────────────────────────────────────────────────────────
// Validation de la réponse du modèle
// ───────────────────────────────────────────────────────────────────────────

/** Toute trace de balisage, d'entité HTML ou d'accolade de gabarit. */
const MARKUP = /[<>]|&(?:[a-z]+|#\d+);|\{\{|\}\}/i;

const PREVIEW_LEN = 120;

/**
 * Confronte la réponse du modèle aux emplacements soumis.
 *
 * Le contrat est volontairement tolérant PAR EMPLACEMENT et strict SUR
 * L'ENSEMBLE : un identifiant inventé ou un texte trop long est écarté seul,
 * sans faire tomber les cent réécritures correctes du même lot. En revanche,
 * si rien n'est retenu alors que des emplacements ont été soumis, `fatal`
 * signale qu'il faut relancer plutôt qu'appliquer un patch vide.
 *
 * `proposed` est typé `unknown` à dessein : il vient d'un `JSON.parse` sur une
 * sortie de modèle. Rien n'y est garanti, pas même que ce soit un objet.
 */
export function reviewCopyRewrite(
  items: readonly CopyItem[],
  proposed: unknown,
  limits: CopyRewriteLimits = DEFAULT_COPY_LIMITS,
): CopyRewriteReview {
  const accepted: Record<string, string> = {};
  const unchanged: string[] = [];
  const rejected: CopyRejection[] = [];

  const byId = new Map<string, CopyItem>();
  for (const item of items) byId.set(item.id, item);

  const emptyReview = (): CopyRewriteReview => ({
    accepted: {},
    unchanged: [],
    missing: items.map((i) => i.id),
    rejected: [],
    fatal: items.length > 0,
    stats: {
      submitted: items.length,
      accepted: 0,
      unchanged: 0,
      rejected: 0,
      missing: items.length,
    },
  });

  if (
    proposed === null ||
    typeof proposed !== "object" ||
    Array.isArray(proposed)
  ) {
    return emptyReview();
  }

  const entries = Object.entries(proposed as Record<string, unknown>);
  const answered = new Set<string>();

  for (const [id, rawValue] of entries) {
    const item = byId.get(id);

    if (!item) {
      rejected.push({
        id,
        reason: "unknown-id",
        proposed: preview(rawValue),
      });
      continue;
    }

    answered.add(id);

    if (typeof rawValue !== "string") {
      rejected.push({ id, reason: "not-a-string", proposed: preview(rawValue) });
      continue;
    }

    const value = normalize(rawValue);

    if (!value) {
      rejected.push({ id, reason: "empty", proposed: "" });
      continue;
    }

    // Le patch écrit du texte, pas du HTML — mais une valeur contenant `<span>`
    // finirait échappée et affichée telle quelle au visiteur.
    if (MARKUP.test(value)) {
      rejected.push({
        id,
        reason: "contains-markup",
        proposed: preview(value),
      });
      continue;
    }

    // Un modèle qui renvoie un prix ou une mention légale à un emplacement de
    // copy s'est trompé de tâche : on écarte, même si l'original ne l'était pas.
    if (isFrozenCopy(value)) {
      rejected.push({ id, reason: "frozen", proposed: preview(value) });
      continue;
    }

    const budget = lengthBudget(item, limits);
    if (value.length > budget.max) {
      rejected.push({
        id,
        reason: "too-long",
        proposed: preview(value),
        budget,
      });
      continue;
    }
    if (value.length < budget.min) {
      rejected.push({
        id,
        reason: "too-short",
        proposed: preview(value),
        budget,
      });
      continue;
    }

    if (value === item.text) {
      // Inchangé : hors du patch. Un patch minimal se relit, se diffe et
      // s'annule plus facilement.
      unchanged.push(id);
      continue;
    }

    accepted[id] = value;
  }

  const missing = items.filter((i) => !answered.has(i.id)).map((i) => i.id);
  const acceptedCount = Object.keys(accepted).length;

  return {
    accepted,
    unchanged,
    missing,
    rejected,
    // Ne rien retenir alors qu'on a soumis quelque chose n'est pas un patch
    // vide : c'est un échec. Les emplacements absents gardent leur texte
    // d'origine, ce qui est le comportement voulu et non une erreur.
    fatal: items.length > 0 && acceptedCount === 0 && unchanged.length === 0,
    stats: {
      submitted: items.length,
      accepted: acceptedCount,
      unchanged: unchanged.length,
      rejected: rejected.length,
      missing: missing.length,
    },
  };
}

function preview(value: unknown): string {
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else {
    // `JSON.stringify` rend `undefined` sur `undefined` et lève sur les cycles.
    // Un rapport de rejet ne doit jamais être la cause d'une erreur 500.
    try {
      s = String(JSON.stringify(value));
    } catch {
      s = "[valeur illisible]";
    }
  }
  return s.length > PREVIEW_LEN ? `${s.slice(0, PREVIEW_LEN)}…` : s;
}

// ───────────────────────────────────────────────────────────────────────────
// Sortie
// ───────────────────────────────────────────────────────────────────────────

/**
 * Convertit une revue en patch applicable.
 *
 * ⚠️ POINT DE SORTIE UNIQUE, ET GARANTIE STRUCTURELLE DU MODULE.
 *
 * Cette fonction n'écrit que `texts` et `links[].label`. Elle ne peut pas
 * produire `images`, `colors`, `background`, ni `href` — non par convention,
 * mais parce que rien dans son code ne les construit. Toute évolution qui
 * ajouterait l'une de ces clés ici romprait la promesse faite à l'utilisateur :
 * « le squelette, le design et les médias ne bougent pas ».
 *
 * Les clés absentes ne sont pas émises : un patch vide vaut « aucune
 * modification », pas « tout effacer ».
 */
export function toRawHtmlCopyPatch(
  review: CopyRewriteReview,
  items: readonly CopyItem[],
): RawHtmlCopyPatch {
  const kindById = new Map<string, CopyKind>();
  for (const item of items) kindById.set(item.id, item.kind);

  const texts: Record<string, string> = {};
  const links: Record<string, { label: string }> = {};

  for (const [id, value] of Object.entries(review.accepted)) {
    if (kindById.get(id) === "link-label") {
      // `label` seul : le `href` du CTA n'est jamais touché.
      links[id] = { label: value };
    } else {
      texts[id] = value;
    }
  }

  const patch: RawHtmlCopyPatch = {};
  if (Object.keys(texts).length > 0) patch.texts = texts;
  if (Object.keys(links).length > 0) patch.links = links;
  return patch;
}

/**
 * Fusionne un patch de copy dans un patch existant, sans écraser le reste.
 *
 * Une page clonée porte déjà, le plus souvent, des retouches manuelles :
 * images remplacées, couleurs ajustées. Une réécriture de copy ne doit pas les
 * balayer. Seules les clés `texts` et `links` sont fusionnées, et pour `links`
 * on préserve tout `href` déjà posé à la main — ce qui serait autrement la
 * façon la plus discrète de casser un tunnel.
 */
export interface CopyMergeTarget {
  texts?: Record<string, string>;
  links?: Record<string, { href?: string; label?: string }>;
}

// Le paramètre porte un DÉFAUT et pas seulement une contrainte : appelé avec
// `undefined` en premier argument, `T` n'a aucun site d'inférence et la
// compilation échouerait sans lui.
export function mergeCopyPatch<T extends CopyMergeTarget = CopyMergeTarget>(
  existing: T | undefined,
  copyPatch: RawHtmlCopyPatch,
): T {
  const base = (existing ?? {}) as T;

  const texts = copyPatch.texts
    ? { ...(base.texts ?? {}), ...copyPatch.texts }
    : base.texts;

  let links = base.links;
  if (copyPatch.links) {
    links = { ...(base.links ?? {}) };
    for (const [id, { label }] of Object.entries(copyPatch.links)) {
      links[id] = { ...(base.links?.[id] ?? {}), label };
    }
  }

  // Cast assumé : l'étalement d'un générique produit un type structurel que TS
  // ne réconcilie pas avec `T`, alors qu'on n'ajoute ici aucune clé étrangère.
  return {
    ...base,
    ...(texts ? { texts } : {}),
    ...(links ? { links } : {}),
  } as T;
}
