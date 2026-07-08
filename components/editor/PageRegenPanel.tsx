"use client";

// components/editor/PageRegenPanel.tsx
//
// 🆕 Régénération IA d'une PAGE ENTIÈRE (toutes ses sections) via un prompt
// libre. Complète SectionRegenPanel (par section). L'utilisateur qui n'aime que
// le copy d'une page (ex. l'inscription) la reprend d'un clic, sans toucher au
// reste du tunnel. POST /api/ai/regenerate-page → aperçu → appliquer/annuler.
// Les médias existants (images/vidéos) sont CONSERVÉS (report par position).

import { useState } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import type { FunnelSection, Funnel, FunnelPage } from "@/lib/funnels/types";
import { handlePlanGate } from "@/lib/billing/planGate";

const SUGGESTIONS = [
  "Rends le copy plus percutant",
  "Ton plus direct et chaleureux",
  "Insiste sur le bénéfice principal",
  "Raccourcis, va à l'essentiel",
];

export function PageRegenPanel({
  funnel,
  page,
  onApply,
}: {
  funnel: Funnel;
  page: FunnelPage;
  /** Remplace toutes les sections de la page (médias déjà reportés). */
  onApply: (sections: FunnelSection[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<FunnelSection[] | null>(null);

  // Reporte les médias (image/vidéo) des anciennes sections sur les nouvelles,
  // par position, quand la nouvelle n'en fournit pas → on ne perd pas les
  // visuels uploadés lors d'une régénération de COPY.
  function carryMedia(next: FunnelSection[]): FunnelSection[] {
    const old = page.sections;
    return next.map((s, i) => {
      const prev = old[i];
      return {
        ...s,
        image: s.image ?? prev?.image,
        video: s.video ?? prev?.video,
      };
    });
  }

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const home = funnel.pages?.find((p) => p.isHome);
      const homeHero = home?.sections.find((s) => s.type === "hero");
      const res = await fetch("/api/ai/regenerate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: funnel.meta?.funnelKind ?? "lead-magnet",
          role: page.role,
          slug: page.slug,
          name: page.name,
          instruction: prompt.trim() || undefined,
          language: funnel.language,
          homeContext: {
            headline: homeHero?.headline,
            primaryCtaLabel: funnel.defaultCta?.label,
          },
          brief: {
            brandName:
              funnel.header?.brandName ?? funnel.funnelName ?? "",
            offerName: funnel.funnelName ?? "",
            language: funnel.language,
            primaryCta: funnel.defaultCta,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (handlePlanGate(res.status, json, (m) => setError(`${m.title}. ${m.description}`))) return;
      if (!res.ok) {
        setError(json?.message || json?.error || "Régénération impossible.");
        return;
      }
      if (!Array.isArray(json.sections) || json.sections.length === 0) {
        setError("Régénération IA indisponible pour le moment (page inchangée).");
        return;
      }
      if (json.fallback) {
        setError("IA indisponible : contenu générique proposé. Réessaie.");
      }
      setProposal(json.sections as FunnelSection[]);
    } catch {
      setError("Erreur réseau. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!proposal) return;
    onApply(carryMedia(proposal));
    setProposal(null);
    setPrompt("");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-violet-300/25 bg-violet-300/[0.05]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-violet-200"
      >
        <Sparkles className="h-4 w-4" />
        Régénérer toute la page avec l&apos;IA
        <span className="ml-auto text-[10px] font-normal text-white/40">
          {open ? "Réduire" : "Ouvrir"}
        </span>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-violet-300/15 p-3">
          <p className="text-[11px] leading-relaxed text-white/50">
            Régénère le copy de <b className="text-white/70">toutes les sections</b> de
            cette page (« {page.name} »). Le reste du tunnel n&apos;est pas touché, et
            les images/vidéos sont conservées.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:border-violet-300/40 hover:text-violet-200"
              >
                {s}
              </button>
            ))}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            maxLength={800}
            placeholder="Instruction facultative (ex. « ton plus direct »). Laisse vide pour une simple régénération."
            className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-violet-300/50"
          />

          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-400 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Génération…" : "Régénérer la page"}
          </button>

          {error && <p className="text-xs text-red-300">{error}</p>}

          {proposal && (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-zinc-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Aperçu — {proposal.length} section(s) régénérée(s)
              </p>
              <ul className="grid gap-1">
                {proposal.map((s, i) => (
                  <li key={i} className="text-xs text-emerald-200">
                    <span className="text-white/40">{s.type} — </span>
                    {s.headline || <span className="text-white/40">(sans titre)</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/5"
                >
                  <X className="h-3.5 w-3.5" /> Annuler
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" /> Appliquer à la page
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PageRegenPanel;
