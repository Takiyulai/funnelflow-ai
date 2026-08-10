"use client";

// components/funnel/AbTestsPanel.tsx
//
// 🆕 MODULE 3 — Pilotage des tests A/B d'un tunnel.
//
// PARTI PRIS. La variante B démarre comme une copie de la page, et on ne peut
// y modifier que des TEXTES : sur-titre, titre, sous-titre, libellé de bouton.
// Ce n'est pas une limitation subie, c'est le cas d'usage réel — sur un tunnel
// on teste une accroche ou un bouton, pas une refonte. Cela évite aussi
// d'apprendre la notion de variante à l'éditeur, déjà le fichier le plus lourd
// du projet.
//
// LE GARDE-FOU QUI COMPTE. Le panneau compte les champs qui diffèrent de la
// variante A et alerte au-delà d'un seul. Un test où trois choses changent
// dit « B gagne » sans dire POURQUOI : on ne peut rien réutiliser sur le
// tunnel suivant. C'est l'erreur la plus fréquente en A/B testing, et elle est
// invisible tant que personne ne la signale.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlaskConical,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Trophy,
  Trash2,
  TriangleAlert,
  Eye,
} from "lucide-react";
import type { FunnelPage, FunnelSection } from "@/lib/funnels/types";
import { readResult, MIN_VIEWS_PER_VARIANT } from "@/lib/ab/assign";

type Counts = { views: number; conversions: number };

type AbTest = {
  id: string;
  funnel_id: string;
  page_id: string;
  name: string;
  status: "running" | "paused" | "finished";
  traffic_split: number;
  variant_b: FunnelSection[];
  winner: "a" | "b" | null;
  started_at: string;
  ended_at: string | null;
  stats: { a: Counts; b: Counts };
};

type EditableField = "eyebrow" | "headline" | "subheadline" | "ctaLabel";

const FIELD_LABEL: Record<EditableField, string> = {
  eyebrow: "Sur-titre",
  headline: "Titre",
  subheadline: "Sous-titre",
  ctaLabel: "Bouton",
};

function readField(section: FunnelSection, field: EditableField): string {
  if (field === "ctaLabel") return section.cta?.label ?? "";
  return (section[field] as string | undefined) ?? "";
}

function writeField(
  section: FunnelSection,
  field: EditableField,
  value: string,
): FunnelSection {
  if (field === "ctaLabel") {
    // Pas de CTA sur cette section : on n'en invente pas un, sinon la variante
    // B afficherait un bouton absent de A — ce ne serait plus le même test.
    if (!section.cta) return section;
    return { ...section, cta: { ...section.cta, label: value } };
  }
  return { ...section, [field]: value };
}

