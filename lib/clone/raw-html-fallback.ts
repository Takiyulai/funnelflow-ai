// lib/clone/raw-html-fallback.ts
//
// CSS et HTML de secours injectés dans les sections raw-html clonées
// quand la détection ou le rendu d'origine échoue.

/**
 * CSS minimal garantissant qu'une section raw-html reste lisible
 * même si le HTML cloné a perdu ses styles d'origine.
 * À injecter dans le <head> du srcdoc en complément des autres styles.
 */
export const RAW_HTML_FALLBACK_STYLE = `
  /* Fallback : si aucun fond n'est défini sur la section racine,
     on garde un fond neutre pour éviter un flash blanc. */
  section:not([style*="background"]):not([bgcolor]),
  [data-section]:not([style*="background"]) {
    background-color: var(--ff-fallback-bg, transparent);
  }

  /* Garantit que le fond image couvre toute la section */
  section[style*="background-image"],
  [data-section][style*="background-image"] {
    background-repeat: no-repeat;
  }

  /* Évite que les enfants en position absolute débordent du fond */
  section[style*="background"] {
    position: relative;
  }
`;

/**
 * Renvoie un HTML de secours minimal pour une section dont le clonage
 * a totalement échoué (HTML vide ou corrompu).
 */
export function buildFallbackSectionHtml(title = "Section"): string {
  return `<section style="padding: 4rem 1rem; text-align: center; color: #888;">
    <p style="font-size: 0.875rem; opacity: 0.6;">⚠️ ${title} — contenu non disponible</p>
  </section>`;
}
