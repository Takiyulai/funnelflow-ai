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
import { extractHomeContext, isClonedSection } from "@/lib/clone/clone-context";

const SUGGESTIONS = [
  "Rends le copy plus percutant",
  "Ton plus direct et chaleureux",
  "Insiste sur le bénéfice principal",
  "Raccourcis, va à l'essentiel",
];

const GENERATION_SUGGESTIONS = [
  "Présente les informations essentielles et la prochaine étape",
  "Crée une page courte avec un appel à l'action clair",
  "Reprends le ton et la promesse de la page d'accueil",
];

/** Une page vide ou le seul hero créé par « + Page », pas une page courte
 * déjà rédigée. Les médias ajoutés au placeholder seront conservés. */
export function isPageGenerationPlaceholder(page: FunnelPage): boolean {
  const sections = page.sections ?? [];
  if (sections.length === 0) return true;
  if (sections.length !== 1) return false;
  const section = sections[0];
  return (
    section.type === "hero" &&
    (!section.headline?.trim() || section.headline === "Nouvelle section") &&
    !section.eyebrow?.trim() && !section.subheadline?.trim() &&
    !section.body?.trim() && !section.bullets?.length &&
    !section.items?.length && !section.cta && !section.secondaryCta &&
    !section.ctas?.length
  );
}

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

type Props = {
  funnel: Funnel;
  page: FunnelPage;
  /**
   * Remplace toutes les sections de la page (médias déjà reportés).
   * `role` est fourni quand l'utilisateur a choisi un type de page : il doit
   * être posé sur la page, sinon les conventions ne s'appliqueront pas à la
   * prochaine régénération.
   */
  onApply: (sections: FunnelSection[], role?: PageRole) => void;
};

export function PageRegenPanel(props: Props) {
  // Un brouillon/proposal et un rôle appartiennent à UNE page : ne jamais
  // reporter ceux de la page précédente lorsqu'on sélectionne « + Page ».
  return <PageRegenForm key={props.page.id} {...props} />;
}

