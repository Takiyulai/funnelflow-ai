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

/** Formate la date/heure du webinaire pour le badge du header (ex :
 *  "En direct le jeudi 9 juillet — 21:00"). Retourne null si absente/invalide. */
function formatEventBadge(iso: string | undefined, language?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const locale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "fr-FR";
  const datePart = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const timePart = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const prefix =
    language === "en" ? "Live on" : language === "es" ? "En vivo el" : "En direct le";

  return `${prefix} ${datePart} — ${timePart}`;
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
