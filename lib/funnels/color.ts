// lib/funnels/color.ts
//
// 🆕 Utilitaire couleur partagé : calcule une couleur de texte lisible
// (noir/blanc) en fonction de la luminosité perçue d'une couleur de fond.
// Utilisé pour garantir le contraste quand l'utilisateur applique ses
// propres couleurs de marque (fond de page, boutons CTA…) — évite le texte
// invisible (ex : texte foncé sur fond foncé).

const DARK_INK = "#0f172a";
const LIGHT_INK = "#ffffff";

/**
 * Renvoie DARK_INK ou LIGHT_INK selon la luminosité perçue de `hex`.
 * Renvoie undefined si `hex` n'est pas une couleur hex valide (#rgb / #rrggbb)
 * — l'appelant garde alors la valeur par défaut du template.
 */
export function contrastInk(hex?: string | null): string | undefined {
  if (!hex) return undefined;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Luminance perçue (pondère la sensibilité de l'œil, formule standard).
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? DARK_INK : LIGHT_INK;
}