/** Champs qui diffèrent entre A et B, tous sections confondues. */
function countDifferences(a: FunnelSection[], b: FunnelSection[]): number {
  let n = 0;
  for (const sectionB of b) {
    const sectionA = a.find((s) => s.id === sectionB.id);
    if (!sectionA) continue;
    for (const f of ["eyebrow", "headline", "subheadline", "ctaLabel"] as EditableField[]) {
      if (readField(sectionA, f) !== readField(sectionB, f)) n++;
    }
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────

function VariantColumn({
  label,
  counts,
  highlight,
}: {
  label: string;
  counts: Counts;
  highlight: boolean;
}) {
  const rate = counts.views ? (counts.conversions / counts.views) * 100 : 0;
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-success bg-success-soft" : "border-line bg-canvas"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{rate.toFixed(1)} %</p>
      <p className="text-[11px] text-muted">
        {counts.conversions} conversion{counts.conversions > 1 ? "s" : ""} ·{" "}
        {counts.views} visiteur{counts.views > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function FieldRow({
  section,
  field,
  originalValue,
  value,
  onChange,
  offerName,
  disabled,
}: {
  section: FunnelSection;
  field: EditableField;
  originalValue: string;
  value: string;
  onChange: (next: string) => void;
  offerName?: string;
  disabled: boolean;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const changed = value !== originalValue;

  async function suggest() {
    setSuggesting(true);
    setNote(null);
    try {
      const res = await fetch("/api/ab-tests/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, current: originalValue, offerName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(json.message || "Suggestion indisponible.");
        return;
      }
      setSuggestions(json.suggestions ?? []);
      if (json.unavailable) setNote(json.message ?? "Assistance IA indisponible.");
    } catch {
      setNote("Réseau indisponible.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="border-t border-line py-2.5 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {FIELD_LABEL[field]}
          {changed && <span className="ml-1.5 text-accent-ink">modifié</span>}
        </span>
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting || disabled}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:border-accent hover:text-ink disabled:opacity-40"
        >
          {suggesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          Suggérer
        </button>
      </div>

      <p className="mt-1 truncate text-[11px] text-muted" title={originalValue}>
        A : {originalValue || <em>vide</em>}
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={field === "headline" || field === "subheadline" ? 2 : 1}
        className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
      />

      {note && <p className="mt-1 text-[11px] text-warning-ink">{note}</p>}

      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(s)}
              className="rounded-md border border-accent bg-accent-soft px-2 py-1 text-left text-[11px] text-ink transition hover:opacity-80"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {section.cta === undefined && field === "ctaLabel" && (
        <p className="mt-1 text-[11px] text-muted">Cette section n&apos;a pas de bouton.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AbTestsPanel({
  funnelId,
  pages,
  offerName,
  initialPageId,
  publicSlug,
}: {
  funnelId: string;
  pages: FunnelPage[];
  offerName?: string;
  /** Page présélectionnée, transmise par le bouton « Tester » de l'éditeur. */
  initialPageId?: string;
  /** Slug public du tunnel, pour les liens d'aperçu de variante. */
  publicSlug?: string | null;
}) {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creatingFor, setCreatingFor] = useState<string>(initialPageId ?? "");
  const [newName, setNewName] = useState("");
  const [split, setSplit] = useState(50);
  const rootRef = useRef<HTMLDivElement>(null);

  // Brouillon d'édition de la variante B, par test.
  const [drafts, setDrafts] = useState<Record<string, FunnelSection[]>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/funnels/${funnelId}/ab-tests`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (json.ok) setTests(json.tests as AbTest[]);
    } finally {
      setLoading(false);
    }
  }, [funnelId]);

  useEffect(() => {
    load();
  }, [load]);

  // Arrivée depuis le bouton « Tester » de l'éditeur : le panneau est en bas
  // d'une page de statistiques qui peut être longue. Sans ce défilement,
  // l'utilisateur atterrit en haut et croit que le lien n'a rien fait.
  useEffect(() => {
    if (!initialPageId || loading) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialPageId, loading]);

  const pageById = useMemo(() => {
    const m = new Map<string, FunnelPage>();
    for (const p of pages) m.set(p.id, p);
    return m;
  }, [pages]);

  async function createTest() {
    const page = pageById.get(creatingFor);
    if (!page) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/ab-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          name: newName.trim() || `Test sur « ${page.name} »`,
          // B démarre comme une copie exacte : l'utilisateur modifie ensuite ce
          // qu'il veut tester, et une variante jamais éditée reste inoffensive.
          variantB: page.sections,
          trafficSplit: split,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Création impossible.");
        return;
      }
      setCreatingFor("");
      setNewName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchTest(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ab-tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Modification impossible.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function applyWinner(id: string, winner: "a" | "b") {
    // 🆕 GARDE-FOU. Ce bouton CLÔTURE le test et, pour B, écrase les sections
    // de la page. Il était déclenché au premier clic, sans confirmation, alors
    // que « Supprimer » en avait une — et il voisinait des liens d'aperçu
    // portant le MÊME libellé (« Variante A » / « Variante B »). Un utilisateur
    // qui voulait prévisualiser a cloturé son test par erreur, sans retour
    // possible. La confirmation nomme l'effet réel avant d'agir.
    const label = winner.toUpperCase();
    const consequence =
      winner === "b"
        ? "Les textes de la variante B remplaceront ceux de la page."
        : "La page garde ses textes actuels.";
    if (
      !window.confirm(
        `Retenir la variante ${label} et terminer ce test ?\n\n` +
          `${consequence}\n\n` +
          `Le test passera en « terminé » et la répartition du trafic s'arrêtera. ` +
          `Pour seulement VOIR une variante, utilise les liens d'aperçu.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ab-tests/${id}/winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner }),
      });
      if (!res.ok) {
        setError("Application du gagnant impossible.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeTest(id: string) {
    if (!window.confirm("Supprimer ce test et ses mesures ? Cette action est définitive.")) return;
    setBusy(true);
    try {
      await fetch(`/api/ab-tests/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-muted">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Chargement des tests…
      </div>
    );
  }

  const testedPageIds = new Set(
    tests.filter((t) => t.status !== "finished").map((t) => t.page_id),
  );
  const availablePages = pages.filter((p) => !testedPageIds.has(p.id));

  return (
    <div ref={rootRef} className="scroll-mt-6 rounded-xl border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <FlaskConical size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black text-ink">Tests A/B</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Deux versions d&apos;une page, le trafic réparti entre les deux, et
            le taux de conversion comparé. Change{" "}
            <strong className="text-ink">une seule chose à la fois</strong> :
            c&apos;est ce qui permet de savoir ce qui a marché.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger-ink">
          {error}
        </p>
      )}

      {/* ── Création ──────────────────────────────────────────────────── */}
      {availablePages.length > 0 && (
        <div className="mt-4 rounded-lg border border-line bg-canvas p-3">
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Page à tester
              </span>
              <select
                value={creatingFor}
                onChange={(e) => setCreatingFor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              >
                <option value="">Choisir une page…</option>
                {availablePages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Trafic vers B : {split} %
              </span>
              <input
                type="range"
                min={10}
                max={90}
                step={10}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                className="mt-2 w-full accent-[#C7A436]"
              />
            </label>
            <button
              type="button"
              onClick={createTest}
              disabled={busy || !creatingFor}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-contrast transition hover:opacity-90 disabled:opacity-40"
            >
              Lancer le test
            </button>
          </div>
        </div>
      )}

      {/* ── Tests ─────────────────────────────────────────────────────── */}
      {tests.length === 0 ? (
        <p className="mt-4 rounded-lg bg-canvas p-4 text-center text-xs text-muted">
          Aucun test pour l&apos;instant. Commence par l&apos;accroche de ta page
          d&apos;entrée : c&apos;est presque toujours ce qui bouge le plus.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {tests.map((test) => {
            const page = pageById.get(test.page_id);
            const original = page?.sections ?? [];
            const draft = drafts[test.id] ?? test.variant_b;
            const diffs = countDifferences(original, draft);
            const reading = readResult(test.stats.a, test.stats.b);
            const editable = test.status !== "finished";
            const dirty = JSON.stringify(draft) !== JSON.stringify(test.variant_b);

            return (
              <div key={test.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{test.name}</p>
                    <p className="text-[11px] text-muted">
                      {page?.name ?? "Page supprimée"} · {test.traffic_split} % du
                      trafic vers B ·{" "}
                      {test.status === "running"
                        ? "en cours"
                        : test.status === "paused"
                          ? "en pause"
                          : `terminé${test.winner ? ` — variante ${test.winner.toUpperCase()} retenue` : ""}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {test.status === "running" && (
                      <button
                        type="button"
                        onClick={() => patchTest(test.id, { status: "paused" })}
                        disabled={busy}
                        title="Mettre en pause"
                        className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:text-ink"
                      >
                        <Pause size={13} />
                      </button>
                    )}
                    {test.status === "paused" && (
                      <button
                        type="button"
                        onClick={() => patchTest(test.id, { status: "running" })}
                        disabled={busy}
                        title="Reprendre"
                        className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:text-ink"
                      >
                        <Play size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTest(test.id)}
                      disabled={busy}
                      title="Supprimer"
                      className="grid h-7 w-7 place-items-center rounded-md border border-line text-danger-ink hover:border-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Résultats */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <VariantColumn
                    label="Variante A (actuelle)"
                    counts={test.stats.a}
                    highlight={reading.conclusive && reading.leader === "a"}
                  />
                  <VariantColumn
                    label="Variante B"
                    counts={test.stats.b}
                    highlight={reading.conclusive && reading.leader === "b"}
                  />
                </div>
                <p
                  className={`mt-2 text-xs ${reading.conclusive ? "text-ink" : "text-muted"}`}
                >
                  {reading.summary}
                </p>

                {/* 🆕 Aperçu forcé de chaque variante.
                    L'affectation étant déterministe, tu tombes TOUJOURS sur la
                    même variante depuis ton navigateur : sans ces liens, tu
                    pouvais créer une variante B et n'avoir aucun moyen de la
                    voir. Ces vues ne sont pas comptées dans les résultats. */}
                {publicSlug && page && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span>Voir la page en :</span>
                    {(["a", "b"] as const).map((v) => (
                      <a
                        key={v}
                        href={`/tunnel/${publicSlug}${page.isHome ? "" : `/${page.slug.replace(/^\/+/, "")}`}?ff_ab=${v}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 font-semibold text-ink transition hover:border-accent"
                      >
                        {/* 🆕 « Voir A » et non « Variante A » : le libellé était
                            identique à celui du bouton de clôture juste en
                            dessous. Deux actions aux conséquences opposées ne
                            peuvent pas porter le même nom. */}
                        <Eye size={11} /> Voir {v.toUpperCase()}
                      </a>
                    ))}
                    <span className="opacity-70">(aperçu, non compté)</span>
                  </p>
                )}

                {/* Choix du gagnant */}
                {test.status !== "finished" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted">
                      Terminer le test en retenant :
                    </span>
                    {(["a", "b"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => applyWinner(test.id, v)}
                        disabled={busy}
                        title={`Clôture le test et retient définitivement la variante ${v.toUpperCase()}`}
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink transition hover:border-accent disabled:opacity-50"
                      >
                        <Trophy size={11} /> Variante {v.toUpperCase()}
                      </button>
                    ))}
                    {!reading.conclusive && (
                      <span className="text-[11px] text-warning-ink">
                        (moins de {MIN_VIEWS_PER_VARIANT} visiteurs par variante)
                      </span>
                    )}
                  </div>
                )}

                {/* 🆕 SORTIE DE SECOURS. Un test clôturé masquait tout choix :
                    une erreur de clic était sans retour. On peut le rouvrir en
                    pause pour re-décider. Attention : rouvrir ne défait PAS
                    l'installation d'une variante B déjà appliquée à la page —
                    il rend seulement le choix à nouveau possible. */}
                {test.status === "finished" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patchTest(test.id, { status: "paused" })}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink transition hover:border-accent disabled:opacity-50"
                    >
                      <Play size={11} /> Rouvrir le test
                    </button>
                    <span className="text-[11px] text-muted">
                      pour changer de variante retenue
                    </span>
                  </div>
                )}

                {/* Édition de la variante B */}
                {editable && page && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-accent-ink">
                      Modifier la variante B
                      {diffs > 0 && ` (${diffs} champ${diffs > 1 ? "s" : ""} modifié${diffs > 1 ? "s" : ""})`}
                    </summary>

                    {diffs > 1 && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning bg-warning-soft px-2.5 py-2 text-[11px] leading-relaxed text-warning-ink">
                        <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                        <span>
                          {diffs} champs diffèrent de la variante A. Le test dira
                          laquelle gagne, mais pas grâce à quoi — et tu ne pourras
                          pas réutiliser l&apos;enseignement ailleurs.
                        </span>
                      </p>
                    )}

                    <div className="mt-2 grid gap-3">
                      {draft.map((sectionB, idx) => {
                        const sectionA = original.find((s) => s.id === sectionB.id);
                        if (!sectionA) return null;
                        return (
                          <div key={sectionB.id} className="rounded-lg border border-line p-2.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                              {sectionB.type}
                            </p>
                            {(["eyebrow", "headline", "subheadline", "ctaLabel"] as EditableField[])
                              // Un champ n'est proposé que s'il existe VRAIMENT
                              // dans la variante B. Sans le second test, la
                              // ligne « Bouton » s'affichait pour une section
                              // sans CTA : `writeField` renvoyait alors la
                              // section inchangée et le champ paraissait gelé,
                              // sans qu'aucune erreur ne l'explique.
                              .filter((f) =>
                                f === "ctaLabel"
                                  ? !!sectionB.cta && !!sectionA.cta
                                  : readField(sectionA, f) !== "" || f === "headline",
                              )
                              .map((f) => (
                                <FieldRow
                                  key={f}
                                  section={sectionB}
                                  field={f}
                                  originalValue={readField(sectionA, f)}
                                  value={readField(sectionB, f)}
                                  offerName={offerName}
                                  disabled={busy}
                                  onChange={(next) => {
                                    setDrafts((cur) => {
                                      const list = [...(cur[test.id] ?? test.variant_b)];
                                      list[idx] = writeField(list[idx], f, next);
                                      return { ...cur, [test.id]: list };
                                    });
                                  }}
                                />
                              ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* 🆕 Signal EXPLICITE de modifications non enregistrées.
                        Sans lui, on pouvait retoucher plusieurs champs, aller
                        voir la page, et constater qu'elle n'avait pas bougé —
                        sans jamais comprendre qu'il manquait un clic. Le seul
                        indice était le libellé du bouton, bien trop discret. */}
                    {dirty && (
                      <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-warning bg-warning-soft px-2.5 py-2 text-[11px] leading-relaxed text-warning-ink">
                        <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                        <span>
                          Modifications <strong>non enregistrées</strong>. Tant
                          que tu n&apos;as pas cliqué ci-dessous, tes visiteurs
                          voient encore l&apos;ancienne variante B.
                        </span>
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => patchTest(test.id, { variantB: draft })}
                      disabled={busy || !dirty}
                      className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-contrast transition hover:opacity-90 disabled:opacity-40"
                    >
                      {dirty ? "Enregistrer la variante B" : "Aucune modification à enregistrer"}
                    </button>

                    {/* Rappel du cas « B identique à A » : le test tourne, mais
                        il ne mesure rien puisque les deux pages sont les mêmes. */}
                    {!dirty && diffs === 0 && (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        La variante B est actuellement <strong>identique</strong> à
                        la A — le test tourne mais ne mesure aucune différence.
                        Modifie un champ ci-dessus, puis enregistre.
                      </p>
                    )}
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AbTestsPanel;
