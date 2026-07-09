"use client";

import type { Funnel, FunnelPage, FunnelSection } from "@/lib/funnels/types";
import { formatEventBadge } from "@/lib/funnels/eventDate";
import { CtaLink } from "@/components/funnel/CtaLink";

type Props = {
  funnel: Funnel;
  /** Override du logo (utilisé en preview embed quand on veut forcer une URL) */
  logoSrc?: string;
  /** 🆕 Contexte de navigation, pour que le CTA du header se comporte comme les
   *  autres CTA (popup, action commune sur l'accueil, liens inter-pages). */
  page?: FunnelPage;
  pageLinks?: Map<string, string>;
  slugLinks?: Map<string, string>;
};

// Section synthétique : le CTA du header n'appartient à aucune section réelle,
// mais CtaLink en a besoin (id pour la capture popup, résolution de la page
// suivante). Un id stable suffit.
const HEADER_CTA_SECTION: FunnelSection = {
  id: "ff-header-cta",
  type: "cta",
  visible: true,
} as FunnelSection;

export default function FunnelHeader({
  funnel,
  logoSrc,
  page,
  pageLinks,
  slugLinks,
}: Props) {
  const header = funnel.header ?? {};
  const enabled = header.enabled !== false;
  if (!enabled) return null;

  const logoUrl = logoSrc || header.logoUrl || funnel.meta?.logoUrl;
  const brandName =
    header.brandName?.trim() || extractBrandName(funnel.funnelName || "");

  // Mode d'affichage choisi par l'utilisateur
  const displayMode = header.displayMode ?? "both";

  const wantLogo = displayMode === "logo" || displayMode === "both";
  const wantName = displayMode === "name" || displayMode === "both";

  const showLogo = wantLogo && Boolean(logoUrl);
  const showName = wantName && Boolean(brandName);

  const cta = header.cta;
  const hasCta = Boolean(cta?.label);

  // 🆕 Date/heure du webinaire (mode Live), affichée en clair au centre du
  // header sticky — distinct du countdown de la section urgence. N'existe
  // jamais en mode Evergreen (pas de date commune).
  const eventLabel = formatEventBadge(header.eventDateTime, funnel.language);

  if (!showLogo && !showName && !hasCta && !eventLabel) return null;

  const sticky = header.sticky === true;
  const transparent = header.transparent === true;

  return (
    <header
      className="ff-brand-bar"
      data-ff-header-sticky={sticky ? "true" : undefined}
      data-ff-header-transparent={transparent ? "true" : undefined}
    >
      <div className="ff-brand-bar-inner">
        <div className="ff-brand-bar-left">
          {showLogo && (
            <img src={logoUrl} alt={brandName || "Logo"} />
          )}
          {showName && <span className="ff-brand-bar-name">{brandName}</span>}
        </div>

        {eventLabel && (
          <div className="ff-header-event">
            <span className="ff-header-event-dot" aria-hidden="true" />
            <span>{eventLabel}</span>
          </div>
        )}

        {hasCta && cta && (
          <CtaLink
            cta={cta}
            funnel={funnel}
            page={page}
            section={HEADER_CTA_SECTION}
            pageLinks={pageLinks ?? new Map()}
            slugLinks={slugLinks ?? new Map()}
            baseClassName="ff-brand-bar-cta"
          />
        )}
      </div>
    </header>
  );
}

// 🆕 Le formatage du badge est délégué au helper STABLE (fuseau-indépendant)
// lib/funnels/eventDate.ts — voir l'import en tête de fichier.

function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}
