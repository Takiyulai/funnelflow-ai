// components/crm/EmailRichEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  Image as ImageIcon,
  Upload,
  MousePointerClick,
  List,
  Type,
  Palette,
  Eraser,
  Braces,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Trash2,
} from "lucide-react";
import type { EmailPersonalizationField } from "@/lib/email-editor/personalization";

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
  personalizationFields?: EmailPersonalizationField[];
};

const COLORS = ["#0F172A", "#08498D", "#31845C", "#C7A436", "#DC2626", "#64748B"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
// 🆕 Détecte un chemin de fichier LOCAL (disque de l'ordinateur), ex.
// « C:\Users\... », « \\serveur\partage\... » ou « file:///... ». Un tel
// chemin n'est accessible que sur la machine de l'expéditeur — inséré tel
// quel dans un email, le lien/l'image est cassé pour TOUS les destinataires.
// C'est cette confusion (coller un chemin local au lieu d'une URL web) qui
// cassait silencieusement les emails : normalizeUrl() le transformait en
// « https://C:\Users\... », une URL absurde mais syntaxiquement acceptée.
function isLikelyLocalPath(input: string): boolean {
  const v = input.trim();
  if (!v) return false;
  return /^[a-zA-Z]:[\\/]/.test(v) || /^\\\\/.test(v) || /^file:\/\//i.test(v);
}

// 🆕 Normalise une URL saisie : vide → null ; schéma déjà présent (http, https,
// mailto, tel, ancre, chemin relatif) → inchangé ; sinon on préfixe « https:// ».
// Évite le doublon « https://https://… » causé par un champ prérempli.
// Un chemin local (voir isLikelyLocalPath) renvoie null : à l'appelant
// d'avertir l'utilisateur plutôt que de générer un lien cassé.
function normalizeUrl(input: string | null): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  if (isLikelyLocalPath(v)) return null;
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(v)) return v;
  return `https://${v}`;
}

