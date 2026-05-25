"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bouton "Colorer la selection" a placer a cote d'un champ texte (input ou
 * textarea) de l'editeur.
 *
 * Principe :
 *   1. L'utilisateur selectionne du texte dans le champ associe.
 *   2. Le bouton devient actif (il detecte une selection non vide).
 *   3. Au clic, un <input type="color"> natif s'ouvre.
 *   4. Au choix de la couleur, le texte selectionne est remplace par
 *      [[texte|#xxxxxx]] dans le champ — la convention reconnue au rendu
 *      par applyInlineHighlights() dans lib/export/html.ts.
 *
 * Si le texte selectionne est DEJA entoure de [[...|#xxx]] ou de [[...]] :
 *   - on remplace la couleur existante (ou on en ajoute une) au lieu
 *     d'imbriquer.
 *
 * Si le bouton est cliquable sans selection :
 *   - rien ne se passe (le bouton est en realite disabled dans ce cas).
 *
 * Usage :
 *   const [headline, setHeadline] = useState("...");
 *   const ref = useRef<HTMLInputElement>(null);
 *   <input ref={ref} value={headline} onChange={...} />
 *   <TextColorButton fieldRef={ref} value={headline} onChange={setHeadline} />
 */

type FieldRef =
  | React.RefObject<HTMLInputElement | null>
  | React.RefObject<HTMLTextAreaElement | null>;

type Props = {
  /** Reference vers l'<input> ou <textarea> a manipuler. */
  fieldRef: FieldRef;
  /** Valeur actuelle du champ (controlled). */
  value: string;
  /** Callback appele avec la nouvelle valeur du champ. */
  onChange: (next: string) => void;
  /** Couleur par defaut quand l'utilisateur n'en a jamais choisi. */
  defaultColor?: string;
  /** Texte du bouton (optionnel). */
  label?: string;
  /** Classe CSS optionnelle pour styler le bouton dans l'editeur. */
  className?: string;
};

export function TextColorButton({
  fieldRef,
  value,
  onChange,
  defaultColor = "#fbbf24",
  label = "Colorer la sélection",
  className = "",
}: Props) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [lastColor, setLastColor] = useState(defaultColor);

  // On surveille la selection dans le champ. Pas d'event "selectionchange"
  // global pour eviter les fuites — on s'abonne uniquement quand le champ
  // est focus, et on lit selectionStart/selectionEnd.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;

    const checkSelection = () => {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      setHasSelection(end > start);
    };

    el.addEventListener("select", checkSelection);
    el.addEventListener("keyup", checkSelection);
    el.addEventListener("mouseup", checkSelection);
    el.addEventListener("focus", checkSelection);

    return () => {
      el.removeEventListener("select", checkSelection);
      el.removeEventListener("keyup", checkSelection);
      el.removeEventListener("mouseup", checkSelection);
      el.removeEventListener("focus", checkSelection);
    };
  }, [fieldRef]);

  const handleClickButton = () => {
    const el = fieldRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end <= start) return; // pas de selection
    colorInputRef.current?.click();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setLastColor(color);
    applyColorToSelection(color);
  };

  const applyColorToSelection = (color: string) => {
    const el = fieldRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end <= start) return;

    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    // Si la selection est deja entouree de [[...]], on remplace.
    // Sinon on wrap avec [[selection|#color]].
    const wrapped = wrapOrReplace(selected, color);

    const next = `${before}${wrapped}${after}`;
    onChange(next);

    // Restore le focus + selection sur le wrap, pour que l'utilisateur
    // voit ce qui a ete fait.
    requestAnimationFrame(() => {
      el.focus();
      const newEnd = start + wrapped.length;
      el.setSelectionRange(start, newEnd);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClickButton}
        disabled={!hasSelection}
        className={className || defaultBtnClass(hasSelection)}
        title={
          hasSelection
            ? "Choisir une couleur pour le texte sélectionné"
            : "Sélectionnez d'abord du texte dans le champ"
        }
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: 3,
            background: lastColor,
            border: "1px solid rgba(0,0,0,0.1)",
            marginRight: 6,
            verticalAlign: "middle",
          }}
        />
        {label}
      </button>
      {/* Input color natif, cache, declenche par le bouton */}
      <input
        ref={colorInputRef}
        type="color"
        defaultValue={lastColor}
        onChange={handleColorChange}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 0,
          height: 0,
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}

/**
 * Si le texte selectionne contient deja un wrap [[...|#xxx]], on remplace
 * juste la couleur. Sinon on enveloppe la selection brute.
 *
 * Cas geres :
 *   "en 7 jours"              → "[[en 7 jours|#fbbf24]]"
 *   "[[en 7 jours]]"          → "[[en 7 jours|#fbbf24]]"
 *   "[[en 7 jours|#000]]"     → "[[en 7 jours|#fbbf24]]"
 */
function wrapOrReplace(selected: string, color: string): string {
  const trimmed = selected.trim();
  // Match [[texte]] ou [[texte|#xxx]]
  const m = /^\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]$/.exec(trimmed);
  if (m) {
    return `[[${m[1].trim()}|${color}]]`;
  }
  return `[[${selected}|${color}]]`;
}

function defaultBtnClass(enabled: boolean): string {
  // Styles minimaux. Tu peux remplacer par tes classes tailwind/CSS habituelles.
  return [
    "inline-flex",
    "items-center",
    "gap-1",
    "px-2",
    "py-1",
    "rounded",
    "text-xs",
    "font-medium",
    "border",
    enabled
      ? "border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-gray-700"
      : "border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400",
  ].join(" ");
}
