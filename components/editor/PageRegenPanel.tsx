"use client";

// components/editor/PageRegenPanel.tsx
//
// 🆕 Régénération IA d'une PAGE ENTIÈRE (toutes ses sections) via un prompt
// libre. Complète SectionRegenPanel (par section). L'utilisateur qui n'aime que
// le copy d'une page (ex. l'inscription) la reprend d'un clic, sans toucher au
// reste du tunnel. POST /api/ai/regenerate-page → aperçu → appliquer/annuler.
// Les médias existants (images/vidéos) sont CONSERVÉS (report par position).

import { useMemo, useState } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import type {
  FunnelSection,
  Funnel,
  FunnelPage,
  PageRole,
} from "@/lib/funnels/types";
import { handlePlanGate } from "@/lib/billing/planGate";
import { extractHomeContext } from "@/lib/clone/clone-context";

const SUGGESTIONS = [
  "Rends le copy plus percutant",
  "Ton plus direct et chaleureux",
  "Insiste sur le bénéfice principal",
  "Raccourcis, va à l'essentiel",
];

/**
 * 🆕 Type de page proposé à la génération.
 *
 * ── POURQUOI CE SÉLECTEUR EXISTE ────────────────────────────────────────────
 * Une page ajoutée depuis l'éditeur naît avec `role: "custom"`. Or
 * `getPageBlueprint(kind, role)` ne connaît pas ce rôle : AUCUNE convention ne
 * s'applique — ni `allowedSectionTypes`, ni `minSections`, ni le framework de
 * copywriting. Demander « une page de remerciement » produisait donc une page
 * de vente complète, témoignages compris, alors que le catalogue les retire
 * explicitement des pages post-conversion.
 *
 * Le rôle ne pouvait pas être deviné depuis le prompt sans fragilité. On le
 * demande, et on le POSE sur la page en même temps qu'on applique le copy :
 * les conventions s'appliquent enfin, et la page reste correcte si elle est
 * régénérée plus tard.
 */
const PAGE_ROLE_OPTIONS: { id: PageRole; label: string }[] = [
  { id: "thankyou", label: "Remerciement" },
  { id: "confirmation", label: "Confirmation" },
  { id: "delivery", label: "Livraison" },
  { id: "optin", label: "Capture" },
  { id: "sales", label: "Vente" },
  { id: "upsell", label: "Upsell" },
  { id: "custom", label: "Libre" },
];

export function PageRegenPanel({
  funnel,
  page,
  onApply,
}: {
  funnel: Funnel;
  page: FunnelPage;
  /**
   * Remplace toutes les sections de la page (médias déjà reportés).
   * `role` est fourni quand l'utilisateur a choisi un type de page : il doit
   * être posé sur la page, sinon les conventions ne s'appliqueront pas à la
   * prochaine régénération.
   */
  onApply: (sections: FunnelSection[], role?: PageRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<FunnelSection[] | null>(null);
  const [role, setRole] = useState<PageRole>(page.role ?? "custom");

  // 🆕 Contexte éditorial de la page d'accueil — clonée OU native.
  // Recalculé à l'ouverture du panneau : sur un clone, il vient du HTML
  // capturé et suit donc les personnalisations déjà appliquées.
  const homeContext = useMemo(() => {
    if (!open) return null;
    return extractHomeContext(funnel.pages?.find((p) => p.isHome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funnel.pages]);

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
      const res = await fetch("/api/ai/regenerate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: funnel.meta?.funnelKind ?? "lead-magnet",
          // 🆕 Le rôle CHOISI, pas celui de la page : une page ajoutée depuis
          // l'éditeur naît en "custom", pour lequel aucun blueprint n'existe et
          // donc aucune convention ne s'applique.
          role,
          slug: page.slug,
          name: page.name,
          instruction: prompt.trim() || undefined,
          language: funnel.language,
          // 🆕 Contexte enrichi et surtout DISPONIBLE sur un tunnel cloné :
          // l'ancien code lisait `hero.headline` sur la page d'accueil, or une
          // home clonée n'a qu'une section "raw-html" — le contexte était
          // toujours vide et le modèle inventait un univers sans rapport.
          homeContext: {
            headline: homeContext?.headline,
            subheadline: homeContext?.subheadline,
            sectionTitles: homeContext?.sectionTitles,
            ctaLabels: homeContext?.ctaLabels,
            primaryCtaLabel:
              funnel.defaultCta?.label ?? homeContext?.ctaLabels?.[0],
          },
          brief: {
            brandName:
              funnel.header?.brandName ?? funnel.funnelName ?? "",
            offerName: funnel.funnelName ?? "",
            // La promesse du clone alimente le brief : c'est le champ que les
            // prompts consomment déjà pour tous les autres types de tunnel.
            promise: homeContext?.subheadline ?? homeContext?.headline,
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
    // Le rôle part avec les sections : sans lui, la page resterait "custom" et
    // la régénération suivante retomberait dans le même défaut.
    onApply(carryMedia(proposal), role);
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

          {/* 🆕 Type de page — décide des conventions appliquées. */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
              Type de page
            </p>
            <div className="flex flex-wrap gap-1">
              {PAGE_ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRole(opt.id)}
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    role === opt.id
                      ? "bg-violet-400/25 text-violet-100 ring-1 ring-violet-300/50"
                      : "border border-white/10 text-white/60 hover:text-white",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-white/35">
              Détermine les sections autorisées. Une page de remerciement reste
              sobre : ni témoignages, ni argumentaire de vente.
            </p>
          </div>

          {/* 🆕 Contexte repris de la page d'accueil, y compris clonée. */}
          {homeContext?.headline && (
            <p className="rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed text-white/45">
              Contexte repris de l&apos;accueil :{" "}
              <span className="text-white/70">
                « {homeContext.headline.slice(0, 90)}
                {homeContext.headline.length > 90 ? "…" : ""} »
              </span>
            </p>
          )}

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
