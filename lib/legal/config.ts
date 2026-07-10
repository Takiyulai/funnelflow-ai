// lib/legal/config.ts
//
// 🆕 Constantes centralisées pour les pages légales publiques (/privacy,
// /terms), requises pour la validation du branding Google OAuth.
//
// ⚠️ Point UNIQUE à modifier si l'email de contact, le domaine ou la date de
// dernière mise à jour changent — ne pas dupliquer ces valeurs ailleurs.

export const LEGAL_CONFIG = {
  companyName: "AutoFunnel AI",
  productName: "AutoFunnel AI",
  domain: "autofunnelai.cloud",
  siteUrl: "https://autofunnelai.cloud",
  contactEmail: "idrissou0dramane@gmail.com",
  // Format lisible affiché sur les pages (à mettre à jour à chaque révision
  // substantielle du contenu légal).
  privacyLastUpdated: "10 juillet 2026",
  termsLastUpdated: "10 juillet 2026",
} as const;
