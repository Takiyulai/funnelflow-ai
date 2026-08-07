// lib/clone/pipeline.ts
/**
 * Orchestrateur du pipeline de clonage de funnels.
 *
 * Étapes :
 * 1. Fetch HTML (ScrapingBee ou natif).
 * 2. Parse → ParsedPageData (sections + médias + design).
 * 3. Upload des médias vers Supabase Storage.
 * 4. Mapping → Funnel complet (compatible éditeur).
 *    Les sections raw-html monolithiques sont éclatées en N sous-sections
 *    par le mapper, ce qui permet l'édition fine du fond section par section.
 *
 * Retourne un objet { funnel, stats } ou throw CloneFetchError.
 */

import { fetchPageHtml, CloneFetchError, validateUrl } from "./fetcher";
import { parsePage } from "./parser";
import { uploadMediaAssets, type MediaUploadSummary } from "./media-uploader";
import {
  CloudinaryConfigError,
  CloudinaryNotConfiguredError,
} from "@/lib/media/cloudinary";
import { mapToFunnel } from "./section-mapper";
import type { Funnel, Language } from "@/lib/funnels/types";
import type { CloneStats } from "./types";

export type CloneResult = {
  funnel: Funnel;
  stats: CloneStats;
};

export type CloneOptions = {
  /** Si true, skip l'upload Supabase et garde les URLs source en hot-link. */
  skipMediaUpload?: boolean;
};

/**
 * Point d'entrée principal du pipeline.
 *
 * @param rawUrl - URL de la page à cloner
 * @param language - Langue cible du funnel généré
 * @param funnelId - ID du funnel destination (utilisé pour nommer les médias)
 * @param options - Options avancées
 * @returns Funnel complet + statistiques de clonage
 *
 * @throws CloneFetchError si une étape échoue de manière fatale.
 */
export async function cloneFunnelFromUrl(
  rawUrl: string,
  language: Language,
  funnelId: string,
  options: CloneOptions = {}
): Promise<CloneResult> {
  const startedAt = Date.now();

  // Validation early-fail
  validateUrl(rawUrl);

  console.log(
    `\n[clone-pipeline] 🚀 Starting clone for ${rawUrl} (lang=${language}, funnelId=${funnelId})`
  );

  // ─── 1. Fetch ─────────────────────────────────────────────────────────────
  const fetched = await fetchPageHtml(rawUrl);

  // ─── 2. Parse ─────────────────────────────────────────────────────────────
  const parsed = parsePage(fetched.html, fetched.finalUrl);

  if (parsed.sections.length === 0) {
    throw new CloneFetchError(
      "parsing-failed",
      "Aucune section détectée sur la page — la page est probablement vide ou bloquée."
    );
  }

  // ─── 3. Upload médias (sauf si skip demandé) ──────────────────────────────
  let mediaResult: MediaUploadSummary = {
    uploaded: 0,
    failed: 0,
    total: 0,
    degraded: false,
  };
  if (!options.skipMediaUpload && parsed.mediaAssets.length > 0) {
    try {
      mediaResult = await uploadMediaAssets(parsed.mediaAssets, funnelId);
    } catch (err) {
      // 🆕 CONFIGURATION REFUSÉE → FATAL.
      //
      // Cette branche avalait TOUTE erreur d'upload « pour continuer avec les
      // URLs source ». Le repli est légitime pour un asset isolé, mais pas
      // quand les identifiants Cloudinary sont faux : dans ce cas AUCUN média
      // n'est ré-hébergé, et l'utilisateur reçoit un HTTP 200 pour une page
      // vide — sans aucun moyen de comprendre ce qui s'est passé.
      if (
        err instanceof CloudinaryConfigError ||
        err instanceof CloudinaryNotConfiguredError
      ) {
        throw new CloneFetchError(
          "media-config-invalid",
          `Le ré-hébergement des médias est impossible : ${err.message} ` +
            `Vérifie CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET.`,
        );
      }
      console.error(
        `[clone-pipeline] ⚠️ Media upload failed, continuing with source URLs : ${(err as Error).message}`
      );
      // Non-fatal : on continue avec les URLs source en hot-link
    }

    // 🆕 Ré-hébergement massivement raté : on refuse plutôt que de livrer un
    // clone troué que l'utilisateur découvrirait en l'ouvrant.
    if (mediaResult.degraded) {
      const pct = Math.round((mediaResult.failed / mediaResult.total) * 100);
      throw new CloneFetchError(
        "media-mostly-failed",
        `${pct} % des médias (${mediaResult.failed}/${mediaResult.total}) n'ont pas pu être ` +
          `ré-hébergés. Le clone serait incomplet. Réessaie — si le problème persiste, ` +
          `le site source bloque probablement le téléchargement de ses images.`,
      );
    }
  } else if (options.skipMediaUpload) {
    console.log("[clone-pipeline] Media upload skipped (option)");
  }

  // ─── 4. Mapping vers Funnel ───────────────────────────────────────────────
  // Note : le mapper peut éclater une section raw-html monolithique en
  // plusieurs FunnelSection si elle contient plusieurs <section> top-level.
  // Le nombre final de sections est donc lu sur funnel.pages[0].sections.
  const funnel = mapToFunnel(parsed, language, fetched.finalUrl);

  const finalSectionCount = funnel.pages?.[0]?.sections.length ?? 0;

  // ─── 5. Stats finales ─────────────────────────────────────────────────────
  const durationMs = Date.now() - startedAt;
  const stats: CloneStats = {
    sectionsDetected: finalSectionCount,
    sectionsNative: parsed.sections.filter((s) => s.kind === "native").length,
    sectionsRawHtml: parsed.sections.filter((s) => s.kind === "raw-html").length,
    mediasDownloaded: mediaResult.uploaded,
    mediasFailed: mediaResult.failed,
    durationMs,
  };

  console.log(
    `[clone-pipeline] ✅ Done in ${(durationMs / 1000).toFixed(1)}s : ${stats.sectionsDetected} sections finales (parser: ${parsed.sections.length}, dont ${stats.sectionsNative} native + ${stats.sectionsRawHtml} raw-html éclatées), ${stats.mediasDownloaded} medias uploaded, ${stats.mediasFailed} failed`
  );

  return { funnel, stats };
}
