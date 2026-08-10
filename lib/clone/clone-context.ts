// lib/clone/clone-context.ts
//
// 🆕 Extraction du CONTEXTE ÉDITORIAL d'une page clonée.
//
// ── LE PROBLÈME ─────────────────────────────────────────────────────────────
// Générer une page de remerciement pour un tunnel cloné produisait une page
// sans aucun rapport avec le clone : autre promesse, autre ton, autre univers.
// La cause est mécanique — la génération lisait le contexte ainsi :
//
//     home.sections.find(s => s.type === "hero")?.headline
//
// Or la page d'accueil d'un clone ne contient QU'UNE section, de type
// "raw-html". Il n'y a pas de `hero`, pas de `headline` : le contexte remonté
// était `undefined`, et le modèle inventait tout.
//
// ── CE QU'ON EN TIRE ────────────────────────────────────────────────────────
// Le copy du clone vit dans du HTML capturé. On le projette avec le MÊME
// walker que l'édition et la réécriture — donc les mêmes textes, dans le même
// ordre, sans second mécanisme à maintenir. On garde les premiers titres (la
// promesse est presque toujours en haut de page) et les libellés de CTA (ils
// disent l'action attendue, donc la nature du tunnel).
//
// Module CLIENT : le walker a besoin d'un DOM. Appelé depuis l'éditeur, pas
// depuis une route.

import { applyRawHtmlPatches } from "./raw-html-apply-patches";
import { collectCopyItems } from "./copy-rewrite";
import type { Spot } from "./raw-html-walker";
import { RAW_HTML_BODY_MARKER } from "./section-mapper";
import type { FunnelPage, FunnelSection } from "@/lib/funnels/types";

export interface CloneContext {
  /** Titre principal — la promesse du clone. */
  headline?: string;
  /** Premier sous-titre ou paragraphe d'accroche. */
  subheadline?: string;
  /** Libellés de CTA distincts, dans l'ordre d'apparition (max 5). */
  ctaLabels: string[];
  /** Titres secondaires, utiles pour le ton et le champ lexical (max 6). */
  sectionTitles: string[];
}

/** Longueurs plausibles pour un titre de hero — écarte les blocs de texte. */
const HEADLINE_MAX = 140;
const SUBHEADLINE_MIN = 30;
const SUBHEADLINE_MAX = 320;

function extractRawHtml(body: string | undefined): string | null {
  if (!body) return null;
  const idx = body.indexOf(RAW_HTML_BODY_MARKER);
  if (idx === -1) return null;
  return body.slice(idx + RAW_HTML_BODY_MARKER.length);
}

/** La section est-elle un clone exploitable ? */
export function isClonedSection(section: FunnelSection): boolean {
  return section.type === "raw-html" && !!extractRawHtml(section.body);
}

/**
 * Projette le copy d'une section clonée en contexte éditorial.
 *
 * Lit le HTML APRÈS application des patches : si l'utilisateur a déjà
 * personnalisé sa page, c'est SON texte qui doit guider la génération, pas
 * celui du site d'origine.
 */
export function extractCloneContext(
  section: FunnelSection,
): CloneContext | null {
  const rawHtml = extractRawHtml(section.body);
  if (!rawHtml) return null;
  if (typeof document === "undefined") return null;

  const spots: Spot[] = [];
  applyRawHtmlPatches(rawHtml, section.rawHtmlPatches, {
    annotate: false,
    collectInto: spots,
  });
  const items = collectCopyItems(spots);
  if (items.length === 0) return null;

  const context: CloneContext = { ctaLabels: [], sectionTitles: [] };
  const seenCta = new Set<string>();

  for (const item of items) {
    if (item.kind === "link-label") {
      const label = item.text.trim();
      // Un libellé de navigation (« Accueil », « Blog ») n'apprend rien ; un
      // CTA fait au moins deux mots.
      if (label.length < 6 || !label.includes(" ")) continue;
      const key = label.toLowerCase();
      if (seenCta.has(key)) continue;
      seenCta.add(key);
      if (context.ctaLabels.length < 5) context.ctaLabels.push(label);
      continue;
    }

    if (item.subKind === "title") {
      if (!context.headline && item.text.length <= HEADLINE_MAX) {
        context.headline = item.text;
      } else if (context.sectionTitles.length < 6) {
        context.sectionTitles.push(item.text);
      }
      continue;
    }

    if (
      !context.subheadline &&
      context.headline &&
      item.text.length >= SUBHEADLINE_MIN &&
      item.text.length <= SUBHEADLINE_MAX
    ) {
      context.subheadline = item.text;
    }
  }

  if (!context.headline && !context.subheadline && context.ctaLabels.length === 0) {
    return null;
  }
  return context;
}

/**
 * Contexte de la page d'ACCUEIL d'un tunnel, qu'elle soit clonée ou native.
 *
 * Point d'entrée unique de la génération : elle n'a plus à savoir si le tunnel
 * vient d'un clone. C'était la source du défaut — une seule des deux formes
 * était gérée, en silence.
 */
export function extractHomeContext(
  homePage: FunnelPage | undefined,
): CloneContext | null {
  if (!homePage?.sections?.length) return null;

  // Cas natif : la structure porte déjà le contexte.
  const hero = homePage.sections.find((s) => s.type === "hero");
  if (hero) {
    const ctaLabels: string[] = [];
    for (const s of homePage.sections) {
      const label = s.cta?.label?.trim();
      if (label && !ctaLabels.includes(label) && ctaLabels.length < 5) {
        ctaLabels.push(label);
      }
    }
    return {
      headline: hero.headline,
      subheadline: hero.subheadline ?? hero.body,
      ctaLabels,
      sectionTitles: homePage.sections
        .filter((s) => s !== hero && s.headline)
        .slice(0, 6)
        .map((s) => s.headline as string),
    };
  }

  // Cas cloné : on projette le HTML capturé.
  const cloned = homePage.sections.find(isClonedSection);
  return cloned ? extractCloneContext(cloned) : null;
}
