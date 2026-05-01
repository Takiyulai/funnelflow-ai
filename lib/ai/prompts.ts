import type { FunnelBrief } from "@/lib/funnels/types";

export function completeFunnelPrompt(brief: FunnelBrief) {
  return `Rôle :
Tu es un expert mondial en copywriting, funnels de vente, CRO, design marketing et vente de produits digitaux.

Mission :
Créer un tunnel de vente complet en ${brief.language} pour l’offre suivante :
- Marque : ${brief.brandName}
- Offre : ${brief.offerName}
- Prix : ${brief.price}
- Audience : ${brief.targetAudience}
- Problème principal : ${brief.mainPain}
- Promesse : ${brief.promise}
- Ton : ${brief.tone}
- Type de tunnel : ${brief.funnelType}
- Style design : ${brief.designStyle}

Tu dois générer :
1. Une page complète structurée en sections
2. Le copywriting de chaque section
3. Les CTA
4. Une page de remerciement
5. Une séquence email simple de 3 emails
6. Les métadonnées SEO
7. Les couleurs recommandées
8. Une version mobile-first

Contraintes :
- Ne pas utiliser de texte générique
- Être orienté conversion
- Utiliser AIDA, PAS et Story-Proof-Offer
- Adapter le copywriting aux produits digitaux, ebooks, services, coaching ou formation
- Retourner uniquement du JSON valide

Structure JSON attendue :
{
  "funnelName": "",
  "language": "",
  "sections": [
    {
      "type": "hero",
      "headline": "",
      "subheadline": "",
      "cta": "",
      "visualDirection": ""
    }
  ],
  "thankYouPage": {},
  "emails": [],
  "seo": {},
  "design": {}
}`;
}

export const regenerateSectionPrompt = `Régénère uniquement la section {sectionType} du tunnel suivant, sans modifier les autres sections.
Garde le même positionnement, la même offre et la même audience.
Améliore la clarté, le désir et la conversion.
Retourne uniquement le JSON de la section.`;

export const importInspirationUrlPrompt = `Analyse la structure marketing suivante extraite d’une page web :
{extractedContent}

Tu ne dois pas copier les textes exacts.
Tu dois reconstruire un tunnel original, légal, inspiré de la logique de conversion.
Retourne :
- structure des sections
- intention de chaque section
- nouveau copywriting
- recommandations design
- CTA
- version adaptée à l’offre utilisateur`;

export const exportSystemePrompt = `Transforme ce tunnel JSON en blocs HTML/CSS propres, simples, responsive, compatibles avec un collage dans Systeme.io.
Contraintes :
- HTML propre
- CSS inline ou section style simple
- Aucun script dangereux
- Mobile-first
- CTA visibles
- Structure facile à importer`;

export const emailSequencePrompt = `Crée une séquence de 3 emails pour ce tunnel :
Email 1 : confirmation / livraison
Email 2 : valeur / preuve
Email 3 : conversion / urgence douce

Retourner :
- objet
- corps HTML
- version texte
- CTA`;
