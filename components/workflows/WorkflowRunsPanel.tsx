"use client";

// components/workflows/WorkflowRunsPanel.tsx
// 🆕 Historique d'exécution d'un workflow.
//
// La question à laquelle cet écran doit répondre n'est pas « combien
// d'exécutions ? » mais « POURQUOI ce contact n'a-t-il pas reçu ce que
// j'attendais ? ». D'où le parti pris : la BRANCHE empruntée par chaque
// condition est mise en avant, parce que c'est presque toujours là que se
// trouve la réponse.

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

type RunStep = {
  position: number;
  kind: string;
  status: "done" | "failed" | "deferred" | "skipped";
  at: string;
  detail?: string;
};

type Run = {
  id: string;
  lead_id: string | null;
  lead_email: string | null;
  trigger_event: string;
  status: "running" | "done" | "failed" | "skipped_duplicate";
  steps: RunStep[];
  actions_total: number;
  actions_done: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

type Summary = { total: number; done: number; failed: number; running: number };

const STEP_ICON: Record<RunStep["status"], React.ReactNode> = {
  done: <CheckCircle2 size={13} className="text-success-ink" />,
  failed: <XCircle size={13} className="text-danger-ink" />,
  deferred: <Clock size={13} className="text-warning-ink" />,
  skipped: <ChevronRight size={13} className="text-muted" />,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const steps = Array.isArray(run.steps) ? run.steps : [];

  const badge =
    run.status === "done"
      ? { text: "Terminé", cls: "bg-success-soft text-success-ink" }
      : run.status === "failed"
        ? { text: "Échec", cls: "bg-danger-soft text-danger-ink" }
        : run.status === "running"
          ? { text: "En cours", cls: "bg-info-soft text-info-ink" }
          : { text: "Doublon ignoré", cls: "bg-canvas text-muted" };

  return (
    <div className="rounded-lg border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-muted" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-muted" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          {run.lead_email || "Contact inconnu"}
        </span>
        <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
          {run.trigger_event}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
        >
          {badge.text}
        </span>
        <span className="hidden shrink-0 text-[11px] text-muted md:inline">
          {formatDate(run.started_at)}
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-3 py-3">
          {run.error && (
            <div className="mb-2 flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-2 text-[11px] text-danger-ink">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{run.error}</span>
            </div>
          )}

          {steps.length === 0 ? (
            <p className="text-[11px] text-muted">
              Aucune étape enregistrée. Si cette exécution a été reprise après une
              attente, sa suite est journalisée séparément.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={`${s.position}-${i}`} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{STEP_ICON[s.status]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs text-ink">{s.detail || s.kind}</span>
                    <span className="ml-2 text-[10px] text-muted">
                      {new Date(s.at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkflowRunsPanel({
  workflowId,
  workflowName,
}: {
  workflowId: string;
  workflowName?: string;
}) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs?limit=50`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || json.error || `Erreur ${res.status}`);
        if (json.hint) setHint(json.hint);
        setRuns(null);
        return;
      }
      setRuns(json.runs as Run[]);
      setSummary(json.summary as Summary);
    } catch {
      setError("Connexion impossible.");
      setRuns(null);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">
            Historique d&apos;exécution
          </h3>
          {workflowName && <p className="text-[11px] text-muted">{workflowName}</p>}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-canvas disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Rafraîchir
        </button>
      </div>

      {summary && (
        <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted">
          <span>{summary.total} exécution{summary.total > 1 ? "s" : ""}</span>
          <span className="text-success-ink">{summary.done} terminée(s)</span>
          {summary.failed > 0 && (
            <span className="text-danger-ink">{summary.failed} en échec</span>
          )}
          {summary.running > 0 && <span>{summary.running} en cours</span>}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-danger bg-danger-soft p-3 text-xs text-danger-ink">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p>{error}</p>
              {hint && <p className="mt-1 opacity-80">{hint}</p>}
            </div>
          </div>
        </div>
      )}

      {loading && !runs && (
        <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-muted">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Chargement…
        </div>
      )}

      {runs && runs.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-canvas p-6 text-center text-sm text-muted">
          Aucune exécution pour le moment. L&apos;historique se remplira au
          prochain déclenchement de ce workflow.
        </div>
      )}

      {runs && runs.length > 0 && (
        <div className="space-y-1.5">
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkflowRunsPanel;
