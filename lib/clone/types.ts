// lib/clone/types.ts
/**
 * Types pour le pipeline de clonage de funnels.
 * Distinct de l'ancien système d'import (supprimé) : on clone fidèlement,
 * on n'interprète pas, on ne note pas de score de confiance.
 */

import type { FunnelSectionType, Language } from "@/lib/funnels/types";

/**
 * Entrée de la route /api/clone-funnel
 */
export type CloneFunnelRequest = {
  url: string;
  language: Language;
};

/**
 * Sortie de la route /api/clone-funnel (succès)
 */
export type CloneFunnelSuccess = {
  success: true;
  funnelId: string;
  editorUrl: string;
  stats: CloneStats;
};

/**
 * Sortie de la route /api/clone-funnel (échec)
 */
export type CloneFunnelError = {
  success: false;
  error: string;
  code: CloneErrorCode;
};

export type CloneFunnelResponse = CloneFunnelSuccess | CloneFunnelError;

/**
 * Codes d'erreur typés du pipeline de clonage.
 */
export type CloneErrorCode =
  | "invalid-url"
  | "scraping-blocked"
  | "scraping-timeout"
  // ⚠️ Conservés pour rétrocompatibilité (anciens messages/logs). Le pipeline
  // émet désormais les codes AGNOSTIQUES ci-dessous, puisque le clonage passe
  // par plusieurs fournisseurs (Scrapingdog en principal, ScrapingBee en repli).
  | "scrapingbee-quota"
  | "scrapingbee-missing-key"
  | "scraper-quota"
  | "scraper-missing-key"
  | "page-too-small"
  /**
   * 🆕 La page cible construit son CSS via CSS-in-JS (styled-components,
   * emotion…) : les règles vivent dans le CSSOM et n'apparaissent pas dans le
   * HTML sérialisé. Il faut un fournisseur capable d'exécuter du JS avant
   * sérialisation (ScrapingBee) — Scrapingdog et le fetch natif ne suffisent
   * pas. Cf. lib/clone/css-completeness.ts
   */
  | "css-runtime-missing"
  /**
   * 🆕 Identifiants Cloudinary refusés (cloud_name / clé / secret erronés).
   * AUCUN média ne peut être ré-hébergé : poursuivre livrerait une page dont
   * toutes les ressources pointent dans le vide — le symptôme « clonage
   * réussi, page blanche ». Erreur de CONFIGURATION, pas de contenu.
   */
  | "media-config-invalid"
  /**
   * 🆕 Plus de la moitié des médias n'ont pas pu être ré-hébergés. Le clone
   * existe mais reste dépendant du site d'origine.
   */
  | "media-mostly-failed"
  | "parsing-failed"
  | "media-upload-failed"
  | "supabase-error"
  | "internal";

/**
 * Statistiques de clonage retournées à l'UI pour le récapitulatif.
 */
export type CloneStats = {
  sectionsDetected: number;
  sectionsNative: number;
  sectionsRawHtml: number;
  mediasDownloaded: number;
  mediasFailed: number;
  durationMs: number;
};

/**
 * HTML rendu + métadonnées récupérées par le fetcher.
 */
export type FetchedPage = {
  url: string;
  finalUrl: string;
  html: string;
  /** True si récupéré via ScrapingBee (rendu JS), false si fetch() natif */
  renderedWithJs: boolean;
  fetchedAt: string;
};

/**
 * Palette de couleurs extraite de la page source.
 */
export type ExtractedPalette = {
  primary: string;
  secondary: string;
  accent: string;
  /** Toutes les couleurs détectées triées par fréquence */
  allColors: Array<{ color: string; count: number }>;
};

/**
 * Typographie extraite de la page source.
 */
export type ExtractedTypography = {
  headingFont: string;
  bodyFont: string;
  /** Toutes les fonts détectées triées par fréquence */
  allFonts: Array<{ font: string; count: number }>;
};

/**
 * Asset média (image / vidéo) détecté dans la page source.
 * Avant upload Supabase : sourceUrl pointe vers l'URL d'origine.
 * Après upload : uploadedUrl contient l'URL publique Supabase.
 */
export type ClonedMediaAsset = {
  id: string;
  sourceUrl: string;
  uploadedUrl?: string;
  type: "image" | "video";
  alt?: string;
  width?: number;
  height?: number;
  uploadFailed?: boolean;
};

/**
 * Section détectée et mappée vers un type natif Funnel.
 */
export type NativeClonedSection = {
  kind: "native";
  type: FunnelSectionType;
  /** Contenu structuré prêt à être injecté dans une FunnelSection */
  content: {
    headline?: string;
    subHeadline?: string;
    body?: string;
    items?: Array<{
      title?: string;
      description?: string;
      iconHint?: string;
      mediaId?: string;
    }>;
    mediaIds?: string[];
    ctaLabel?: string;
    ctaHref?: string;
  };
};

/**
 * Section non reconnue, stockée en HTML brut pour rendu sandbox.
 */
export type RawHtmlClonedSection = {
  kind: "raw-html";
  html: string;
  /** CSS scopé extrait pour cette section (style inline + classes utilisées) */
  scopedCss: string;
  /** Hauteur approximative pour l'iframe (px) */
  estimatedHeight: number;
};

export type ClonedSection = NativeClonedSection | RawHtmlClonedSection;

/**
 * Résultat complet du parsing d'une page : structure + design + médias.
 */
export type ParsedPageData = {
  sourceUrl: string;
  title: string;
  metaDescription?: string;
  sections: ClonedSection[];
  palette: ExtractedPalette;
  typography: ExtractedTypography;
  mediaAssets: ClonedMediaAsset[];
  /**
   * <head> reconstruit : <base href>, fonts Google, et tous les <style> + <link rel="stylesheet">
   * de la page source. Injecté dans chaque iframe raw-html pour fidélité visuelle.
   */
  globalHead: string;
  /**
   * 🆕 Phase 1A — Attributs du <body> source.
   * $("body").html() ne garde QUE le contenu : la class/id/style du <body> sont
   * perdus. Or beaucoup de tunnels (systeme.io, Webflow…) définissent leur fond
   * via `body.maClasse{…}`, `#wrapper{…}` ou un style inline sur <body>. On les
   * réapplique au <body> de l'iframe pour que ces règles s'appliquent.
   */
  bodyClass?: string;
  bodyId?: string;
  bodyStyle?: string;
};

