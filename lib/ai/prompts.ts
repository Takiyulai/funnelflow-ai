// lib/ai/prompts.ts
import type { FunnelBrief, FunnelSection } from "@/lib/funnels/types";
import { getFunnelKind } from "@/lib/funnels/kinds";
import { getMood } from "@/lib/funnels/moods";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de langue
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGE_LABELS = {
  fr: "français",
  en: "english",
  es: "español",
} as const;

function languageLabel(lang: FunnelBrief["language"]): string {
  return LANGUAGE_LABELS[lang] ?? "français";
}

// Bloc commun rappelant les règles produit, à injecter dans tous les prompts
function commonProductRules(language: FunnelBrief["language"]): string {
  return `Règles produit FunnelFlow AI :
- Ton : sobre, direct, crédible, orienté résultats. Pas de hype, pas de superlatifs creux
- Aucune émoji nulle part, ni dans les textes ni en remplacement d'icônes
- Aucune mention de marques concurrentes
- Le tunnel est pensé d'abord pour systeme.io, l'ouverture multi-plateforme reste secondaire
- La langue de sortie est strictement : ${languageLabel(language)}
- Aucun texte hors langue cible, sauf noms propres et marques`;
}

// Bloc contextuel ajouté quand un format / ambiance / about / vidéo est fourni
function briefContextBlock(brief: FunnelBrief): string {
  const lines: string[] = [];

  const kind = getFunnelKind(brief.funnelKind);
  if (kind) {
    lines.push(`- Format du tunnel : ${kind.label.fr} (${kind.id})`);
    if (kind.needsVideo) {
      lines.push(`- Le format suppose une vidéo principale, ajouter une section "video" cohérente`);
    }
  }

  const mood = getMood(brief.moodId);
  if (mood) {
    lines.push(`- Ambiance choisie : ${mood.label.fr} — ${mood.description.fr}`);
  }

  if (brief.mainColor) lines.push(`- Couleur principale demandée : ${brief.mainColor}`);
  if (brief.secondaryColor) lines.push(`- Couleur secondaire demandée : ${brief.secondaryColor}`);

  if (brief.aboutText && brief.aboutText.trim().length > 0) {
    lines.push(`- À propos / légitimité : ${brief.aboutText.trim()}`);
    lines.push(`- Inclure une section "about" avec ce contenu reformulé`);
  }

  if (brief.videoUrl) {
    lines.push(`- URL vidéo fournie : ${brief.videoUrl}`);
    lines.push(`- Inclure une section "video" qui référence cette URL dans visualDirection`);
  }

  if (brief.templateId) {
    lines.push(`- Template recommandé : ${brief.templateId}`);
  }

  if (lines.length === 0) return "";
  return `Contexte additionnel\n${lines.join("\n")}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Génération complète d'un tunnel
// ─────────────────────────────────────────────────────────────────────────────
export function completeFunnelPrompt(brief: FunnelBrief): string {
  const lang = languageLabel(brief.language);
  const primaryCta = brief.primaryCta;

  const ctaInstruction = primaryCta
    ? `Utiliser ce CTA principal pour les sections clés (hero, offer, cta, form) :
{
  "label": "${primaryCta.label}",
  "mode": "${primaryCta.mode}",
  ${primaryCta.url ? `"url": "${primaryCta.url}",` : ""}
  ${primaryCta.anchorId ? `"anchorId": "${primaryCta.anchorId}",` : ""}
  "target": "${primaryCta.target ?? "_self"}"
}`
    : `Utiliser par défaut un CTA en mode "anchor" pointant vers anchorId="lead-form" et target="_self"
Le label doit être court, direct et orienté action`;

  const context = briefContextBlock(brief);

  return `Rôle
Tu es un expert en copywriting de conversion, structure de tunnels de vente, CRO et marketing digital sobre et premium

Mission
Créer un tunnel de vente complet en ${lang} pour l'offre suivante
- Marque : ${brief.brandName}
- Offre : ${brief.offerName}
- Prix : ${brief.price}
- Audience : ${brief.targetAudience}
- Problème principal : ${brief.mainPain}
- Promesse : ${brief.promise}
- Ton souhaité : ${brief.tone}
- Type de tunnel : ${brief.funnelType}
- Style design : ${brief.designStyle}

${context}${commonProductRules(brief.language)}

Approche copywriting
- Hiérarchie : promesse forte, résultat concret, simplicité, preuve, offre, action
- Frameworks utilisables : AIDA, PAS, Story-Proof-Offer
- Une promesse compréhensible en moins de 5 secondes
- Une objection traitée avant chaque CTA important
- Aucun chiffre invérifiable, aucune surpromesse

Structure des CTA
${ctaInstruction}

Modes CTA autorisés
- "redirect" : url externe, target="_blank" si externe, target="_self" si interne
- "anchor" : navigation interne via anchorId, ne jamais inclure le caractère #
- "popup" : seulement si explicitement demandé, popupId court en kebab-case

Images
- Pour chaque section, ajouter le champ "image" avec mode="none" par défaut
- Ne jamais inventer d'URL d'image
- Si une suggestion visuelle est utile, utiliser mode="ai-suggested" et fournir un champ "suggestionQuery" en anglais, court, descriptif

Format de sortie
Retourner uniquement un JSON valide, sans markdown, sans commentaire, conforme à ce schéma :

{
  "funnelName": "string",
  "language": "${brief.language}",
  "sections": [
    {
      "id": "kebab-case",
      "type": "hero | about | problem | solution | benefits | proof | offer | bonus | guarantee | faq | cta | form | program | pricing | process | webinar | video | qualification",
      "eyebrow": "string optionnel court",
      "headline": "string",
      "subheadline": "string optionnel",
      "body": "string optionnel",
      "bullets": ["string"],
      "cta": {
        "label": "string",
        "mode": "redirect | anchor | popup",
        "url": "string optionnel",
        "anchorId": "string optionnel sans #",
        "target": "_self | _blank"
      },
      "image": {
        "mode": "none | ai-suggested",
        "suggestionQuery": "string optionnel en anglais"
      },
      "visible": true,
      "visualDirection": "indication interne courte sur le rendu attendu"
    }
  ],
  "thankYouPage": {
    "headline": "string",
    "body": "string",
    "cta": { "label": "string", "mode": "anchor", "anchorId": "top", "target": "_self" }
  },
  "emails": [
    {
      "subject": "string",
      "html": "<p>string</p>",
      "text": "string",
      "cta": { "label": "string", "mode": "anchor", "anchorId": "lead-form", "target": "_self" }
    }
  ],
  "seo": {
    "title": "string",
    "description": "string"
  },
  "design": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "style": "${brief.designStyle}"
  }
}

