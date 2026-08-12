// components/editor/CloneCopyRewritePanel.tsx
"use client";

// 🆕 Réécriture par prompt du copy d'une section CLONÉE.
//
// Cloner ne suffit pas : sans personnalisation, l'utilisateur publie la page de
// quelqu'un d'autre. Ce panneau réécrit TOUT le texte d'un coup à partir d'une
// consigne libre, en laissant le squelette, le design et les médias intacts.
//
// La garantie est structurelle, pas déclarative : la collecte ne remonte que
// des chaînes indexées par identifiant, et le patch produit n'écrit que
// `texts` et `links[].label`. Le modèle n'a aucun moyen de toucher une balise,
// une couleur, une image ou une URL — voir lib/clone/copy-rewrite.ts.
//
// RIEN N'EST APPLIQUÉ SANS RELECTURE. La proposition est affichée avant/après
// avant d'être posée, et un patch se retire : le HTML capturé n'est jamais
// modifié.

import { useMemo, useState } from "react";
import { Sparkles, Loader2, Check, X, RotateCcw } from "lucide-react";
import type { FunnelSection, RawHtmlPatch } from "@/lib/funnels/types";
import { RAW_HTML_BODY_MARKER } from "@/lib/clone/section-mapper";
import { applyRawHtmlPatches } from "@/lib/clone/raw-html-apply-patches";
import {
  collectCopyItems,
  mergeCopyPatch,
  type CopyItem,
  type RawHtmlCopyPatch,
} from "@/lib/clone/copy-rewrite";
import type { Spot } from "@/lib/clone/raw-html-walker";
import { handlePlanGate } from "@/lib/billing/planGate";

const SUGGESTIONS = [
  "Adapte le copy à mon activité de coach business",
  "Ton plus direct et chaleureux",
  "Raccourcis, va à l'essentiel",
  "Insiste sur le bénéfice principal",
];

/** Extrait le HTML brut d'une section clonée (même convention que le renderer). */
function extractRawHtml(body: string | undefined): string | null {
  if (!body) return null;
  const idx = body.indexOf(RAW_HTML_BODY_MARKER);
  if (idx === -1) return null;
  return body.slice(idx + RAW_HTML_BODY_MARKER.length);
}

type Proposal = {
  patch: RawHtmlCopyPatch;
  stats: { accepted: number; rejected: number; missing: number; submitted: number };
};

