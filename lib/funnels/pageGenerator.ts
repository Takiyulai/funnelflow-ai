// lib/funnels/pageGenerator.ts
import type {
  FunnelBrief,
  FunnelPage,
  FunnelSection,
  FunnelSectionType,
  PageRole,
} from "@/lib/funnels/types";
import { makePageId } from "@/lib/funnels/types";
import type { PageBlueprint } from "@/lib/funnels/pageCatalogs";
import { blueprintName, blueprintNextLabel } from "@/lib/funnels/pageCatalogs";

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 normalizePageSlug — empêche les "/" parasites en début/fin de slug
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise un slug de page :
 *  - Pour la page d'accueil (isHome=true) → retourne "/" (sentinelle home)
 *  - Pour les autres pages → retire tous les "/" en début/fin, lowercase,
 *    caractères safe, pas de doublons "-".
 *
 * Cela garantit qu'on n'aura jamais d'URL `/tunnel/<slug>//merci` à cause
 * d'un slug stocké comme "/merci".
 */
export function normalizePageSlug(raw: string, isHome: boolean): string {
  if (isHome) return "/";
  const cleaned = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")          // retire les "/" en début
    .replace(/\/+$/, "")          // retire les "/" en fin
    .replace(/[^a-z0-9-]+/g, "-") // caractères safe
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "page";
}

// ─────────────────────────────────────────────────────────────────────────────
// filterSectionsByBlueprint — anti-section-fantôme
// ─────────────────────────────────────────────────────────────────────────────

export function filterSectionsByBlueprint(
  sections: FunnelSection[],
  blueprint: PageBlueprint
): FunnelSection[] {
  const allowed = new Set<FunnelSectionType>(blueprint.defaultSectionTypes);
  return sections.filter((s) => allowed.has(s.type));
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPlaceholderPage — page de secours quand l'IA ne génère rien
// ─────────────────────────────────────────────────────────────────────────────

export function buildPlaceholderPage(
  blueprint: PageBlueprint,
  brief: FunnelBrief
): FunnelPage {
  const lang = brief.language;
  const name = blueprintName(blueprint, lang);
  const brand = brief.brandName?.trim() || brief.offerName?.trim() || "";

  const headline = brand ? `${brand} — ${name}` : name;
  const body =
    brief.promise ||
    (lang === "fr"
      ? "Cette page sera personnalisée prochainement."
      : lang === "es"
      ? "Esta página será personalizada próximamente."
      : "This page will be customized soon.");

  const hero: FunnelSection = {
    id: `hero-${blueprint.role}`,
    type: "hero",
    headline,
    body,
    visible: true,
    image: { mode: brief.defaultImageMode ?? "none" },
  };

  return {
    id: makePageId(),
    // 🆕 normalisation systématique du slug
    slug: normalizePageSlug(blueprint.slug, blueprint.isHome),
    name,
    role: blueprint.role,
    sections: [hero],
    visible: true,
    isHome: blueprint.isHome,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPagesFromBlueprints — orchestration principale
// ─────────────────────────────────────────────────────────────────────────────

export function buildPagesFromBlueprints(args: {
  blueprints: PageBlueprint[];
  sectionsByRole: Map<PageRole, FunnelSection[]>;
  brief: FunnelBrief;
}): FunnelPage[] {
  const { blueprints, sectionsByRole, brief } = args;
  const lang = brief.language;

  return blueprints.map((bp) => {
    const aiSections = sectionsByRole.get(bp.role);

    if (!aiSections || aiSections.length === 0) {
      return buildPlaceholderPage(bp, brief);
    }

    const filtered = filterSectionsByBlueprint(aiSections, bp);
    const sections = filtered.length > 0 ? filtered : aiSections;

    return {
      id: makePageId(),
      // 🆕 normalisation systématique du slug
      slug: normalizePageSlug(bp.slug, bp.isHome),
      name: blueprintName(bp, lang),
      role: bp.role,
      sections,
      visible: true,
      isHome: bp.isHome,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// chainPagesNavigation — relie les pages entre elles (CTA "Suivant")
// ─────────────────────────────────────────────────────────────────────────────

export function chainPagesNavigation(pages: FunnelPage[]): FunnelPage[] {
  if (pages.length === 0) return pages;

  return pages.map((page, index) => {
    const nextPage = pages[index + 1];

    if (!nextPage) {
      return { ...page, nextPageId: undefined };
    }

    const updatedSections = injectNextCtaIfMissing(
      page.sections,
      nextPage
    );

    return {
      ...page,
      nextPageId: nextPage.id,
      sections: updatedSections,
    };
  });
}

/**
 * Injecte un CTA "Suivant" sur la dernière section qui peut en accueillir un.
 *
 * 🆕 L'URL utilisée pour le CTA est construite en normalisant le slug cible :
 *    on garantit qu'elle commence par "/" (chemin absolu relatif au funnel)
 *    sans jamais produire de double slash.
 */
function injectNextCtaIfMissing(
  sections: FunnelSection[],
  nextPage: FunnelPage
): FunnelSection[] {
  const hasExplicitCta = sections.some(
    (s) => s.cta?.label && s.cta?.mode
  );
  if (hasExplicitCta) return sections;

  const ctaHostPriority: FunnelSectionType[] = ["cta", "form", "offer", "hero"];

  let targetIndex = -1;
  for (const type of ctaHostPriority) {
    const idx = findLastIndex(sections, (s) => s.type === type);
    if (idx !== -1) {
      targetIndex = idx;
      break;
    }
  }

  if (targetIndex === -1 && sections.length > 0) {
    targetIndex = sections.length - 1;
  }

  if (targetIndex === -1) return sections;

  const target = sections[targetIndex];

  // 🆕 Construit une URL propre : si le slug est "/" (home) on garde tel quel,
  // sinon on s'assure qu'il commence par "/" sans en avoir plusieurs.
  const cleanSlug = nextPage.slug.replace(/^\/+/, "").replace(/\/+$/, "");
  const ctaUrl = nextPage.isHome || !cleanSlug ? "/" : `/${cleanSlug}`;

  const newCta = {
    label: getNextLabelForPage(nextPage),
    mode: "redirect" as const,
    url: ctaUrl,
    target: "_self" as const,
    // 🆕 on stocke aussi pageId pour permettre la navigation inter-pages
    // côté FunnelPreview (résolution du lien interne)
    pageId: nextPage.id,
  };

  const updated = [...sections];
  updated[targetIndex] = { ...target, cta: newCta };
  return updated;
}

function getNextLabelForPage(page: FunnelPage): string {
  return `Continuer vers ${page.name}`;
}

function findLastIndex<T>(
  arr: T[],
  predicate: (item: T) => boolean
): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports pour compat
// ─────────────────────────────────────────────────────────────────────────────

export { blueprintNextLabel } from "@/lib/funnels/pageCatalogs";
