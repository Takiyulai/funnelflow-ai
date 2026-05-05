"use client";

import type { CtaConfig } from "@/lib/funnels/types";

type Props = {
  cta: CtaConfig;
  /**
   * disabled=true : utilisé en mode preview wizard pour empêcher la navigation
   * tout en gardant le rendu visuel.
   */
  disabled?: boolean;
  className?: string;
};

/**
 * Bouton CTA qui rend la balise sémantique correcte selon cta.mode :
 *  - "redirect" : <a href={cta.url}> avec target/rel sécurisés
 *  - "anchor"   : <a href="#anchorId"> qui scrolle vers la section cible
 *  - "popup"    : <button> qui ouvrira un popup (Phase C)
 *
 * Le rendu visuel est entièrement piloté par la classe `ff-btn` définie dans
 * app/funnel-theme.css → couleurs, typographie, animations dépendent du
 * data-ff-template du wrapper parent (TemplateThemeProvider).
 */
export function CtaButton({ cta, disabled = false, className = "" }: Props) {
  const baseClasses =
    "ff-btn inline-flex items-center justify-center gap-2 " +
    "disabled:opacity-60 disabled:cursor-not-allowed " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ff-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ff-bg)]";

  const finalClasses = `${baseClasses} ${className}`.trim();

  // Mode preview wizard : bouton désactivé visuellement identique
  if (disabled) {
    return (
      <button type="button" disabled className={finalClasses} data-ff-cta>
        {cta.label}
      </button>
    );
  }

  // Mode "redirect" : lien externe (Stripe Payment Link, Calendly, etc.)
  if (cta.mode === "redirect" && cta.url) {
    const target = cta.target ?? "_blank";
    const rel = target === "_blank" ? "noopener noreferrer" : undefined;
    return (
      <a
        href={cta.url}
        target={target}
        rel={rel}
        className={finalClasses}
        data-ff-cta
      >
        {cta.label}
      </a>
    );
  }

  // Mode "anchor" : scroll vers une section interne
  if (cta.mode === "anchor") {
    const anchorId = cta.anchorId ?? "lead-form";
    return (
      <a href={`#${anchorId}`} className={finalClasses} data-ff-cta>
        {cta.label}
      </a>
    );
  }

  // Mode "popup" : ouverture du popup embarqué (markup généré par l'export)
  if (cta.mode === "popup") {
    const popupId = cta.popupId ?? "lead-popup";
    return (
      <button
        type="button"
        data-ff-popup={popupId}
        data-ff-popup-target={popupId}
        className={finalClasses}
        data-ff-cta
        onClick={(e) => {
          // Sur la page publique, le popup est géré par le script embarqué
          // dans le bloc HTML exporté. En mode app (Next.js), on déclenche
          // ici l'ouverture si un overlay correspondant existe dans le DOM.
          const overlay =
            typeof document !== "undefined"
              ? document.getElementById(popupId)
              : null;
          if (overlay) {
            e.preventDefault();
            overlay.setAttribute("data-ff-open", "true");
            document.body.style.overflow = "hidden";
          }
        }}
      >
        {cta.label}
      </button>
    );
  }

  // Fallback : redirect sans URL renseignée → bouton inerte
  return (
    <button type="button" disabled className={finalClasses} data-ff-cta>
      {cta.label}
    </button>
  );
}