Règles strictes
- Retourner uniquement le JSON, sans balises markdown ni explications
- Ne pas inventer de témoignages chiffrés invérifiables
- Ne pas inclure d'émoji, ni dans les textes ni dans les bullets
- Ne pas utiliser de points à la fin des phrases courtes en titre, sous-titre ou bullet
- Toujours fournir un id stable pour chaque section`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Régénération d'une section (typée et contextualisée)
// ─────────────────────────────────────────────────────────────────────────────
export function regenerateSectionPrompt(args: {
  brief: FunnelBrief;
  section: Pick<FunnelSection, "type" | "headline" | "subheadline" | "body" | "bullets" | "cta">;
  instruction?: string;
}): string {
  const { brief, section, instruction } = args;
  const lang = languageLabel(brief.language);

  return `Rôle
Tu es un expert en copywriting de conversion sobre et premium

Mission
Régénérer uniquement la section de type "${section.type}" du tunnel ci-dessous, sans modifier les autres sections
Garder le même positionnement, la même offre et la même audience
Améliorer la clarté, la promesse, la preuve et l'orientation conversion

Contexte
- Marque : ${brief.brandName}
- Offre : ${brief.offerName}
- Audience : ${brief.targetAudience}
- Promesse : ${brief.promise}
- Langue : ${lang}

Section actuelle à améliorer
${JSON.stringify(section, null, 2)}

${instruction ? `Instruction complémentaire de l'utilisateur : ${instruction}` : ""}

${commonProductRules(brief.language)}

Format de sortie
Retourner uniquement un JSON valide correspondant à la section régénérée, sans markdown, sans commentaire, conforme à ce schéma :

{
  "type": "${section.type}",
  "eyebrow": "string optionnel",
  "headline": "string",
  "subheadline": "string optionnel",
  "body": "string optionnel",
  "bullets": ["string"],
  "cta": {
    "label": "string",
    "mode": "redirect | anchor | popup",
    "url": "string optionnel",
    "anchorId": "string optionnel sans #",
    "target": "_self | _blank"
  }
}

