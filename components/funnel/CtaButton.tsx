"use client";

import type { CtaConfig } from "@/lib/funnels/types";
import { isSafeUrl } from "@/lib/funnels/cta";

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
 *  - "popup"    : <button> qui ouvre un popup embarqué
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
  // CORRECTION CRITIQUE : par défaut, _blank pour les URLs externes.
  // Avant, target="_self" si non défini → clic restait dans la même page.
  if (cta.mode === "redirect") {
    if (cta.url && isSafeUrl(cta.url)) {
      // Si target n'est pas explicitement "_self", on force "_blank" sur les URLs absolues
      const isAbsolute = /^https?:\/\//i.test(cta.url.trim());
      const target =
        cta.target === "_self"
          ? "_self"
          : cta.target === "_blank"
          ? "_blank"
          : isAbsolute
          ? "_blank" // Défaut sain : nouvel onglet pour URL absolue
          : "_self";
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
    // URL manquante ou douteuse : on tombe en fallback bouton inerte plutôt
    // que rediriger vers #lead-form (ce qui était l'ancien comportement trompeur)
    return (
      <button
        type="button"
        disabled
        className={finalClasses}
        data-ff-cta
        title="URL de redirection manquante ou invalide"
      >
        {cta.label}
      </button>
    );
  }

  // Mode "anchor" : scroll vers une section interne
  if (cta.mode === "anchor") {
    const anchorId = (cta.anchorId ?? "lead-form").replace(/^#/, "");
    return (
      <a href={`#${anchorId}`} className={finalClasses} data-ff-cta>
        {cta.label}
      </a>
    );
  }

  // Mode "popup" : ouverture du popup embarqué
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

  // Fallback : bouton inerte
  return (
    <button type="button" disabled className={finalClasses} data-ff-cta>
      {cta.label}
    </button>
  );
}
