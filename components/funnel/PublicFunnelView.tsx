"use client";

import { useMemo } from "react";
import type { Funnel, FunnelPage, PageRole } from "@/lib/funnels/types";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";

type Props = {
  funnel: Funnel;
  activePageSlug?: string;
};

function normalizeSlugForMatch(slug: string | undefined): string {
  if (!slug) return "";
  return slug.replace(/^\/+/, "").replace(/\/+$/, "").trim().toLowerCase();
}

export function PublicFunnelView({ funnel, activePageSlug }: Props) {
  const logoSrc = (funnel.meta as { logoUrl?: string } | undefined)?.logoUrl;

  const activePage = useMemo<FunnelPage | null>(() => {
    if (!funnel.pages || funnel.pages.length === 0) return null;

    const targetSlug = normalizeSlugForMatch(activePageSlug);

    if (targetSlug) {
      const found = funnel.pages.find(
        (p) => normalizeSlugForMatch(p.slug) === targetSlug,
      );
      if (found) return found;
    }

    return funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
  }, [funnel.pages, activePageSlug]);

  const pageRole: PageRole | undefined = activePage?.role;

  if (activePageSlug && normalizeSlugForMatch(activePageSlug) && !activePage) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Page introuvable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Cette page n&apos;existe pas dans ce tunnel.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="ff-public-main flex min-h-screen w-full flex-col">
      <FunnelPreview
        funnel={funnel}
        activePage={activePage ?? undefined}
        forcedMode="raw"
        showToolbar={false}
        viewportHeight="auto"
        logoSrc={logoSrc}
        pageRole={pageRole}
      />
    </main>
  );
}
