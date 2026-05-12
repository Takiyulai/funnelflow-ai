// components/editor/SystemeIoExportMenu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check, ExternalLink, Code2, ChevronDown, X, BookOpen } from "lucide-react";
import type { Funnel } from "@/lib/funnels/types";
import { renderFunnelHtml, createSystemeBlocks, createSystemeFormBlock } from "@/lib/export/html";
import { useToast } from "@/components/ui/Toast";

const SYSTEME_IO_DASHBOARD = "https://systeme.io/dashboard/funnels";

type Mode = "full" | "block";

export function SystemeIoExportMenu({ funnel }: { funnel: Funnel }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mode, setMode] = useState<Mode>("full");
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur
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

  function buildHtml(currentMode: Mode): string {
    if (currentMode === "full") {
      return renderFunnelHtml(funnel);
    }
    // Mode block : on concatène tous les blocs avec un séparateur visible
    const blocks = createSystemeBlocks(funnel);
    const formBlock = createSystemeFormBlock(funnel);
    const all = [...blocks, formBlock];
    return all
      .map(
        (b, i) =>
          `<!-- ═══ Bloc ${i + 1}/${all.length} : ${b.label} (${b.type}) ═══ -->\n${b.html}`
      )
      .join("\n\n");
  }

  async function copyToClipboard(currentMode: Mode): Promise<boolean> {
    try {
      const html = buildHtml(currentMode);
      await navigator.clipboard.writeText(html);
      return true;
    } catch (err) {
      console.error("[export] copy failed", err);
      return false;
    }
  }

  async function handleCopy(currentMode: Mode) {
    const ok = await copyToClipboard(currentMode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.show({
        title: "Code copié",
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
    // 1. On copie le HTML automatiquement
    const ok = await copyToClipboard(mode);
    if (ok) {
      toast.show({
        title: "Code copié, redirection…",
        description: "Vous allez être redirigé vers systeme.io",
        variant: "success",
      });
    }
    // 2. On ouvre systeme.io dans un nouvel onglet
    window.open(SYSTEME_IO_DASHBOARD, "_blank", "noopener,noreferrer");
    // 3. On affiche le guide
    setShowGuide(true);
    setOpen(false);
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
          title="Exporter vers systeme.io"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Exporter</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {open && (
          <div className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
            {/* Sélecteur de mode */}
            <div className="mb-2 px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
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
                className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                  mode === "block"
                    ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                    : "text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                Blocs séparés
              </button>
            </div>

            <div className="my-1 h-px bg-zinc-800" />

            {/* Action 1 : Copier */}
            <button
              onClick={() => handleCopy(mode)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="h-4 w-4 text-zinc-400 shrink-0" />
              )}
              <span className="flex-1">
                <span className="block font-semibold">
                  {copied ? "Copié !" : "Copier le code"}
                </span>
                <span className="block text-[10px] text-zinc-500">
                  Pour coller dans un bloc Raw HTML
                </span>
              </span>
            </button>

            {/* Action 2 : Importer */}
            <button
              onClick={handleImportToSystemeIo}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition"
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

            {/* Action 3 : Guide */}
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

      {/* Modale guide */}
      {showGuide && <ImportGuideModal onClose={() => setShowGuide(false)} mode={mode} />}
    </>
  );
}

function ImportGuideModal({
  onClose,
  mode,
}: {
  onClose: () => void;
  mode: Mode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-[fadeIn_0.2s_ease-out]"
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

        <p className="mb-4 text-sm text-zinc-400">
          Le code HTML a été copié dans votre presse-papier. Voici les étapes pour
          l'intégrer dans systeme.io.
        </p>

        <ol className="space-y-3">
          {[
            {
              title: "Créez ou ouvrez votre tunnel",
              desc: "Dans systeme.io, allez dans Sites → Tunnels de vente, puis créez un nouveau tunnel ou ouvrez-en un existant.",
            },
            {
              title: "Ajoutez une étape (page)",
              desc: "Choisissez le type d'étape voulu (capture, vente, etc.) et entrez dans l'éditeur de page.",
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