export function CloneCopyRewritePanel({
  section,
  language,
  onChange,
}: {
  section: FunnelSection;
  language: "fr" | "en" | "es";
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const rawHtml = useMemo(() => extractRawHtml(section.body), [section.body]);

  // Emplacements de copy actuels. Collectés sur le HTML DÉJÀ PATCHÉ : une
  // seconde réécriture doit partir du texte affiché, pas du texte d'origine.
  const items: CopyItem[] = useMemo(() => {
    if (!rawHtml) return [];
    const spots: Spot[] = [];
    applyRawHtmlPatches(rawHtml, section.rawHtmlPatches, {
      annotate: false,
      collectInto: spots,
    });
    return collectCopyItems(spots);
  }, [rawHtml, section.rawHtmlPatches]);

  /** Texte actuellement affiché pour un identifiant — colonne « avant ». */
  const currentById = useMemo(() => {
    const map = new Map<string, CopyItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const hasPatch =
    !!section.rawHtmlPatches?.texts &&
    Object.keys(section.rawHtmlPatches.texts).length > 0;

  async function run() {
    if (busy || items.length === 0) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/ai/rewrite-clone-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          instruction: prompt.trim() || undefined,
          language,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (handlePlanGate(res.status, json, (m) => setError(`${m.title}. ${m.description}`))) {
        return;
      }
      if (!res.ok || !json?.ok) {
        setError(json?.message || "Réécriture impossible.");
        return;
      }
      setProposal({ patch: json.patch, stats: json.stats });
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!proposal) return;
    // `mergeCopyPatch` conserve tout ce que le patch existant porte déjà —
    // notamment l'action de capture et l'URL posées à la main sur un CTA.
    const merged = mergeCopyPatch<RawHtmlPatch>(
      section.rawHtmlPatches,
      proposal.patch,
    );
    onChange({ rawHtmlPatches: merged });
    setProposal(null);
    setPrompt("");
  }

  /** Retire les réécritures de texte, en gardant les autres patches. */
  function resetTexts() {
    if (!window.confirm("Restaurer tous les textes d'origine de cette section ?")) {
      return;
    }
    const next = { ...(section.rawHtmlPatches ?? {}) };
    delete next.texts;
    if (next.links) {
      // Les libellés de bouton viennent de la même réécriture ; on retire le
      // label mais on PRÉSERVE href, action, ancre et popup.
      const links = { ...next.links };
      for (const [id, patch] of Object.entries(links)) {
        const { label: _label, ...rest } = patch;
        if (Object.keys(rest).length === 0) delete links[id];
        else links[id] = rest;
      }
      next.links = Object.keys(links).length > 0 ? links : undefined;
    }
    onChange({ rawHtmlPatches: next });
  }

  const diffRows = proposal
    ? Object.entries(proposal.patch.texts ?? {})
        .concat(
          Object.entries(proposal.patch.links ?? {}).map(
            ([id, v]) => [id, v.label] as [string, string],
          ),
        )
        .map(([id, after]) => ({
          id,
          before: currentById.get(id)?.text ?? "",
          after,
        }))
        .filter((r) => r.before !== r.after)
    : [];

  if (!rawHtml) return null;

  return (
    // 🆕 THÈME : ce panneau vit dans la colonne de l'éditeur, qui suit le thème
    // de l'application. Les teintes claires codées en dur (`text-violet-100`,
    // `text-white/40`) disparaissaient en mode CLAIR.
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="flex-1 text-xs font-semibold text-ink">
          Réécrire tout le copy avec l&apos;IA
        </span>
        <span className="text-[10px] text-muted">
          {open ? "Fermer" : `${items.length} textes`}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-violet-500/20 px-3 py-2.5">
          <p className="text-[10px] leading-relaxed text-muted">
            Le squelette, la mise en page, les couleurs, les images et les liens
            de redirection ne changent pas. Seul le texte est réécrit.
          </p>

          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Décris ton activité et le ton voulu. Ex : coach business pour freelances, ton direct, promesse = doubler ses tarifs."
            className="w-full resize-y rounded border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-violet-500/50"
          />

          <div className="flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                className="rounded border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-violet-500/50 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>

          {error && (
            <p className="rounded border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">
              {error}
            </p>
          )}

          {!proposal && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={run}
                disabled={busy || items.length === 0}
                className="inline-flex items-center gap-1.5 rounded bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Réécriture…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Proposer une réécriture
                  </>
                )}
              </button>
              {hasPatch && (
                <button
                  type="button"
                  onClick={resetTexts}
                  className="inline-flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-ink"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Restaurer les textes d&apos;origine
                </button>
              )}
            </div>
          )}

          {proposal && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted">
                <strong className="text-violet-200">
                  {diffRows.length} texte{diffRows.length > 1 ? "s" : ""}
                </strong>{" "}
                réécrit{diffRows.length > 1 ? "s" : ""} sur{" "}
                {proposal.stats.submitted}.
                {proposal.stats.rejected > 0 &&
                  ` ${proposal.stats.rejected} refusé${proposal.stats.rejected > 1 ? "s" : ""} (trop long ou balisé).`}
              </p>

              {/* Relecture avant application : c'est ici que l'utilisateur
                  attrape une promesse inventée ou un titre à rallonge. */}
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded border border-line bg-canvas p-1.5">
                {diffRows.map((row) => (
                  <div key={row.id} className="rounded border border-line bg-surface p-1.5">
                    <p className="text-[10px] leading-snug text-muted line-through">
                      {row.before}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium leading-snug text-emerald-600">
                      {row.after}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={apply}
                  className="inline-flex items-center gap-1.5 rounded bg-emerald-400/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/30"
                >
                  <Check className="h-3 w-3" />
                  Appliquer
                </button>
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink"
                >
                  <X className="h-3 w-3" />
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
