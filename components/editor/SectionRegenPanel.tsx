"use client";

// components/editor/SectionRegenPanel.tsx
//
// 🆕 Régénération du copy d'une section via un PROMPT libre (chantier 4).
// L'utilisateur tape une instruction (« rends ça plus percutant », « insiste sur
// la douleur », « raccourcis »…) → POST /api/ai/regenerate-section → aperçu
// AVANT/APRÈS → l'utilisateur applique ou annule.
//
// Le backend (déjà en place) lit OPENAI_MODEL depuis l'env, applique les règles
// copywriting-funnel + layout-design-tunnel, et est gated sur le plan
// (sectionRegeneration). La régen sera soumise au quota mensuel au chantier 2.

import { useState } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import type { FunnelSection, Language, Funnel } from "@/lib/funnels/types";
import { handlePlanGate } from "@/lib/billing/planGate";

type ProposedSection = Pick<
  FunnelSection,
  "type" | "eyebrow" | "headline" | "subheadline" | "body" | "bullets" | "cta"
>;

const SUGGESTIONS = [
  "Rends ce texte plus percutant",
  "Insiste davantage sur la douleur",
  "Raccourcis et va à l'essentiel",
  "Ton plus chaleureux et direct",
];

/** Ligne de comparaison avant (barré) / après (vert). */
function DiffField({ label, before, after }: { label: string; before?: string; after?: string }) {
  if (!before && !after) return null;
  return (
    <div className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      {before && (
        <p className="rounded-md bg-white/[0.03] px-2 py-1.5 text-xs text-white/45 line-through decoration-white/20">
          {before}
        </p>
      )}
      {after && (
        <p className="rounded-md bg-emerald-400/10 px-2 py-1.5 text-xs text-emerald-200">
          {after}
        </p>
      )}
    </div>
  );
}

export function SectionRegenPanel({
  section,
  language,
  funnel,
  onChange,
}: {
  section: FunnelSection;
  language: Language;
  funnel: Funnel;
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposedSection | null>(null);

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/ai/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: {
            id: section.id,
            type: section.type,
            eyebrow: section.eyebrow,
            headline: section.headline,
            subheadline: section.subheadline,
            body: section.body,
            bullets: section.bullets,
            cta: typeof section.cta === "object" ? section.cta : undefined,
          },
          instruction: prompt.trim() || undefined,
          language,
          brief: { language, brandName: funnel.funnelName ?? "" },
        }),
      });
      const json = await res.json().catch(() => ({}));
      // 🆕 Invite d'abonnement uniforme (+ redirection vers les forfaits).
      if (handlePlanGate(res.status, json, (m) => setError(`${m.title}. ${m.description}`))) return;
      if (!res.ok) {
        const map: Record<string, string> = {
          subscription_required: "Un abonnement actif est requis.",
          feature_not_in_plan: "La régénération IA n'est pas incluse dans ton plan.",
        };
        setError(map[json?.error] || json?.message || json?.error || "Régénération impossible.");
        return;
      }
      if (json?.fallback) {
        setError("Régénération IA indisponible pour le moment (texte inchangé).");
        return;
      }
      setProposal(json.section as ProposedSection);
    } catch {
      setError("Erreur réseau. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!proposal) return;
    onChange({
      eyebrow: proposal.eyebrow,
      headline: proposal.headline,
      subheadline: proposal.subheadline,
      body: proposal.body,
      bullets: proposal.bullets,
      ...(proposal.cta ? { cta: proposal.cta } : {}),
    });
    setProposal(null);
    setPrompt("");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-amber-200"
      >
        <Sparkles className="h-4 w-4" />
        Régénérer avec l&apos;IA
        <span className="ml-auto text-[10px] font-normal text-white/40">
          {open ? "Réduire" : "Ouvrir"}
        </span>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-amber-300/15 p-3">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:border-amber-300/40 hover:text-amber-200"
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
            placeholder="Décris la modification souhaitée (ex. « rends ça plus percutant »). Laisse vide pour une simple amélioration."
            className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-300/50"
          />

          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Génération…" : "Régénérer le copy"}
          </button>

          {error && <p className="text-xs text-red-300">{error}</p>}

          {proposal && (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-zinc-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Aperçu — avant (barré) / après (vert)
              </p>
              <DiffField label="Eyebrow" before={section.eyebrow} after={proposal.eyebrow} />
              <DiffField label="Titre" before={section.headline} after={proposal.headline} />
              <DiffField label="Sous-titre" before={section.subheadline} after={proposal.subheadline} />
              <DiffField label="Texte" before={section.body} after={proposal.body} />
              {(section.bullets?.length || proposal.bullets?.length) ? (
                <DiffField
                  label="Puces"
                  before={section.bullets?.join(" · ")}
                  after={proposal.bullets?.join(" · ")}
                />
              ) : null}
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
                  <Check className="h-3.5 w-3.5" /> Appliquer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
