// lib/clone/color-extractor.ts
/**
 * Extracteur de palette de couleurs depuis le HTML d'une page source.
 *
 * Stratégie :
 * 1. Parse tous les attributs `style="..."` inline et toutes les balises <style>.
 * 2. Extrait les couleurs sous formats : #RGB, #RRGGBB, rgb(), rgba(), hsl(), hsla().
 * 3. Convertit tout en HEX normalisé.
 * 4. Filtre noir/blanc/transparent quasi-pur (non utilisable comme couleur de marque).
 * 5. Trie par fréquence et retourne primary/secondary/accent.
 */

import type { CheerioAPI } from "cheerio";
import type { ExtractedPalette } from "./types";

const HEX_REGEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
const RGB_REGEX = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/gi;
const HSL_REGEX = /hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*[\d.]+\s*)?\)/gi;

/**
 * Point d'entrée principal.
 */
export function extractPalette($: CheerioAPI, rawHtml: string): ExtractedPalette {
  console.log("[color-extractor] Extraction des couleurs en cours...");

  const allColors = collectAllColors($, rawHtml);
  const filtered = filterUsableColors(allColors);
  const sorted = sortByFrequency(filtered);

  const palette = pickPaletteFromSorted(sorted);

  console.log(
    `[color-extractor] ${allColors.size} couleurs brutes → ${filtered.size} utilisables → palette : primary=${palette.primary}, secondary=${palette.secondary}, accent=${palette.accent}`
  );

  return {
    ...palette,
    allColors: Array.from(sorted.entries()).map(([color, count]) => ({
      color,
      count,
    })),
  };
}

/**
 * Récolte toutes les couleurs depuis attributs style et balises <style>.
 */
function collectAllColors(
  $: CheerioAPI,
  rawHtml: string
): Map<string, number> {
  const counts = new Map<string, number>();

  // Attributs style="..." inline
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    extractColorsFromCss(style, counts);
  });

  // Balises <style>
  $("style").each((_, el) => {
    const css = $(el).html() || "";
    extractColorsFromCss(css, counts);
  });

  // Attributs HTML directs (bgcolor, color)
  $("[bgcolor]").each((_, el) => {
    const c = normalizeColor($(el).attr("bgcolor") || "");
    if (c) bump(counts, c, 1);
  });
  $("[color]").each((_, el) => {
    const c = normalizeColor($(el).attr("color") || "");
    if (c) bump(counts, c, 1);
  });

  // Recherche brute dans le HTML (capture les variables CSS custom etc.)
  extractColorsFromCss(rawHtml, counts, 0.1); // poids réduit pour éviter sur-comptage

  return counts;
}

/**
 * Parse une chaîne CSS et incrémente les compteurs de couleurs trouvées.
 */
function extractColorsFromCss(
  css: string,
  counts: Map<string, number>,
  weight: number = 1
): void {
  let match: RegExpExecArray | null;

  // HEX
  const hexRe = new RegExp(HEX_REGEX.source, HEX_REGEX.flags);
  while ((match = hexRe.exec(css)) !== null) {
    const hex = normalizeHex(match[0]);
    if (hex) bump(counts, hex, weight);
  }

  // RGB / RGBA
  const rgbRe = new RegExp(RGB_REGEX.source, RGB_REGEX.flags);
  while ((match = rgbRe.exec(css)) !== null) {
    const hex = rgbToHex(
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10)
    );
    if (hex) bump(counts, hex, weight);
  }

  // HSL / HSLA
  const hslRe = new RegExp(HSL_REGEX.source, HSL_REGEX.flags);
  while ((match = hslRe.exec(css)) !== null) {
    const hex = hslToHex(
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10)
    );
    if (hex) bump(counts, hex, weight);
  }
}

function bump(counts: Map<string, number>, key: string, weight: number) {
  counts.set(key, (counts.get(key) ?? 0) + weight);
}

/**
 * Normalise toute couleur en HEX 6 chiffres lowercase.
 */
function normalizeColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return normalizeHex(trimmed);

  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return rgbToHex(
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10)
    );
  }
  return null;
}

function normalizeHex(hex: string): string | null {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length !== 6 || !/^[0-9a-f]{6}$/.test(h)) return null;
  return `#${h}`;
}

function rgbToHex(r: number, g: number, b: number): string | null {
  if (
    !Number.isFinite(r) ||
    !Number.isFinite(g) ||
    !Number.isFinite(b) ||
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    return null;
  }
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hslToHex(h: number, s: number, l: number): string | null {
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(s) ||
    !Number.isFinite(l) ||
    s < 0 ||
    s > 100 ||
    l < 0 ||
    l > 100
  ) {
    return null;
  }
  h = ((h % 360) + 360) % 360;
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Filtre les couleurs inutilisables comme couleur de marque :
 * - noir/blanc quasi-pur (luminance < 5% ou > 95%)
 * - gris très désaturé (différence max-min < 15)
 */
function filterUsableColors(
  colors: Map<string, number>
): Map<string, number> {
  const filtered = new Map<string, number>();
  for (const [hex, count] of colors.entries()) {
    const { r, g, b } = hexToRgb(hex);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const saturation = max - min;

    if (luminance < 0.05 || luminance > 0.95) continue;
    if (saturation < 15) continue;
    filtered.set(hex, count);
  }
  return filtered;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function sortByFrequency(
  colors: Map<string, number>
): Map<string, number> {
  return new Map(
    Array.from(colors.entries()).sort((a, b) => b[1] - a[1])
  );
}

/**
 * Sélectionne primary/secondary/accent depuis la liste triée.
 * Garantit une distance chromatique minimale entre les 3.
 */
function pickPaletteFromSorted(
  sorted: Map<string, number>
): { primary: string; secondary: string; accent: string } {
  const entries = Array.from(sorted.keys());

  // Fallbacks neutres si pas assez de couleurs détectées
  const DEFAULT_PRIMARY = "#1f2937";
  const DEFAULT_SECONDARY = "#6b7280";
  const DEFAULT_ACCENT = "#3b82f6";

  if (entries.length === 0) {
    return {
      primary: DEFAULT_PRIMARY,
      secondary: DEFAULT_SECONDARY,
      accent: DEFAULT_ACCENT,
    };
  }

  const primary = entries[0];
  const secondary =
    entries.find((c) => chromaDistance(c, primary) > 80) ||
    entries[1] ||
    DEFAULT_SECONDARY;
  const accent =
    entries.find(
      (c) =>
        chromaDistance(c, primary) > 80 && chromaDistance(c, secondary) > 80
    ) ||
    entries[2] ||
    DEFAULT_ACCENT;

  return { primary, secondary, accent };
}

/**
 * Distance euclidienne RGB simple — suffisant pour notre cas.
 */
function chromaDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  );
}
