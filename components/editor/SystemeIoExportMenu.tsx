// components/editor/SystemeIoExportMenu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check, ExternalLink, Code2, ChevronDown, X, BookOpen, FileText, Layers } from "lucide-react";
import type { Funnel, FunnelPage } from "@/lib/funnels/types";
import { useToast } from "@/components/ui/Toast";

const SYSTEME_IO_DASHBOARD = "https://systeme.io/dashboard/funnels";

type Mode = "full" | "block";
type Scope = "active" | "all";

const PAGE_ROLE_LABELS: Record<string, string> = {
  optin: "Page de capture",
  sales: "Page de vente",
  thankyou: "Page de remerciement",
  delivery: "Page de livraison",
  confirmation: "Page de confirmation",
  upsell: "Page d'upsell",
  downsell: "Page de downsell",
  webinar: "Page webinaire",
  replay: "Page de replay",
  booking: "Page de réservation",
  reservation: "Page de réservation",
};

function getPageLabel(page?: FunnelPage | null): string {
  if (!page) return "Page d'accueil";
  if (page.role && PAGE_ROLE_LABELS[page.role]) return PAGE_ROLE_LABELS[page.role];
  if (page.isHome) return "Page d'accueil";
  return page.slug || "Page";
}

/**
 * Fallback synchrone : crée un <textarea> hors-écran, y met le HTML,
 * sélectionne, exécute document.execCommand('copy'), puis nettoie.
 * Marche dans 99 % des navigateurs même sans focus parfait.
 */
function copyViaTextarea(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);

    const ok = document.execCommand("copy");

    document.body.removeChild(ta);

    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      try {
        previouslyFocused.focus();
      } catch {
        /* ignore */
      }
    }

    return ok;
  } catch (err) {
    console.error("[export] copyViaTextarea failed", err);
    return false;
  }
}

