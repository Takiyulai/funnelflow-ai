"use client";

import type { ElementType, ReactNode } from "react";

/**
 * RichText — Parse la syntaxe de surlignage [[texte]] ou [[texte|#hex]]
 * et rend du JSX avec des <span> colorés.
 *
 * Conventions :
 *   - [[texte]]              → <span class="ff-hl">texte</span> (couleur = var(--ff-accent))
 *   - [[texte|#abc123]]      → <span class="ff-hl" style="color:#abc123">texte</span>
 *   - texte normal           → rendu inchangé
 *
 * Utilisée dans la preview pour reproduire le rendu de
 * `applyInlineHighlights()` côté export HTML.
 */

type RichTextProps = {
  text?: string | null;
  className?: string;
  /** Tag HTML conteneur (h2, p, span, li…). Défaut : "span". */
  as?: ElementType;
  /** Attribut data-ff-anim (animation au scroll) */
  dataAnim?: string;
};

const HIGHLIGHT_RE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Une couleur de surlignage quasi blanche est presque toujours une erreur (IA)
 * → texte invisible sur fond clair. On l'ignore et on retombe sur l'accent du
 * template. Les couleurs manuelles légitimes (jamais blanches) restent honorées.
 */
function isTooLightHex(hex: string): boolean {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.82;
}

export function RichText({
  text,
  className,
  as: Tag = "span",
  dataAnim,
}: RichTextProps) {
  if (!text) return null;

  // Fast path : pas de balise [[…]]
  if (text.indexOf("[[") === -1) {
    return (
      <Tag className={className} data-ff-anim={dataAnim}>
        {text}
      </Tag>
    );
  }

  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // Reset lastIndex car la regex est globale (sécurité réentrance)
  HIGHLIGHT_RE.lastIndex = 0;

  while ((match = HIGHLIGHT_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const inner = (match[1] || "").trim();
    const rawColor = (match[2] || "").trim();
    const useCustomColor = HEX_RE.test(rawColor) && !isTooLightHex(rawColor);

    if (inner) {
      parts.push(
        <span
          key={`hl-${key++}`}
          className="ff-hl"
          style={useCustomColor ? { color: rawColor } : undefined}
        >
          {inner}
        </span>,
      );
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return (
    <Tag className={className} data-ff-anim={dataAnim}>
      {parts}
    </Tag>
  );
}