Règles strictes
- Retourner uniquement le JSON
- Ne pas inclure d'émoji
- Ne pas inventer de chiffres ou de témoignages
- Conserver la cohérence avec l'offre et l'audience`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Inspiration depuis une URL (analyse structurelle, pas de copie)
// ─────────────────────────────────────────────────────────────────────────────
export function importInspirationPrompt(args: {
  brief: FunnelBrief;
  extractedContent: string;
}): string {
  const { brief, extractedContent } = args;
  const lang = languageLabel(brief.language);

  return `Rôle
Tu es un expert en analyse de pages de vente et en reconstruction de tunnels orientés conversion

Mission
Analyser la structure marketing extraite d'une page web et reconstruire un tunnel original adapté à l'offre de l'utilisateur
Tu ne dois jamais recopier les textes ou éléments de marque de la source
Tu dois réécrire intégralement chaque texte avec un ton et un angle distincts

Contenu extrait à analyser
"""
${extractedContent}
"""

Contexte de l'offre cible
- Marque : ${brief.brandName}
- Offre : ${brief.offerName}
- Prix : ${brief.price}
- Audience : ${brief.targetAudience}
- Promesse : ${brief.promise}
- Ton : ${brief.tone}
- Langue de sortie : ${lang}

${commonProductRules(brief.language)}

Format de sortie
Retourner uniquement un JSON valide conforme au schéma complet d'un tunnel FunnelFlow AI, identique à celui d'une génération complète, avec :
- une structure de sections inspirée de la logique de conversion détectée
- un copywriting entièrement original
- une recommandation design cohérente avec le ton demandé
- des CTA structurés en CtaConfig

Règles strictes
- Aucune phrase ou expression directement reprise du contenu source
- Aucune mention de la marque ou des produits de la source
- Retourner uniquement le JSON, sans markdown ni commentaire`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Séquence email
// ─────────────────────────────────────────────────────────────────────────────
export function emailSequencePrompt(brief: FunnelBrief): string {
  const lang = languageLabel(brief.language);

  return `Rôle
Tu es un expert en email marketing sobre et orienté conversion

Mission
Créer une séquence de 3 emails pour le tunnel suivant
- Marque : ${brief.brandName}
- Offre : ${brief.offerName}
- Audience : ${brief.targetAudience}
- Promesse : ${brief.promise}
- Langue : ${lang}

Structure de la séquence
- Email 1 : confirmation et livraison de la valeur attendue
- Email 2 : preuve, contexte, levée d'objection principale
- Email 3 : conversion avec urgence douce, sans pression artificielle

${commonProductRules(brief.language)}

Format de sortie
Retourner uniquement un tableau JSON valide :

[
  {
    "subject": "string",
    "html": "<p>string</p>",
    "text": "string",
    "cta": {
      "label": "string",
      "mode": "anchor",
      "anchorId": "lead-form",
      "target": "_self"
    }
  }
]

Règles strictes
- Retourner uniquement le tableau JSON
- HTML simple, sans inline CSS lourd, compatible la majorité des clients email
- Aucune émoji
- Pas de fausse rareté ni de chiffres inventés`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Export systeme.io (optionnel, pour cas avancés)
// ─────────────────────────────────────────────────────────────────────────────
export const exportSystemePrompt = `Tu transformes un tunnel JSON en blocs HTML autonomes destinés à être collés dans systeme.io via un bloc HTML personnalisé

Règles strictes systeme.io
- Ne jamais inclure de balises <!doctype>, <html>, <head>, <body>, <meta>, <title>, <link>
- Chaque bloc embarque son propre <style> avec des classes préfixées et uniques
- Aucun sélecteur global non scopé, pas de body{} html{} *{}
- Pas de <p> imbriqué dans un autre <p>
- Préférer <span> ou <div> pour les eyebrows et labels courts
- Les formulaires doivent inclure onsubmit="return false;"
- Conserver les attributs href, target, rel="noopener" pour les liens externes
- Pas de script externe, pas de document.write, pas de alert ou confirm
- Pas d'émoji

Sortie attendue
Pour chaque section, un bloc autonome de la forme :
<style>
  /* CSS scopé sous une classe unique */
</style>
<section class="ff-[type]-[id]">
  <!-- contenu -->
</section>`;