function PageRegenForm({ funnel, page, onApply }: Props) {
  const isNewPage = isPageGenerationPlaceholder(page);
  const [open, setOpen] = useState(isNewPage);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<FunnelSection[] | null>(null);
  const [role, setRole] = useState<PageRole>(page.role ?? "custom");

  /**
   * 🆕 GARDE ABSOLUE — Page CLONÉE.
   *
   * ── CE QUI EST ARRIVÉ ─────────────────────────────────────────────────────
   * Ce panneau remplace TOUTES les sections de la page par des sections
   * générées (hero, benefits, cta…). Sur une page clonée, dont l'unique
   * section est un `raw-html` contenant le site capturé, cela SUPPRIME le
   * clone : le design, la mise en page et les médias disparaissent d'un coup,
   * remplacés par un gabarit standard portant le nouveau copy.
   *
   * L'utilisateur ne demandait qu'une réécriture du texte. Il a perdu la seule
   * chose pour laquelle il avait cloné la page.
   *
   * ── POURQUOI UN REFUS, PAS UN AVERTISSEMENT ──────────────────────────────
   * Il n'existe aucune façon correcte d'exécuter cette action sur un clone :
   * le générateur ne sait produire que des sections structurées, et un clone
   * n'en a pas. Un simple avertissement laisserait la porte ouverte à la même
   * perte. La réécriture du copy d'un clone a son propre outil, qui applique
   * un patch de texte par-dessus le HTML capturé sans jamais le modifier
   * (`CloneCopyRewritePanel`, dans l'éditeur de la section).
   */
  const hasClonedSection = (page.sections ?? []).some(isClonedSection);

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
    // Ceinture : l'interface n'expose plus le bouton sur un clone, mais cette
    // fonction ne doit pas pouvoir s'exécuter par un autre chemin.
    if (hasClonedSection) return;
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
        setError(json?.message || json?.error || "Génération impossible.");
        return;
      }
      if (!Array.isArray(json.sections) || json.sections.length === 0) {
        setError("Génération IA indisponible pour le moment (page inchangée).");
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
    // Dernière barrière avant l'écriture : appliquer des sections générées sur
    // une page clonée détruirait le HTML capturé.
    if (hasClonedSection) return;
    // Le rôle part avec les sections : sans lui, la page resterait "custom" et
    // la régénération suivante retomberait dans le même défaut.
    onApply(carryMedia(proposal), role);
    setProposal(null);
    setPrompt("");
    setOpen(false);
  }

  // 🆕 PAGE CLONÉE — le panneau ne propose plus l'action, il oriente vers le
  // bon outil. Régénérer ici remplacerait la section clonée par un gabarit
  // standard : le design capturé, la mise en page et les médias seraient
  // perdus, ce qui est exactement l'inverse de ce qu'on attend d'un clone.
  if (hasClonedSection) {
    return (
      // ⚠️ `text-amber-100` serait invisible sur fond clair : ce panneau vit
      // dans la colonne de l'éditeur, qui suit le thème de l'application.
      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">Page clonée : design protégé.</strong>{" "}
            La régénération de page reconstruit des sections standard et
            effacerait le design capturé. Pour réécrire le texte sans toucher à
            la mise en page, aux couleurs ni aux médias, ouvre la section
            ci-dessous et utilise{" "}
            <strong className="font-semibold">
              « Réécrire tout le copy avec l&apos;IA »
            </strong>
            .
          </span>
        </p>
      </div>
    );
  }

  return (
    // 🆕 THÈME : `text-violet-200` sur `bg-violet-300/[0.05]` était pensé pour
    // un fond sombre. En mode CLAIR, ce panneau devenait un rectangle presque
    // blanc au libellé illisible — visible sur la colonne gauche de l'éditeur.
    // `text-ink` bascule ; l'icône garde la couleur de marque, lisible sur les
    // deux fonds.
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.08]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-ink"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        {isNewPage ? "Générer cette nouvelle page avec l’IA" : "Régénérer toute la page avec l’IA"}
        <span className="ml-auto text-[10px] font-normal text-muted">
          {open ? "Réduire" : "Ouvrir"}
        </span>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-violet-300/15 p-3">
          <p className="text-[11px] leading-relaxed text-muted">
            {isNewPage ? (
              <>Crée les sections et les textes de cette nouvelle page (« {page.name} »).
                Choisis son type et décris son objectif. Les autres pages du tunnel
                restent intactes ; les médias déjà ajoutés sont conservés.</>
            ) : (
              <>Régénère le copy de <b className="text-ink">toutes les sections</b> de
                cette page (« {page.name} »). Le reste du tunnel n&apos;est pas touché, et
                les images/vidéos sont conservées.</>
            )}
          </p>

          {/* 🆕 Type de page — décide des conventions appliquées. */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
              Type de page
            </p>
            <div className="flex flex-wrap gap-1">
              {PAGE_ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={role === opt.id}
                  onClick={() => { setRole(opt.id); setProposal(null); }}
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    role === opt.id
                      ? "bg-violet-500/20 text-ink ring-1 ring-violet-500/50"
                      : "border border-line text-muted hover:text-ink",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Détermine les sections autorisées. Une page de remerciement reste
              sobre : ni témoignages, ni argumentaire de vente.
            </p>
          </div>

          {/* 🆕 Contexte repris de la page d'accueil, y compris clonée. */}
          {homeContext?.headline && (
            <p className="rounded border border-line bg-canvas px-2 py-1.5 text-[10px] leading-relaxed text-muted">
              Contexte repris de l&apos;accueil :{" "}
              <span className="text-ink">
                « {homeContext.headline.slice(0, 90)}
                {homeContext.headline.length > 90 ? "…" : ""} »
              </span>
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {(isNewPage ? GENERATION_SUGGESTIONS : SUGGESTIONS).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-violet-500/50 hover:text-ink"
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
            aria-label={isNewPage ? "Objectif de la nouvelle page" : "Instruction de régénération"}
            placeholder={isNewPage
              ? "Ex. : présente mon accompagnement après le téléchargement du guide, avec ses bénéfices et un bouton pour prendre rendez-vous."
              : "Instruction facultative (ex. « ton plus direct »). Laisse vide pour une simple régénération."}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-violet-500/50"
          />

          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Génération…" : isNewPage ? "Générer la nouvelle page" : "Régénérer la page"}
          </button>

          {error && <p className="text-xs text-red-300">{error}</p>}

          {proposal && (
            <div className="grid gap-2 rounded-lg border border-line bg-zinc-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Aperçu — {proposal.length} section(s) {isNewPage ? "générée(s)" : "régénérée(s)"}
              </p>
              <ul className="grid gap-1">
                {proposal.map((s, i) => (
                  <li key={i} className="text-xs text-emerald-200">
                    <span className="text-muted">{s.type} — </span>
                    {s.headline || <span className="text-muted">(sans titre)</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white/5"
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
