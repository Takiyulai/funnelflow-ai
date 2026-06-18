// components/crm/EmailRichEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  Image as ImageIcon,
  List,
  Type,
  Palette,
  Eraser,
} from "lucide-react";

/**
 * Éditeur d'email enrichi MINIMALISTE (« juste ce qu'il faut »).
 *
 * Fonctions : gras / italique / souligné, taille de texte, couleur, lien
 * (pour rattacher un fichier ou une URL externe), image (par URL), liste.
 * Sortie : HTML simple, compatible avec l'envoi Resend et les variables
 * {{prenom}} / {{email}}. Compatible mode dark/light (tokens du thème).
 *
 * Implémentation volontairement légère via document.execCommand : suffisant et
 * robuste pour un composer d'email, sans dépendance externe.
 */

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const COLORS = ["#0F172A", "#08498D", "#31845C", "#C7A436", "#DC2626", "#64748B"];

export function EmailRichEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>("");
  const [showColors, setShowColors] = useState(false);

  // Sync externe (ouverture d'une autre campagne) sans casser le curseur :
  // on ne réécrit le HTML que s'il diffère de ce que l'éditeur a émis.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== lastEmitted.current && value !== el.innerHTML) {
      el.innerHTML = value || "";
      lastEmitted.current = value || "";
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  };

  // execCommand : on garde le focus sur l'éditeur (onMouseDown preventDefault).
  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    try {
      document.execCommand(command, false, arg);
    } catch {
      /* commande non supportée : non bloquant */
    }
    emit();
  };

  const addLink = () => {
    const url = window.prompt(
      "URL du lien (page, fichier à télécharger, etc.) :",
      "https://",
    );
    if (!url) return;
    cmd("createLink", url);
    // Ouvrir dans un nouvel onglet : on retouche le dernier lien créé.
    const el = ref.current;
    if (el) {
      el.querySelectorAll('a[href]:not([target])').forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
      emit();
    }
  };

  const addImage = () => {
    const url = window.prompt("URL de l'image (lien public hébergé) :", "https://");
    if (!url) return;
    cmd("insertImage", url);
    const el = ref.current;
    if (el) {
      el.querySelectorAll("img:not([style])").forEach((img) => {
        img.setAttribute("style", "max-width:100%;height:auto;border-radius:8px;");
      });
      emit();
    }
  };

  const setSize = (size: string) => {
    if (!size) return;
    cmd("fontSize", size); // 1..7
  };

  const btn =
    "grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink transition hover:bg-canvas";

  return (
    <div className="rounded-lg border border-line bg-surface">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        <button type="button" className={btn} title="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Italique" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Souligné" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")}>
          <Underline className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-line" />

        {/* Taille */}
        <div className="flex items-center gap-1" title="Taille du texte">
          <Type className="h-3.5 w-3.5 text-muted" />
          <select
            onChange={(e) => {
              setSize(e.target.value);
              e.currentTarget.selectedIndex = 0;
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="h-8 rounded-md border border-line bg-surface px-1.5 text-xs text-ink"
            defaultValue=""
          >
            <option value="" disabled>
              Taille
            </option>
            <option value="2">Petit</option>
            <option value="3">Normal</option>
            <option value="5">Grand</option>
            <option value="6">Titre</option>
          </select>
        </div>

        <span className="mx-1 h-5 w-px bg-line" />

        {/* Couleur */}
        <div className="relative">
          <button
            type="button"
            className={btn}
            title="Couleur du texte"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowColors((v) => !v)}
          >
            <Palette className="h-4 w-4" />
          </button>
          {showColors && (
            <div className="absolute left-0 top-9 z-10 flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-2 shadow-elevated">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    cmd("foreColor", c);
                    setShowColors(false);
                  }}
                  className="h-5 w-5 rounded-full border border-line"
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="grid h-5 w-5 place-items-center rounded-full border border-line" title="Couleur personnalisée">
                <input
                  type="color"
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={(e) => {
                    cmd("foreColor", e.target.value);
                    setShowColors(false);
                  }}
                  className="h-5 w-5 cursor-pointer opacity-0"
                />
                +
              </label>
            </div>
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-line" />

        <button type="button" className={btn} title="Liste à puces" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Insérer un lien / fichier" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Insérer une image (URL)" onMouseDown={(e) => e.preventDefault()} onClick={addImage}>
          <ImageIcon className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-line" />

        <button type="button" className={btn} title="Effacer la mise en forme" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("removeFormat")}>
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      {/* Zone éditable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder || "Rédigez votre email…"}
        className="ff-email-editor min-h-[180px] w-full px-3 py-2.5 text-sm leading-relaxed text-ink outline-none"
      />
    </div>
  );
}

export default EmailRichEditor;
