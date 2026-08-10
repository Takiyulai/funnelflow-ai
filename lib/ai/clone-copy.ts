// lib/ai/clone-copy.ts
//
// 🆕 Réécriture par prompt du copy d'une page CLONÉE.
//
// ── LA PROMESSE ─────────────────────────────────────────────────────────────
// « Réécris tout le texte, ne touche à rien d'autre. » Ni le squelette, ni le
// layout, ni les couleurs, ni les médias, ni les URL de redirection.
//
// Cette promesse n'est PAS confiée au modèle, et ce module ne la tient pas non
// plus par discipline : elle est structurelle. Le modèle ne voit jamais de
// HTML. Il reçoit une liste plate de chaînes indexées par identifiant, et il
// renvoie une liste plate de chaînes indexées par identifiant. Il n'a
// simplement aucun moyen d'exprimer une balise, une classe, une couleur ou une
// URL — quand bien même on le lui demanderait.
//
// Tout ce qui revient passe ensuite par `reviewCopyRewrite`, qui rejette le
// balisage, les longueurs hors budget et les emplacements gelés (prix,
// mentions légales), puis par `toRawHtmlCopyPatch`, seul point de sortie, qui
// n'écrit que `texts` et `links[].label`.
//
// ── DÉCOUPAGE ───────────────────────────────────────────────────────────────
// Une page clonée porte couramment 150 à 200 emplacements. Les envoyer en un
// seul appel produit une réponse tronquée — et une réponse tronquée fait
// disparaître les derniers emplacements sans le dire. On découpe donc, et
// chaque lot est jugé indépendamment : un lot raté n'emporte pas les autres.

import { callAI, AiGenerationError } from "@/lib/ai/generate";
import {
  chunkCopyItems,
  lengthBudget,
  reviewCopyRewrite,
  toRawHtmlCopyPatch,
  type CopyItem,
  type CopyRewriteReview,
  type RawHtmlCopyPatch,
} from "@/lib/clone/copy-rewrite";
import type { Language } from "@/lib/funnels/types";

export interface CloneCopyRewriteResult {
  patch: RawHtmlCopyPatch;
  /** Rapport agrégé de tous les lots — sert à l'aperçu et au diagnostic. */
  stats: {
    submitted: number;
    accepted: number;
    unchanged: number;
    rejected: number;
    missing: number;
    chunks: number;
    failedChunks: number;
  };
  /** Vrai si AUCUN lot n'a produit de réécriture exploitable. */
  fatal: boolean;
}

const LANG_NAME: Record<Language, string> = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
};

function systemMessage(language: Language): string {
  const langLabel = LANG_NAME[language] ?? "français";
  return [
    "Tu es un copywriter direct-response. Tu réécris le TEXTE d'une page de vente existante.",
    "",
    "RÈGLES ABSOLUES :",
    `1. Réponds UNIQUEMENT par un objet JSON valide : { "identifiant": "nouveau texte", … }. Aucun texte avant ou après.`,
    "2. Reprends EXACTEMENT les identifiants fournis. N'en invente aucun, n'en omets aucun.",
    "3. Les valeurs sont du TEXTE BRUT. Jamais de HTML, jamais de balise, jamais de Markdown, jamais d'emoji ajouté.",
    `4. Écris en ${langLabel}.`,
    "5. RESPECTE LA LONGUEUR indiquée par `max` pour chaque entrée. Un texte plus long casse la mise en page : c'est le seul dégât que tu peux causer, et il est irréversible pour l'utilisateur.",
    "6. Un titre reste un titre, un libellé de bouton reste un libellé de bouton (2 à 4 mots, à l'impératif).",
    "7. Si un texte est déjà bon ou ne se prête pas à la réécriture, renvoie-le à l'identique.",
    "8. Ne PROMETS rien qui ne figure pas déjà dans le texte d'origine : pas de chiffre inventé, pas de garantie inventée, pas de témoignage inventé.",
  ].join("\n");
}

