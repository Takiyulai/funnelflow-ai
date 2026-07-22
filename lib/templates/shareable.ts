/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/templates/shareable.ts
//
// 🆕 Prépare un tunnel pour la GALERIE COMMUNAUTAIRE : on garde la STRUCTURE, le
// DESIGN et le COPY (point de départ réutilisable) mais on RETIRE toute donnée
// personnelle / secret / intégration du créateur :
//   - logo, canaux sociaux (WhatsApp/Telegram), email de livraison, domaine perso
//   - liens de redirection (souvent perso : WhatsApp/paiement), Chariow, popups SIO
//   - tags CRM de capture
// Aucune donnée de leads/CRM n'est présente dans json_content, donc rien à retirer
// de ce côté.

type AnyObj = Record<string, any>;

/**
 * 🆕 SÉCURITÉ (audit #1) — Retire tout ce qui peut EXÉCUTER du JavaScript d'un
 * bloc HTML brut avant de le PARTAGER publiquement dans la galerie. Un modèle
 * partagé est cloné puis ÉDITÉ par d'AUTRES utilisateurs : si son HTML contient
 * du JS, ce JS s'exécuterait dans l'éditeur de la victime (iframe raw-html) →
 * risque de vol de session (compte). On neutralise donc à la source :
 *   - balises <script> ;
 *   - gestionnaires d'événements inline (onclick, onload, on…) ;
 *   - URIs javascript: dans href/src ;
 *   - attribut srcdoc (iframe pouvant réinjecter du script).
 *
 * NB : sanitiseur par regex = défense EN PROFONDEUR (pas une garantie absolue).
 * Le durcissement du sandbox de l'iframe (audit #1b) reste la barrière première ;
 * l'idéal à terme est un sanitiseur DOM (DOMPurify/sanitize-html) côté serveur.
 */
function stripDangerousHtml(html: unknown): unknown {
  if (typeof html !== "string" || html.length === 0) return html;
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/(\b(?:href|src|xlink:href)\s*=\s*)"(\s*javascript:[^"]*)"/gi, '$1"#"')
    .replace(/(\b(?:href|src|xlink:href)\s*=\s*)'(\s*javascript:[^']*)'/gi, "$1'#'")
    .replace(/\ssrcdoc\s*=\s*"[^"]*"/gi, "")
    .replace(/\ssrcdoc\s*=\s*'[^']*'/gi, "");
}

function cleanCta(cta: AnyObj | undefined | null): void {
  if (!cta || typeof cta !== "object") return;
  if (cta.mode === "redirect") cta.url = ""; // pas de lien perso partagé
  delete cta.chariow;
  delete cta.systemePopupId;
  delete cta.captureTags;
  delete cta.popupEmbedHtml;
}

function cleanSections(sections: any): void {
  if (!Array.isArray(sections)) return;
  for (const s of sections) {
    if (!s || typeof s !== "object") continue;
    // 🆕 Neutralise tout JS dans le HTML brut d'une section clonée (raw-html).
    if (typeof s.body === "string") s.body = stripDangerousHtml(s.body);
    if (typeof s.rawHtml === "string") s.rawHtml = stripDangerousHtml(s.rawHtml);
    cleanCta(s.cta);
    cleanCta(s.secondaryCta);
    if (Array.isArray(s.ctas)) s.ctas.forEach(cleanCta);
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (it?.data?.cta) cleanCta(it.data.cta);
        if (it?.data && typeof it.data === "object") {
          delete it.data.paymentUrl;
        }
      }
    }
  }
}

export function sanitizeFunnelForSharing(input: unknown): AnyObj {
  const f: AnyObj = JSON.parse(JSON.stringify(input ?? {}));

  if (f.meta && typeof f.meta === "object") {
    delete f.meta.socialChannels;
    delete f.meta.deliveryEmail;
    delete f.meta.logoUrl;
    delete f.meta.tunnelGroupId;
    delete f.meta.customDomain;
    delete f.meta.paymentUrl;
    // 🆕 Le <head> cloné (CSS + éventuels <script>) est injecté dans l'iframe :
    // on le désinfecte aussi avant partage public.
    if (typeof f.meta.clonedHead === "string") {
      f.meta.clonedHead = stripDangerousHtml(f.meta.clonedHead);
    }
  }
  // 🆕 Code personnalisé (head/body) : jamais partagé (vecteur XSS évident).
  delete f.customCodeHead;
  delete f.customCodeBody;
  if (f.meta && typeof f.meta === "object") {
    delete f.meta.customCodeHead;
    delete f.meta.customCodeBody;
  }
  if (f.header && typeof f.header === "object") {
    delete f.header.logoUrl;
  }
  delete f.paymentUrl;

  cleanCta(f.defaultCta);
  cleanSections(f.sections);
  if (Array.isArray(f.pages)) {
    for (const p of f.pages) cleanSections(p?.sections);
  }

  // Les séquences email ne font pas partie du modèle partagé.
  delete f.emails;

  return f;
}
