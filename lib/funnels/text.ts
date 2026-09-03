/**
 * Sépare un texte sur le premier délimiteur éditorial situé hors d'une balise
 * de couleur `[[texte|#hex]]`. Le pipe interne à la balise ne doit jamais être
 * interprété comme le séparateur « Titre | Description ».
 */
export function splitTextPair(raw: string): { first: string; second: string } | null {
  if (!raw) return null;

  let inHighlight = false;
  for (let index = 0; index < raw.length; index += 1) {
    if (!inHighlight && raw.startsWith("[[", index)) {
      inHighlight = true;
      index += 1;
      continue;
    }
    if (inHighlight && raw.startsWith("]]", index)) {
      inHighlight = false;
      index += 1;
      continue;
    }
    if (inHighlight) continue;

    const separatorLength = raw.startsWith("::", index)
      ? 2
      : raw[index] === "|" || raw[index] === "—" || raw[index] === "–"
        ? 1
        : 0;
    if (separatorLength === 0) continue;

    const first = raw.slice(0, index).trim();
    const second = raw.slice(index + separatorLength).trim();
    if (first && second) return { first, second };
  }

  return null;
}