function userPrompt(
  items: readonly CopyItem[],
  instruction: string | undefined,
  chunkIndex: number,
  chunkTotal: number,
): string {
  const payload = items.map((item) => ({
    id: item.id,
    role: item.kind === "link-label" ? "bouton" : item.subKind,
    tag: item.tag,
    max: lengthBudget(item).max,
    text: item.text,
  }));

  const lines: string[] = [];
  if (chunkTotal > 1) {
    lines.push(
      `Lot ${chunkIndex + 1} sur ${chunkTotal} d'une même page. Reste cohérent avec le ton général.`,
      "",
    );
  }
  lines.push(
    instruction?.trim()
      ? `CONSIGNE DE L'UTILISATEUR : ${instruction.trim()}`
      : "CONSIGNE : rends le copy plus percutant et plus concret, sans changer le sens.",
    "",
    "EMPLACEMENTS À RÉÉCRIRE :",
    JSON.stringify(payload, null, 0),
    "",
    `Réponds par le JSON { "id": "texte" } couvrant les ${items.length} identifiants ci-dessus.`,
  );
  return lines.join("\n");
}

/** Extrait l'objet JSON d'une réponse modèle, tolérant aux clôtures Markdown. */
function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Repli : première accolade équilibrée. Certains modèles préfixent malgré
    // la consigne (« Voici le JSON : … »).
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Réécrit le copy d'une page clonée.
 *
 * Les `items` sont collectés CÔTÉ CLIENT (`collectCopyItems`, qui a besoin du
 * DOM) et transmis tels quels : le HTML capturé ne quitte jamais le navigateur,
 * et la route n'a pas à instancier jsdom pour refaire le travail.
 */
export async function rewriteCloneCopy(
  items: readonly CopyItem[],
  options: { instruction?: string; language: Language },
): Promise<CloneCopyRewriteResult> {
  const chunks = chunkCopyItems(items);
  const stats = {
    submitted: items.length,
    accepted: 0,
    unchanged: 0,
    rejected: 0,
    missing: 0,
    chunks: chunks.length,
    failedChunks: 0,
  };

  let patch: RawHtmlCopyPatch = {};

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let review: CopyRewriteReview;

    try {
      const raw = await callAI({
        systemMessage: systemMessage(options.language),
        userPrompt: userPrompt(chunk, options.instruction, i, chunks.length),
        // Marge large : la réponse fait au moins la taille de l'entrée, et une
        // troncature ferait silencieusement disparaître la fin du lot.
        maxTokens: 4000,
        temperature: 0.7,
      });
      review = reviewCopyRewrite(chunk, parseModelJson(raw));
    } catch (err) {
      // Un lot en échec ne doit pas emporter les autres : l'utilisateur
      // récupère la réécriture partielle plutôt que rien du tout. Une clé
      // absente ou un quota épuisé restent en revanche fatals d'emblée.
      if (
        err instanceof AiGenerationError &&
        (err.reason === "missing-key" ||
          err.reason === "invalid-key" ||
          err.reason === "insufficient-quota")
      ) {
        throw err;
      }
      stats.failedChunks++;
      continue;
    }

    if (review.fatal) {
      stats.failedChunks++;
      continue;
    }

    stats.accepted += review.stats.accepted;
    stats.unchanged += review.stats.unchanged;
    stats.rejected += review.stats.rejected;
    stats.missing += review.stats.missing;

    const chunkPatch = toRawHtmlCopyPatch(review, chunk);
    patch = {
      texts: { ...(patch.texts ?? {}), ...(chunkPatch.texts ?? {}) },
      links: { ...(patch.links ?? {}), ...(chunkPatch.links ?? {}) },
    };
  }

  // Clés vides retirées : un patch `{ texts: {} }` vaudrait « appliqué mais
  // sans effet », ce qui rendrait l'aperçu trompeur.
  if (patch.texts && Object.keys(patch.texts).length === 0) delete patch.texts;
  if (patch.links && Object.keys(patch.links).length === 0) delete patch.links;

  return {
    patch,
    stats,
    fatal: stats.accepted === 0,
  };
}