export function SystemeIoExportMenu({
  funnel,
  activePage,
}: {
  funnel: Funnel;
  activePage?: FunnelPage | null;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mode, setMode] = useState<Mode>("full");
  const [scope, setScope] = useState<Scope>("active");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const activePageLabel = getPageLabel(activePage);
  const hasMultiplePages = (funnel.pages?.length ?? 0) > 1;

  // 🔄 Appel à l'API serveur au lieu d'un calcul synchrone local
  async function buildHtml(currentMode: Mode, currentScope: Scope): Promise<string> {
    const res = await fetch("/api/export/systeme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funnel,
        mode: currentMode,
        scope: currentScope,
        targetPageId: activePage?.id,
      }),
    });
    if (!res.ok) {
      throw new Error(`Export API failed: ${res.status}`);
    }
    const data = (await res.json()) as { html: string };
    return data.html;
  }

  /**
   * Copie le HTML dans le presse-papiers avec triple fallback :
   *   1. navigator.clipboard.writeText (API moderne, nécessite focus)
   *   2. document.execCommand('copy') via <textarea> (fallback universel)
   *   3. Échec gracieux avec log d'erreur
   */
  async function copyToClipboard(
    currentMode: Mode,
    currentScope: Scope,
  ): Promise<boolean> {
    try {
      // 1. Préparer le HTML AVANT toute opération clipboard
      //    (compression d'images, génération du markup, etc.)
      const html = await buildHtml(currentMode, currentScope);

      // 2. Re-focus la fenêtre au cas où DevTools ou un autre élément
      //    aurait pris le focus pendant la génération.
      try {
        window.focus();
      } catch {
        /* ignore */
      }

      // 3. Tentative principale : Clipboard API moderne
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function" &&
        document.hasFocus()
      ) {
        try {
          await navigator.clipboard.writeText(html);
          return true;
        } catch (err) {
          // On bascule sur le fallback en cas d'échec (focus perdu, permissions, etc.)
          console.warn(
            "[export] navigator.clipboard.writeText failed, falling back to execCommand:",
            err,
          );
        }
      }

      // 4. Fallback : <textarea> + document.execCommand('copy')
      //    Fonctionne même si le document n'a pas le focus parfait,
      //    car execCommand opère sur la sélection courante.
      const ok = copyViaTextarea(html);
      if (ok) return true;

      console.error("[export] copy failed: both methods unavailable");
      return false;
    } catch (err) {
      console.error("[export] copy failed", err);
      return false;
    }
  }

  async function handleCopy(currentMode: Mode, currentScope: Scope) {
    setLoading(true);
    const ok = await copyToClipboard(currentMode, currentScope);
    setLoading(false);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      const scopeLabel = currentScope === "all" ? "Tout le tunnel" : activePageLabel;
      toast.show({
        title: `Code copié — ${scopeLabel}`,
        description:
          currentMode === "full"
            ? "Collez-le dans un bloc Raw HTML systeme.io"
            : "Collez chaque bloc séparément dans des blocs Raw HTML",
        variant: "success",
      });
      setOpen(false);
    } else {
      toast.show({ title: "Erreur de copie", variant: "error" });
    }
  }

  async function handleImportToSystemeIo() {
    setLoading(true);
    const ok = await copyToClipboard(mode, scope);
    setLoading(false);
    if (ok) {
      const scopeLabel = scope === "all" ? "Tout le tunnel" : activePageLabel;
      toast.show({
        title: `Code copié (${scopeLabel}), redirection…`,
        description: "Vous allez être redirigé vers systeme.io",
        variant: "success",
      });
    }
    window.open(SYSTEME_IO_DASHBOARD, "_blank", "noopener,noreferrer");
    setShowGuide(true);
    setOpen(false);
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
          title={`Exporter : ${activePageLabel}`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Exporter</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {open && (
          <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
            <div className="mb-2 rounded-md bg-indigo-500/10 px-3 py-2 ring-1 ring-indigo-500/20">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/80">
                Page sélectionnée
              </div>
              <div className="mt-0.5 text-xs font-semibold text-white">
                {activePageLabel}
              </div>
            </div>

            {hasMultiplePages && (
              <>
                <div className="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Portée
                </div>
                <div className="mb-2 grid grid-cols-2 gap-1 px-1">
                  <button
                    onClick={() => setScope("active")}
                    className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                      scope === "active"
                        ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                        : "text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <FileText className="h-3 w-3" />
                    Page active
                  </button>
                  <button
                    onClick={() => setScope("all")}
                    className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                      scope === "all"
                        ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                        : "text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <Layers className="h-3 w-3" />
                    Tout le tunnel
                  </button>
                </div>
              </>
            )}

            <div className="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Format d'export
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1 px-1">
              <button
                onClick={() => setMode("full")}
                className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                  mode === "full"
                    ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                    : "text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                Page complète
              </button>
              <button
                onClick={() => setMode("block")}
                disabled={scope === "all"}
                className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                  mode === "block"
                    ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                    : "text-zinc-400 hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
                title={scope === "all" ? "Disponible uniquement pour la page active" : ""}
              >
                Blocs séparés
              </button>
            </div>

            <div className="my-1 h-px bg-zinc-800" />

            <button
              onClick={() => handleCopy(mode, scope)}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="h-4 w-4 text-zinc-400 shrink-0" />
              )}
              <span className="flex-1">
                <span className="block font-semibold">
                  {loading ? "Génération…" : copied ? "Copié !" : "Copier le code"}
                </span>
                <span className="block text-[10px] text-zinc-500">
                  {scope === "all"
                    ? "Toutes les pages du tunnel"
                    : `Page : ${activePageLabel}`}
                </span>
              </span>
            </button>

            <button
              onClick={handleImportToSystemeIo}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold">Importer dans systeme.io</span>
                <span className="block text-[10px] text-zinc-500">
                  Copie le code et ouvre systeme.io
                </span>
              </span>
            </button>

            <div className="my-1 h-px bg-zinc-800" />

            <button
              onClick={() => {
                setShowGuide(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Voir le guide d'import</span>
            </button>
          </div>
        )}
      </div>

      {showGuide && (
        <ImportGuideModal
          onClose={() => setShowGuide(false)}
          mode={mode}
          scope={scope}
          pageLabel={activePageLabel}
        />
      )}
    </>
  );
}

// ─── ImportGuideModal : INCHANGÉ ────────────────────────────────────────────
function ImportGuideModal({
  onClose,
  mode,
  scope,
  pageLabel,
}: {
  onClose: () => void;
  mode: Mode;
  scope: Scope;
  pageLabel: string;
}) {
  const scopeLabel = scope === "all" ? "Tout le tunnel" : pageLabel;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-white transition"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
            <BookOpen className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-white">Importer dans systeme.io</h2>
        </div>

        <div className="mb-4 rounded-md bg-indigo-500/10 px-3 py-2 ring-1 ring-indigo-500/20">
          <p className="text-xs text-indigo-200">
            <strong>{scopeLabel}</strong> — Le code HTML a été copié dans votre presse-papier.
          </p>
        </div>

        <p className="mb-4 text-sm text-zinc-400">
          {scope === "all"
            ? "Le code contient toutes les pages de votre tunnel, séparées par des commentaires. Créez une étape par page dans systeme.io et collez le bloc correspondant dans chacune."
            : "Voici les étapes pour intégrer ce code dans la page correspondante de votre tunnel systeme.io."}
        </p>

        <ol className="space-y-3">
          {[
            {
              title: "Créez ou ouvrez votre tunnel",
              desc: "Dans systeme.io, allez dans Sites → Tunnels de vente, puis créez un nouveau tunnel ou ouvrez-en un existant.",
            },
            {
              title: scope === "all"
                ? "Créez une étape par page"
                : `Ouvrez l'étape « ${pageLabel} »`,
              desc: scope === "all"
                ? "Pour chaque page du tunnel, créez une étape (capture, vente, remerciement, etc.) et entrez dans son éditeur."
                : "Choisissez le type d'étape correspondant et entrez dans l'éditeur de page.",
            },
            {
              title: mode === "full"
                ? "Glissez un bloc « Code personnalisé »"
                : "Glissez un bloc « Code personnalisé » par section",
              desc: mode === "full"
                ? "Dans l'éditeur, cherchez le widget « Code personnalisé » (ou Raw HTML) et déposez-le sur la page."
                : "Pour chaque section, glissez un bloc « Code personnalisé » à l'endroit voulu et collez le bloc correspondant.",
            },
            {
              title: "Collez le code copié",
              desc: "Cliquez sur le bloc, puis collez (Ctrl+V / Cmd+V) le HTML que nous avons copié pour vous.",
            },
            {
              title: "Sauvegardez et publiez",
              desc: "Enregistrez la page, puis publiez votre tunnel.",
            },
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-300">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-200">{step.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            💡 <strong>Astuce</strong> : si le code ne semble pas avoir été copié, utilisez
            le bouton « Copier le code » pour réessayer.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition"
          >
            Fermer
          </button>
          <a
            href={SYSTEME_IO_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-900/40 hover:from-indigo-400 hover:to-indigo-500 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir systeme.io
          </a>
        </div>
      </div>
    </div>
  );
}
