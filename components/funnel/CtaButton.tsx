"use client";

import Link from "next/link";
import type { CtaConfig, CtaIcon } from "@/lib/funnels/types";

type Props = {
  cta: CtaConfig;
  className?: string;
  /** Si fourni, override le href calculé depuis cta. */
  href?: string;
  /** Désactive le CTA (mode preview, état non publié, etc.). */
  disabled?: boolean;
  /** Callback en mode popup (cta.mode === "popup"). */
  onPopupClick?: () => void;
};

/**
 * Retourne l'icône effective à afficher :
 * - "none" explicite → null (rien)
 * - undefined → "arrow-right" par défaut
 * - sinon → l'icône choisie
 */
function effectiveIcon(cta: CtaConfig): CtaIcon | null {
  if (cta.icon === "none") return null;
  return (cta.icon ?? "arrow-right") as CtaIcon;
}

/** SVG inline pour chaque icône CTA supportée (parité avec lib/export/html.ts). */
function CtaIconSvg({ name }: { name: CtaIcon }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "inline-block shrink-0",
  };

  switch (name) {
    case "arrow-right":
      return (
        <svg {...common}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    case "arrow-down":
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="5 12 12 19 19 12" />
        </svg>
      );
    case "external":
      return (
        <svg {...common} strokeWidth={2.2}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      );
    case "none":
      return null;
    default:
      return null;
  }
}

export function CtaButton({
  cta,
  className = "",
  href,
  disabled = false,
  onPopupClick,
}: Props) {
  const iconName = effectiveIcon(cta);
  const icon = iconName ? <CtaIconSvg name={iconName} /> : null;

  const content = (
    <span className="inline-flex items-center justify-center gap-2">
      <span>{cta.label}</span>
      {icon}
    </span>
  );

  const baseClass =
    "ff-btn inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors";
  const disabledClass = disabled
    ? "pointer-events-none opacity-60 cursor-not-allowed"
    : "";
  const finalClass = `${baseClass} ${className} ${disabledClass}`.trim();

  // Mode popup : bouton qui ouvre la modale
  if (cta.mode === "popup") {
    return (
      <button
        type="button"
        data-ff-cta
        data-ff-anim="fade-up"
        onClick={onPopupClick}
        disabled={disabled}
        className={finalClass}
      >
        {content}
      </button>
    );
  }

  // Mode ancre (scroll vers une section)
  if (cta.mode === "anchor" && cta.anchorId) {
    if (disabled) {
      return (
        <button type="button" data-ff-cta data-ff-anim="fade-up" className={finalClass} disabled>
          {content}
        </button>
      );
    }
    return (
      <a href={`#${cta.anchorId}`} data-ff-cta data-ff-anim="fade-up" className={finalClass}>
        {content}
      </a>
    );
  }

  // Mode redirect (externe ou interne) — href fourni par le parent
  if (href) {
    if (disabled) {
      return (
        <button type="button" data-ff-cta data-ff-anim="fade-up" className={finalClass} disabled>
          {content}
        </button>
      );
    }
    const isExternal = /^https?:\/\//i.test(href);
    if (isExternal) {
      return (
        <a
          href={href}
          data-ff-cta
          data-ff-anim="fade-up"
          target="_blank"
          rel="noopener noreferrer"
          className={finalClass}
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={href} data-ff-cta data-ff-anim="fade-up" className={finalClass}>
        {content}
      </Link>
    );
  }

  // Fallback : bouton désactivé (aucune cible définie)
  return (
    <button type="button" data-ff-cta data-ff-anim="fade-up" className={finalClass} disabled>
      {content}
    </button>
  );
}
