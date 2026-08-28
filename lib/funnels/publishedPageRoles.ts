type PublishedPage = {
  slug?: unknown;
  isHome?: unknown;
  role?: unknown;
};

export type ResolvedPublishedPage = {
  slug: string;
  role: string | null;
};

export type PublishedPageRoleLookup = Map<string, Map<string, string | null>>;

export function normalizePublishedPageSlug(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^\/+|\/+$/g, "") : "";
}

function normalizePublishedPageRole(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function getPublishedPages(publishedContent: unknown): PublishedPage[] {
  const content =
    publishedContent && typeof publishedContent === "object"
      ? (publishedContent as { pages?: unknown })
      : null;
  return Array.isArray(content?.pages) ? (content.pages as PublishedPage[]) : [];
}

/**
 * Résout la page uniquement depuis le snapshot publié. Le rôle accompagne le
 * slug canonique afin que les décisions serveur ne dépendent jamais du nom du
 * slug choisi par l'utilisateur.
 */
export function resolvePublishedPage(
  publishedContent: unknown,
  requestedSlug: string | null | undefined,
): ResolvedPublishedPage | null {
  const pages = getPublishedPages(publishedContent);
  const requested = normalizePublishedPageSlug(requestedSlug);

  // Ancien funnel mono-page : seule la page racine est valide et aucun rôle
  // explicite n'est disponible. Elle reste donc une page de contenu.
  if (pages.length === 0) {
    return requested ? null : { slug: "", role: null };
  }

  const page = requested
    ? pages.find((candidate) => normalizePublishedPageSlug(candidate.slug) === requested)
    : pages.find((candidate) => candidate.isHome === true) ?? pages[0];
  if (!page) return null;

  return {
    slug: normalizePublishedPageSlug(page.slug),
    role: normalizePublishedPageRole(page.role),
  };
}

export function isPostConversionPageRole(role: string | null | undefined): boolean {
  return role === "confirmation" || role === "thankyou";
}

/** Construit un index funnel → slug → rôle depuis les pages publiées seules. */
export function buildPublishedPageRoleLookup(
  funnels: ReadonlyArray<{ id: string; pages?: unknown }>,
): PublishedPageRoleLookup {
  const lookup: PublishedPageRoleLookup = new Map();

  for (const funnel of funnels) {
    const pages = Array.isArray(funnel.pages) ? (funnel.pages as PublishedPage[]) : [];
    const bySlug = new Map<string, string | null>();
    for (const page of pages) {
      bySlug.set(
        normalizePublishedPageSlug(page.slug),
        normalizePublishedPageRole(page.role),
      );
    }
    lookup.set(funnel.id, bySlug);
  }

  return lookup;
}

export function getPublishedPageRole(
  lookup: PublishedPageRoleLookup,
  funnelId: string,
  pageSlug: string | null | undefined,
): string | null {
  return lookup.get(funnelId)?.get(normalizePublishedPageSlug(pageSlug)) ?? null;
}
