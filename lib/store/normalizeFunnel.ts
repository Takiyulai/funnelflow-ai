// lib/store/normalizeFunnel.ts
import type { Funnel, FunnelPage, FunnelSection, Language } from "@/lib/funnels/types";
import { makePageId } from "@/lib/funnels/types";

const SUPPORTED_LANGS = new Set<Language>(["fr", "en", "es"]);

function normalizeLanguage(raw: unknown): Language {
  if (typeof raw === "string") {
    const lower = raw.toLowerCase().slice(0, 2) as Language;
    if (SUPPORTED_LANGS.has(lower)) return lower;
  }
  return "fr";
}


function normalizeSection(section: unknown, index: number): FunnelSection {
  const s = (section ?? {}) as Partial<FunnelSection>;
  return {
    ...(s as FunnelSection),
    id:
      s.id ||
      `section-${index}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function normalizePage(page: unknown, index: number): FunnelPage {
  const p = (page ?? {}) as Partial<FunnelPage>;
  const isHome = p.isHome ?? index === 0;
  const rawSections = Array.isArray(p.sections) ? p.sections : [];
  return {
    ...(p as FunnelPage),
    id: p.id || makePageId(),
    slug: isHome ? "/" : p.slug || `page-${index + 1}`,
    name: p.name || (isHome ? "Accueil" : `Page ${index + 1}`),
    // ⚠️ on ne force le rôle que pour la home ; sinon on garde l'existant tel quel
    role: isHome ? ("landing" as FunnelPage["role"]) : (p.role as FunnelPage["role"]),
    visible: p.visible ?? true,
    isHome,
    sections: rawSections.map(normalizeSection),
  };
}


/**
 * Garantit une forme cohérente, quelle que soit l'origine du funnel
 * (localStorage mono-page, migration en cours, snapshot Supabase brut).
 * - language toujours défini ("fr" par défaut)
 * - funnelName toujours une string
 * - pages[] non vide ; chaque page a id/slug/name/role/visible/isHome/sections[]
 * - une seule home (isHome) garantie ; sa première occurrence force slug "/"
 * - funnel.sections resynchronisé sur la home (compat avec syncLegacySections)
 *
 * Idempotent : appeler plusieurs fois ne change rien après le 1er passage.
 */
export function normalizeFunnel(input: unknown): Funnel {
  const raw = (input ?? {}) as Funnel;

  const language = normalizeLanguage(raw.language);
  const funnelName =
    typeof raw.funnelName === "string" && raw.funnelName.trim()
      ? raw.funnelName
      : "Tunnel sans titre";

  // Source des pages : pages[] si présent, sinon home dérivée de sections[]
  let rawPages: unknown[];
  if (Array.isArray(raw.pages) && raw.pages.length > 0) {
    rawPages = raw.pages;
  } else {
    rawPages = [
      {
        slug: "/",
        name: "Accueil",
        role: "landing",
        isHome: true,
        visible: true,
        sections: Array.isArray(raw.sections) ? raw.sections : [],
      },
    ];
  }

  const pages = rawPages.map(normalizePage);

  // Garantir une seule home : la première isHome gagne, les autres repassent
  // en page normale (slug dé-dupliqué si besoin).
  let homeSeen = false;
  const usedSlugs = new Set<string>();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.isHome && !homeSeen) {
      homeSeen = true;
      pages[i] = { ...p, slug: "/" };
    } else if (p.isHome && homeSeen) {
      pages[i] = { ...p, isHome: false, slug: p.slug === "/" ? `page-${i + 1}` : p.slug };
    }
    // dé-duplication des slugs (sauf la home "/")
    const cur = pages[i];
    if (cur.slug !== "/") {
      let slug = cur.slug;
      while (usedSlugs.has(slug)) slug = `${cur.slug}-${i}`;
      usedSlugs.add(slug);
      if (slug !== cur.slug) pages[i] = { ...cur, slug };
    }
  }
  // Si aucune page n'était home, on promeut la première
  if (!homeSeen && pages[0]) {
    pages[0] = {
      ...pages[0],
      isHome: true,
      slug: "/",
      role: (pages[0].role ?? "landing") as FunnelPage["role"],
    };
  }

  const home = pages.find((p) => p.isHome) ?? pages[0];

  return {
    ...raw,
    funnelName,
    language,
    pages,
    // resynchronise le champ legacy sur la home (cohérent avec syncLegacySections)
    sections: home?.sections ?? [],
  };
}
