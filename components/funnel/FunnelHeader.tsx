"use client";

import type { Funnel } from "@/lib/funnels/types";
import { ctaHref, ctaTarget, ctaRel, ctaIsExternal } from "@/lib/funnels/cta";
import { ExternalLink } from "lucide-react";

type Props = {
  funnel: Funnel;
  /** Override du logo (utilisé en preview embed quand on veut forcer une URL) */
  logoSrc?: string;
};

export default function FunnelHeader({ funnel, logoSrc }: Props) {
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

  if (!showLogo && !showName && !hasCta) return null;

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

        {hasCta && cta && (
          <a
            href={ctaHref(cta)}
            target={ctaTarget(cta)}
            rel={ctaRel(cta)}
            className="ff-brand-bar-cta"
            data-ff-cta
          >
            {cta.label}
            {ctaIsExternal(cta) && <ExternalLink size={13} />}
          </a>
        )}
      </div>
    </header>
  );
}

function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}
