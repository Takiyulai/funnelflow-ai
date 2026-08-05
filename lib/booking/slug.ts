// lib/booking/slug.ts
//
// ⚠️ Volontairement dans lib/ et non dans le fichier de route : Next.js
// type-vérifie les exports d'un `route.ts` et rejette tout membre qui n'est pas
// un handler HTTP ou une option de segment reconnue.

/**
 * Marques diacritiques combinantes (U+0300–U+036F), en séquences d'échappement
 * explicites : une plage de caractères combinants collée telle quelle dans le
 * source est invisible à la relecture et se corrompt au moindre copier-coller.
 */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Normalise un slug d'URL : sans accent, minuscules, tirets. */
export function slugifyBooking(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