export function EmailRichEditor({
  value,
  onChange,
  placeholder,
  personalizationFields = [],
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>("");
  const [showColors, setShowColors] = useState(false);
  // 🆕 Upload d'image (au lieu de coller une URL / un chemin local).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  // 🆕 Bouton CTA : texte + lien saisis via prompt, couleur choisie ensuite
  // dans un popover (même patron que le sélecteur de couleur du texte).
  const pendingCtaRef = useRef<{ text: string; url: string; range: Range | null } | null>(null);
  const [showCtaColors, setShowCtaColors] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [selectedInlineImage, setSelectedInlineImage] = useState<HTMLImageElement | null>(null);

  // Sync externe (ouverture d'une autre campagne) sans casser le curseur :
  // on ne réécrit le HTML que s'il diffère de ce que l'éditeur a émis.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== lastEmitted.current && value !== el.innerHTML) {
      el.innerHTML = value || "";
      lastEmitted.current = value || "";
      setSelectedInlineImage(null);
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    // Plusieurs navigateurs déclenchent `input` pendant execCommand. La
    // commande appelle ensuite emit() elle-même pour les navigateurs qui ne
    // le font pas. On ignore donc le second événement s'il ne porte aucun
    // changement : une action utilisateur = une version dans l'historique.
    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    onChange(html);
  };

  const saveCurrentEditorRange = () => {
    const el = ref.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) {
      savedRangeRef.current = null;
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      savedRangeRef.current =
        container.isConnected && (container === el || el.contains(container))
          ? range.cloneRange()
          : null;
    } catch {
      savedRangeRef.current = null;
    }
  };

  const createRangeAtEnd = (el: HTMLDivElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    return range;
  };

  const restoreRangeOrMoveToEnd = (): Range | null => {
    const el = ref.current;
    if (!el) return null;
    const selection = window.getSelection();
    if (!selection) return null;

    let range = savedRangeRef.current;
    try {
      const container = range?.commonAncestorContainer;
      if (
        !range ||
        !container?.isConnected ||
        (container !== el && !el.contains(container))
      ) {
        range = createRangeAtEnd(el);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      return range;
    } catch {
      // Une sélection DOM peut devenir invalide après une actualisation React.
      // On repart alors d'un curseur neuf à la fin du bloc, sans faire tomber
      // l'ensemble de l'éditeur.
      try {
        range = createRangeAtEnd(el);
        selection.removeAllRanges();
        selection.addRange(range);
        return range;
      } catch {
        return null;
      }
    }
  };

  const selectInsertedImage = (url: string) => {
    const el = ref.current;
    if (!el) return;
    const image = Array.from(el.querySelectorAll("img"))
      .reverse()
      .find((candidate) => candidate.getAttribute("src") === url || candidate.src === url);
    if (!image) return;
    image.style.display = "block";
    image.style.width = image.style.width || "100%";
    image.style.maxWidth = "100%";
    image.style.height = "auto";
    image.style.borderRadius = image.style.borderRadius || "8px";
    image.style.marginLeft = "auto";
    image.style.marginRight = "auto";
    setSelectedInlineImage(image);
  };

  const resizeInlineImage = (width: number) => {
    if (!selectedInlineImage || !selectedInlineImage.isConnected) return;
    selectedInlineImage.style.width = `${width}%`;
    selectedInlineImage.style.maxWidth = "100%";
    selectedInlineImage.style.height = "auto";
    selectedInlineImage.style.display = "block";
    emit();
  };

  const insertPersonalization = (token: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = restoreRangeOrMoveToEnd();
    let inserted = false;

    try {
      inserted =
        typeof document.execCommand === "function" &&
        document.execCommand("insertText", false, token);
    } catch {
      inserted = false;
    }

    if (!inserted) {
      try {
        const targetRange = range ?? createRangeAtEnd(el);
        targetRange.deleteContents();
        const textNode = document.createTextNode(token);
        targetRange.insertNode(textNode);
        targetRange.setStartAfter(textNode);
        targetRange.collapse(true);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(targetRange);
        }
      } catch {
        // Dernier recours sûr : la variable reste ajoutée au bloc même si le
        // navigateur refuse toute restauration de sélection.
        el.append(document.createTextNode(token));
      }
    }

    saveCurrentEditorRange();
    setShowPersonalization(false);
    emit();
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
    const el = ref.current;
    if (!el) return;
    el.focus();
    // 🆕 On SAUVEGARDE la sélection AVANT le prompt : window.prompt vole le focus
    // et collapse la sélection → sans ça, createLink n'a plus rien à envelopper
    // et le mot sélectionné (« ici ») reste du texte non cliquable.
    const sel = window.getSelection();
    const savedRange =
      sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    const hadSelection = !!savedRange && !savedRange.collapsed;

    // 🆕 Champ VIDE par défaut (plus de « https:// » prérempli) : coller une URL
    // complète produisait « https://https://… ». On normalise ensuite le schéma.
    const raw = window.prompt(
      "URL du lien (ex. https://exemple.com/page) :",
      "",
    );
    if (raw && isLikelyLocalPath(raw)) {
      alert(
        "Ce champ attend un lien web (https://…), pas un chemin de fichier de votre ordinateur — un chemin local ne fonctionne pour aucun destinataire. Hébergez d'abord le fichier (ex. Google Drive) puis collez son lien de partage.",
      );
      return;
    }
    const url = normalizeUrl(raw);
    if (!url) return;

    // On RESTAURE la sélection perdue à l'ouverture du prompt.
    el.focus();
    if (savedRange && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    if (hadSelection) {
      // 🆕 On DÉLIE d'abord la sélection : sans ça, modifier un lien existant ne
      // remplaçait pas toujours la destination (href) — le texte changeait mais
      // le lien pointait encore vers l'ancienne URL (ex. l'ancien PDF cadeau).
      document.execCommand("unlink");
      document.execCommand("createLink", false, url);
    } else {
      // Aucun texte sélectionné → on insère un lien cliquable (libellé = URL).
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${escapeAttr(url)}">${escapeHtml(url)}</a>`,
      );
    }
    // Ouvre dans un nouvel onglet + sécurise (rel) les liens fraîchement créés.
    el.querySelectorAll('a[href]:not([target])').forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    emit();
  };

  const addImage = () => {
    const raw = window.prompt("URL de l'image (ex. https://exemple.com/img.jpg) :", "");
    if (raw && isLikelyLocalPath(raw)) {
      alert(
        "Ce champ attend une URL web (https://…), pas un chemin de fichier de votre ordinateur — l'image ne s'afficherait chez aucun destinataire. Utilisez plutôt le bouton « Uploader une image ».",
      );
      return;
    }
    const url = normalizeUrl(raw);
    if (!url) return;
    cmd("insertImage", url);
    const el = ref.current;
    if (el) {
      selectInsertedImage(url);
      emit();
    }
  };

  // 🆕 Upload d'image : ouvre le sélecteur de fichier. On sauvegarde la
  // sélection AVANT (le dialogue fichier vole le focus, comme window.prompt),
  // on l'envoie à /api/media/upload (Supabase Storage, endpoint déjà utilisé
  // pour les médias de tunnel), puis on restaure la sélection et on insère
  // l'URL publique retournée.
  const triggerImageUpload = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    saveCurrentEditorRange();
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // permet de re-sélectionner le même fichier ensuite
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Merci de choisir un fichier image (jpg, png, webp, gif…).");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("spotId", "email-editor");
      fd.append("funnelId", "crm-email");
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error || "Échec de l'upload de l'image.");
        return;
      }

      const el = ref.current;
      if (!el) return;
      el.focus();
      restoreRangeOrMoveToEnd();
      document.execCommand("insertImage", false, data.url);
      selectInsertedImage(data.url);
      emit();
    } catch {
      alert("Erreur réseau pendant l'upload de l'image.");
    } finally {
      setUploading(false);
    }
  };

  // 🆕 Bouton CTA : texte + lien via prompt (même patron que addLink/addImage),
  // puis choix de la couleur dans un popover avant insertion.
  const addCta = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;

    const text = window.prompt("Texte du bouton (ex. Je réserve ma place) :", "En savoir plus");
    if (!text || !text.trim()) return;

    const raw = window.prompt("Lien de redirection du bouton (ex. https://exemple.com/page) :", "");
    if (raw && isLikelyLocalPath(raw)) {
      alert(
        "Ce champ attend un lien web (https://…), pas un chemin de fichier de votre ordinateur.",
      );
      return;
    }
    const url = normalizeUrl(raw);
    if (!url) return;

    pendingCtaRef.current = { text: text.trim(), url, range: savedRange };
    setShowCtaColors(true);
  };

  const insertCtaWithColor = (color: string) => {
    const pending = pendingCtaRef.current;
    setShowCtaColors(false);
    const el = ref.current;
    if (!el || !pending) return;
    el.focus();
    const sel = window.getSelection();
    if (pending.range && sel) {
      sel.removeAllRanges();
      sel.addRange(pending.range);
    }
    const html =
      `<div style="text-align:center;margin:24px 0;">` +
      `<a href="${escapeAttr(pending.url)}" target="_blank" rel="noopener noreferrer" ` +
      `style="display:inline-block;background-color:${escapeAttr(color)};color:#ffffff;` +
      `padding:14px 28px;border-radius:8px;font-weight:700;text-decoration:none;` +
      `font-size:15px;font-family:Arial,Helvetica,sans-serif;">` +
      `${escapeHtml(pending.text)}</a></div>`;
    document.execCommand("insertHTML", false, html);
    pendingCtaRef.current = null;
    emit();
  };

  const setSize = (size: string) => {
    if (!size) return;
    cmd("fontSize", size); // 1..7
  };

  const btn =
    "grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink transition hover:bg-canvas";

  return (
    <div className="min-w-0 max-w-full rounded-lg border border-line bg-surface">
      {/* Barre d'outils */}
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
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

        {/* 🆕 Alignement du texte */}
        <button type="button" className={btn} title="Aligner à gauche" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyLeft")}>
          <AlignLeft className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Centrer" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyCenter")}>
          <AlignCenter className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Aligner à droite" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyRight")}>
          <AlignRight className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Justifier" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyFull")}>
          <AlignJustify className="h-4 w-4" />
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
        {personalizationFields.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className={btn}
              title="Variables de substitution"
              aria-label="Variables de substitution"
              onMouseDown={(event) => {
                event.preventDefault();
                saveCurrentEditorRange();
              }}
              onClick={() => setShowPersonalization((current) => !current)}
            >
              <Braces className="h-4 w-4" />
            </button>
            {showPersonalization && (
              <div className="fixed inset-x-3 bottom-20 z-[80] grid max-h-[min(16rem,60dvh)] gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-elevated sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-9 sm:min-w-64">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Variables de substitution
                </div>
                {personalizationFields.map((field) => (
                  <button
                    key={`${field.source}-${field.key}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPersonalization(field.token)}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs text-ink hover:bg-canvas"
                  >
                    <span>{field.label}</span>
                    <code className="shrink-0 text-[10px] text-muted">{field.token}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button type="button" className={btn} title="Insérer un lien / fichier" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </button>
        {/* 🆕 Upload direct (au lieu de coller un chemin local par erreur). */}
        <button
          type="button"
          className={btn}
          title="Uploader une image depuis votre ordinateur"
          disabled={uploading}
          onMouseDown={(e) => e.preventDefault()}
          onClick={triggerImageUpload}
        >
          <Upload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
        </button>
        <button type="button" className={btn} title="Insérer une image déjà en ligne (URL)" onMouseDown={(e) => e.preventDefault()} onClick={addImage}>
          <ImageIcon className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />

        <span className="mx-1 h-5 w-px bg-line" />

        {/* 🆕 Bouton CTA : texte + lien + couleur, inséré à l'endroit du curseur. */}
        <div className="relative">
          <button
            type="button"
            className={btn}
            title="Insérer un bouton CTA"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addCta}
          >
            <MousePointerClick className="h-4 w-4" />
          </button>
          {showCtaColors && (
            <div className="absolute left-0 top-9 z-10 flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-2 shadow-elevated">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertCtaWithColor(c)}
                  className="h-5 w-5 rounded-full border border-line"
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="grid h-5 w-5 place-items-center rounded-full border border-line" title="Couleur personnalisée">
                <input
                  type="color"
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={(e) => insertCtaWithColor(e.target.value)}
                  className="h-5 w-5 cursor-pointer opacity-0"
                />
                +
              </label>
            </div>
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-line" />

        <button type="button" className={btn} title="Effacer la mise en forme" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("removeFormat")}>
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      {selectedInlineImage && selectedInlineImage.isConnected && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-canvas px-2 py-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted">
            Image sélectionnée
          </span>
          {[25, 50, 75, 100].map((width) => (
            <button
              key={width}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => resizeInlineImage(width)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-ink"
            >
              {width} %
            </button>
          ))}
          <button
            type="button"
            title="Supprimer l’image"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              selectedInlineImage.remove();
              setSelectedInlineImage(null);
              emit();
            }}
            className="ml-auto rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Zone éditable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onClick={(event) => {
          const target = event.target;
          setSelectedInlineImage(target instanceof HTMLImageElement ? target : null);
        }}
        data-placeholder={placeholder || "Rédigez votre email…"}
        className="ff-email-editor min-h-[180px] min-w-0 w-full max-w-full break-words px-3 py-2.5 text-sm leading-relaxed text-ink outline-none [overflow-wrap:anywhere]"
      />
    </div>
  );
}

export default EmailRichEditor;
