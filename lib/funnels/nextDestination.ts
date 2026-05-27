// lib/funnels/nextDestination.ts
import type { Funnel, FunnelPage, FunnelSection } from "@/lib/funnels/types";

/**
 * Résout l'URL de destination après soumission d'un formulaire ou d'un CTA popup.
 *
 * Ordre de priorité :
 *  1. section.formConfig.redirectToPageId  (configuration explicite par l'utilisateur)
 *  2. section.formConfig.redirectToUrl     (URL externe explicite)
 *  3. section.cta.pageId / pageSlug / url  (CTA de la section, compatibilité)
 *  4. page.nextPageId                      (chaînage automatique du funnel)
 *  5. page suivante dans funnel.pages[]    (fallback final)
 *
 * Retourne null si aucune destination ne peut être déterminée.
 */
export function resolveNextDestination(args: {
  section: FunnelSection;
  funnel?: Funnel;
  page?: FunnelPage;
  funnelSlug: string | null;
}): string | null {
  const { section, funnel, page, funnelSlug } = args;
  const pages = funnel?.pages ?? [];

  const findPageById = (id?: string) =>
    id ? pages.find((p) => p.id === id) : undefined;

  const findPageBySlug = (slug?: string) => {
    if (!slug) return undefined;
    const clean = slug.replace(/^\/+/, "").replace(/\/+$/, "");
    return pages.find(
      (p) => p.slug.replace(/^\/+/, "").replace(/\/+$/, "") === clean,
    );
  };

  const buildUrlForPage = (target: FunnelPage): string => {
    if (!funnelSlug) return "/";
    if (target.isHome) return `/tunnel/${funnelSlug}`;
    const clean = target.slug.replace(/^\/+/, "").replace(/\/+$/, "");
    return `/tunnel/${funnelSlug}/${clean}`;
  };

  // 1) formConfig — redirection explicite définie par l'utilisateur
  const fc = section.formConfig;
  if (fc?.redirectToPageId) {
    const target = findPageById(fc.redirectToPageId);
    if (target) return buildUrlForPage(target);
  }
  if (fc?.redirectToUrl) {
    return fc.redirectToUrl;
  }

  // 2) CTA configuré sur la section
  const ctaAny = section.cta as
    | { mode?: string; url?: string; pageId?: string; pageSlug?: string }
    | undefined;
  if (ctaAny?.pageId) {
    const target = findPageById(ctaAny.pageId);
    if (target) return buildUrlForPage(target);
  }
  if (ctaAny?.pageSlug) {
    const target = findPageBySlug(ctaAny.pageSlug);
    if (target) return buildUrlForPage(target);
  }
  if (ctaAny?.url && ctaAny.mode === "redirect") {
    const raw = ctaAny.url.trim();
    const isAbsolute = /^https?:\/\//i.test(raw) || raw.startsWith("//");
    const isMailto = raw.startsWith("mailto:") || raw.startsWith("tel:");
    if (isAbsolute || isMailto) return raw;
    const target = findPageBySlug(raw);
    if (target) return buildUrlForPage(target);
    return raw;
  }

  // 3) page.nextPageId (chaînage automatique)
  if (page?.nextPageId) {
    const target = findPageById(page.nextPageId);
    if (target) return buildUrlForPage(target);
  }

  // 4) Fallback : page suivante dans l'ordre du tableau
  if (page && pages.length > 0) {
    const idx = pages.findIndex((p) => p.id === page.id);
    if (idx >= 0 && idx < pages.length - 1) {
      return buildUrlForPage(pages[idx + 1]);
    }
  }

  return null;
}

/**
 * Extrait le slug du funnel et de la page courante depuis l'URL.
 * Utilisé conjointement avec resolveNextDestination dans les composants client.
 */
export function extractSlugsFromPath(pathname: string | null): {
  funnelSlug: string | null;
  pageSlug: string | null;
} {
  if (!pathname) return { funnelSlug: null, pageSlug: null };
  const match = pathname.match(/^\/tunnel\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return { funnelSlug: null, pageSlug: null };
  return {
    funnelSlug: match[1] || null,
    pageSlug: match[2] || null,
  };
}
