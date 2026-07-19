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
