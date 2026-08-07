// lib/booking/colors.ts
//
// Couleur d'accent du calendrier public. Module PUR (aucun import serveur) :
// lu par l'écran d'administration, par la page publique et par la validation
// d'API — une seule définition de « couleur valide » et de « couleur par défaut ».

/**
 * Couleur de repli.
 *
 * ⚠️ Doit rester alignée sur le violet utilisé par le reste de l'application
 * (`bg-violet-400`). Un type de RDV créé avant l'ajout du sélecteur a
 * `color = null` : il doit continuer de s'afficher exactement comme avant.
 */
export const DEFAULT_BOOKING_COLOR = "#a78bfa";

/** Palette proposée en raccourci. La saisie libre reste possible. */
export const BOOKING_COLOR_PRESETS = [
  "#a78bfa", // violet (défaut)
  "#38bdf8", // bleu ciel
  "#34d399", // vert
  "#fbbf24", // ambre
  "#fb7185", // rose
  "#f97316", // orange
  "#818cf8", // indigo
  "#2dd4bf", // turquoise
];

const HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** Hex à 3 ou 6 chiffres, avec dièse. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

/**
 * Couleur exploitable pour le rendu : celle du type de RDV si elle est valide,
 * sinon la couleur de marque. Ne renvoie JAMAIS null — un appelant qui
 * devrait gérer l'absence finirait par oublier un cas et rendre une bordure
 * `undefined`.
 */
export function resolveBookingColor(value: string | null | undefined): string {
  return isValidHexColor(value) ? value.trim().toLowerCase() : DEFAULT_BOOKING_COLOR;
}

/**
 * Texte lisible sur cette couleur : noir ou blanc, selon la luminance perçue.
 *
 * Sans ce calcul, un bouton jaune vif recevrait du texte blanc — illisible.
 * Formule de luminance relative pondérée (ITU-R BT.601), suffisante ici et
 * sans dépendance.
 */
export function readableTextOn(hex: string): string {
  const c = resolveBookingColor(hex).replace("#", "");
  const full =
    c.length === 3
      ? c
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

/** `#rrggbb` + alpha (0-1) → `rgba(...)`, pour les fonds discrets. */
export function withAlpha(hex: string, alpha: number): string {
  const c = resolveBookingColor(hex).replace("#", "");
  const full =
    c.length === 3
      ? c
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
