"use client";

import { useState } from "react";
import {
  Bell,
  Clock,
  Send,
  Plus,
  Tag,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type {
  LeadStatus,
  Workflow,
  WorkflowActionConfig,
  WorkflowActionKind,
  WorkflowStatus,
  WorkflowTriggerEvent,
} from "@/lib/workflows/types";

type FunnelOption = { id: string; name: string };
type SequenceOption = { id: string; name: string };
type TagOption = { id: string; name: string };

type Props = {
  initialWorkflows: Workflow[];
  funnels: FunnelOption[];
  sequences: SequenceOption[];
  tags: TagOption[];
};

type Draft = {
  name: string;
  status: WorkflowStatus;
  triggerEvent: WorkflowTriggerEvent;
  funnelId: string | null;
  tagId: string | null;
  triggerStatus: LeadStatus | null;
  actions: WorkflowActionConfig[];
};

const TRIGGER_LABELS: Record<WorkflowTriggerEvent, string> = {
  "lead.created": "Nouveau lead capturé",
  "tag.added": "Tag ajouté à un contact",
  "status.changed": "Statut CRM modifié",
};

const TRIGGER_EVENTS: WorkflowTriggerEvent[] = [
  "lead.created",
  "tag.added",
  "status.changed",
];

const ACTION_META: Record<
  WorkflowActionKind,
  { label: string; icon: typeof Tag }
> = {
  add_tag: { label: "Ajouter un tag", icon: Tag },
  set_status: { label: "Changer le statut CRM", icon: UserCheck },
  enroll_in_sequence: { label: "Inscrire dans une séquence", icon: Send },
  notify_owner: { label: "Me notifier", icon: Bell },
  wait: { label: "Attendre", icon: Clock },
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  client: "Client",
  perdu: "Perdu",
};

const WF_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  paused: "En pause",
};

function emptyDraft(): Draft {
  return {
    name: "",
    status: "draft",
    triggerEvent: "lead.created",
    funnelId: null,
    tagId: null,
    triggerStatus: null,
    actions: [],
  };
}

function defaultActionConfig(kind: WorkflowActionKind): WorkflowActionConfig {
  switch (kind) {
    case "add_tag":
      return { kind, tags: [] };
    case "set_status":
      return { kind, status: "qualifie" };
    case "enroll_in_sequence":
      return { kind, sequenceId: "" };
    case "notify_owner":
      return { kind, subject: "", message: "" };
    case "wait":
      return { kind, days: 1 };
  }
}

export function WorkflowsClient({ initialWorkflows, funnels, sequences, tags }: Props) {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setDraft(emptyDraft());
    setEditingId("new");
    setError(null);
  };

  const openEdit = (wf: Workflow) => {
    setDraft({
      name: wf.name,
      status: wf.status,
      triggerEvent: wf.trigger.event,
      funnelId: wf.trigger.funnelId ?? null,
      tagId: wf.trigger.tagId ?? null,
      triggerStatus: wf.trigger.status ?? null,
      actions: wf.actions.map((a) => a.config),
    });
    setEditingId(wf.id);
    setError(null);
  };

  const closeEditor = () => {
    setEditingId(null);
    setError(null);
  };

  async function refresh() {
    const res = await fetch("/api/workflows");
    const json = await res.json();
    if (json.ok) setWorkflows(json.workflows as Workflow[]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      name: draft.name,
      status: draft.status,
      trigger: {
        event: draft.triggerEvent,
        // On n'envoie que le filtre pertinent pour l'événement choisi.
        funnelId: draft.triggerEvent === "lead.created" ? draft.funnelId : null,
        tagId: draft.triggerEvent === "tag.added" ? draft.tagId : null,
        status: draft.triggerEvent === "status.changed" ? draft.triggerStatus : null,
      },
      actions: draft.actions,
    };
    const url = editingId === "new" ? "/api/workflows" : `/api/workflows/${editingId}`;
    const method = editingId === "new" ? "POST" : "PUT";
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(
          json.error === "validation"
            ? "Vérifiez les champs : un nom et au moins une action valide sont requis."
            : "Échec de l'enregistrement. Réessayez.",
        );
        return;
      }
      await refresh();
      closeEditor();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce workflow ?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    await refresh();
  }

  // ─── Manipulation des actions du brouillon ───
  const addAction = (kind: WorkflowActionKind) =>
    setDraft((d) => ({ ...d, actions: [...d.actions, defaultActionConfig(kind)] }));

  const updateAction = (i: number, next: WorkflowActionConfig) =>
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, idx) => (idx === i ? next : a)),
    }));

  const removeAction = (i: number) =>
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, idx) => idx !== i) }));

  const moveAction = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.actions.length) return d;
      const next = [...d.actions];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, actions: next };
    });

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-ink">Workflows</h1>
          <p className="mt-2 text-sm text-muted">
            Automatisez ce qui se passe quand un lead est capturé : tags, statut,
            emails, relances et notifications.
          </p>
        </div>
        {editingId === null && (
          <Button onClick={openNew}>
            <Plus size={16} /> Créer un workflow
          </Button>
        )}
      </div>

      {editingId === null ? (
        <WorkflowList
          workflows={workflows}
          funnels={funnels}
          tags={tags}
          onEdit={openEdit}
          onDelete={remove}
          onNew={openNew}
        />
      ) : (
        <WorkflowEditor
          draft={draft}
          setDraft={setDraft}
          funnels={funnels}
          sequences={sequences}
          tags={tags}
          saving={saving}
          error={error}
          isNew={editingId === "new"}
          onAddAction={addAction}
          onUpdateAction={updateAction}
          onRemoveAction={removeAction}
          onMoveAction={moveAction}
          onCancel={closeEditor}
          onSave={save}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Liste
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowList({
  workflows,
  funnels,
  tags,
  onEdit,
  onDelete,
  onNew,
}: {
  workflows: Workflow[];
  funnels: FunnelOption[];
  tags: TagOption[];
  onEdit: (wf: Workflow) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  if (workflows.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-line bg-surface p-10 text-center">
        <Zap className="mx-auto text-gold" size={28} />
        <p className="mt-3 font-bold text-ink">Aucun workflow pour l’instant</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Créez votre première automatisation : par exemple « Nouveau lead →
          ajouter un tag → attendre 2 jours → email de relance ».
        </p>
        <div className="mt-4">
          <Button onClick={onNew}>
            <Plus size={16} /> Créer un workflow
          </Button>
        </div>
      </div>
    );
  }

  const funnelName = (id: string | null | undefined) =>
    id ? funnels.find((f) => f.id === id)?.name ?? "Tunnel supprimé" : "Tous les tunnels";
  const tagName = (id: string | null | undefined) =>
    id ? tags.find((t) => t.id === id)?.name ?? "Tag supprimé" : "tout tag";

  const triggerSummary = (wf: Workflow): string => {
    const label = TRIGGER_LABELS[wf.trigger.event];
    if (wf.trigger.event === "tag.added") return `${label} · ${tagName(wf.trigger.tagId)}`;
    if (wf.trigger.event === "status.changed")
      return `${label} · ${wf.trigger.status ? STATUS_LABELS[wf.trigger.status] : "tout statut"}`;
    return `${label} · ${funnelName(wf.trigger.funnelId)}`;
  };

  return (
    <div className="mt-8 grid gap-4">
      {workflows.map((wf) => (
        <div
          key={wf.id}
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-black text-ink">{wf.name}</h3>
              <StatusBadge status={wf.status} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {triggerSummary(wf)} · {wf.actions.length} action
              {wf.actions.length > 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {wf.actions.map((a, i) => {
                const Meta = ACTION_META[a.config.kind];
                const Icon = Meta.icon;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-1 text-[11px] font-semibold text-ink"
                  >
                    <Icon size={12} /> {Meta.label}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onEdit(wf)}>
              Modifier
            </Button>
            <button
              type="button"
              onClick={() => onDelete(wf.id)}
              aria-label="Supprimer"
              className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:text-red"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: WorkflowStatus }) {
  const cls =
    status === "active"
      ? "bg-green/15 text-green"
      : status === "paused"
        ? "bg-gold/20 text-[#9a7d1f]"
        : "bg-canvas text-muted";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {WF_STATUS_LABELS[status]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Éditeur
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowEditor({
  draft,
  setDraft,
  funnels,
  sequences,
  tags,
  saving,
  error,
  isNew,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
  onMoveAction,
  onCancel,
  onSave,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  funnels: FunnelOption[];
  sequences: SequenceOption[];
  tags: TagOption[];
  saving: boolean;
  error: string | null;
  isNew: boolean;
  onAddAction: (kind: WorkflowActionKind) => void;
  onUpdateAction: (i: number, next: WorkflowActionConfig) => void;
  onRemoveAction: (i: number) => void;
  onMoveAction: (i: number, dir: -1 | 1) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const actionKinds: WorkflowActionKind[] = [
    "add_tag",
    "set_status",
    "enroll_in_sequence",
    "notify_owner",
    "wait",
  ];

  return (
    <div className="mt-8 max-w-3xl">
      <h2 className="text-xl font-black text-ink">
        {isNew ? "Nouveau workflow" : "Modifier le workflow"}
      </h2>

      {/* Réglages généraux */}
      <div className="mt-5 grid gap-4 rounded-lg border border-line bg-surface p-5">
        <label className="block">
          <span className="text-xs font-bold uppercase text-muted">Nom</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Ex. Bienvenue nouveau lead"
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">Statut</span>
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft((d) => ({ ...d, status: e.target.value as WorkflowStatus }))
              }
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            >
              <option value="draft">Brouillon (inactif)</option>
              <option value="active">Actif</option>
              <option value="paused">En pause</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">Déclencheur</span>
            <select
              value={draft.triggerEvent}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  triggerEvent: e.target.value as WorkflowTriggerEvent,
                }))
              }
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            >
              {TRIGGER_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {TRIGGER_LABELS[ev]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Filtre conditionnel selon l'événement choisi */}
        {draft.triggerEvent === "lead.created" && (
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">
              S’applique au tunnel
            </span>
            <select
              value={draft.funnelId ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, funnelId: e.target.value || null }))
              }
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            >
              <option value="">Tous les tunnels</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {draft.triggerEvent === "tag.added" && (
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">
              Tag déclencheur
            </span>
            <select
              value={draft.tagId ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tagId: e.target.value || null }))
              }
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            >
              <option value="">N’importe quel tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {tags.length === 0 && (
              <span className="mt-1 block text-[11px] text-muted">
                Aucun tag pour l’instant — se déclenchera sur n’importe quel tag.
              </span>
            )}
          </label>
        )}

        {draft.triggerEvent === "status.changed" && (
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">
              Statut déclencheur
            </span>
            <select
              value={draft.triggerStatus ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  triggerStatus: (e.target.value || null) as LeadStatus | null,
                }))
              }
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            >
              <option value="">N’importe quel statut</option>
              {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          <Zap size={14} className="text-gold" />{" "}
          {draft.triggerEvent === "tag.added"
            ? `Déclencheur : un tag${draft.tagId ? " précis" : ""} est ajouté à un contact.`
            : draft.triggerEvent === "status.changed"
              ? `Déclencheur : le statut CRM d’un lead ${draft.triggerStatus ? "passe à la valeur choisie" : "change"}.`
              : `Déclencheur : un nouveau lead est capturé sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5">
        <h3 className="text-sm font-black text-ink">Actions (dans l’ordre)</h3>
        <div className="mt-3 grid gap-3">
          {draft.actions.map((action, i) => (
            <ActionRow
              key={i}
              index={i}
              total={draft.actions.length}
              action={action}
              sequences={sequences}
              onChange={(next) => onUpdateAction(i, next)}
              onRemove={() => onRemoveAction(i)}
              onMove={(dir) => onMoveAction(i, dir)}
            />
          ))}
          {draft.actions.length === 0 && (
            <p className="rounded-lg border border-dashed border-line bg-surface px-3 py-4 text-center text-sm text-muted">
              Ajoutez au moins une action ci-dessous.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {actionKinds.map((kind) => {
            const Meta = ACTION_META[kind];
            const Icon = Meta.icon;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onAddAction(kind)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-ink hover:border-navy/40 hover:bg-canvas"
              >
                <Plus size={13} /> <Icon size={13} /> {Meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne d'action (config selon le type)
// ─────────────────────────────────────────────────────────────────────────────

function ActionRow({
  index,
  total,
  action,
  sequences,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  action: WorkflowActionConfig;
  sequences: SequenceOption[];
  onChange: (next: WorkflowActionConfig) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const Meta = ACTION_META[action.kind];
  const Icon = Meta.icon;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-canvas text-xs text-navy">
            {index + 1}
          </span>
          <Icon size={15} /> {Meta.label}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted disabled:opacity-30"
            aria-label="Monter"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted disabled:opacity-30"
            aria-label="Descendre"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:text-red"
            aria-label="Retirer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        {action.kind === "add_tag" && (
          <input
            value={action.tags.join(", ")}
            onChange={(e) =>
              onChange({
                kind: "add_tag",
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Tags séparés par des virgules — ex. lead, ebook"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          />
        )}

        {action.kind === "set_status" && (
          <select
            value={action.status}
            onChange={(e) =>
              onChange({ kind: "set_status", status: e.target.value as LeadStatus })
            }
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          >
            {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}

        {action.kind === "enroll_in_sequence" &&
          (sequences.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-canvas px-3 py-2 text-xs text-muted">
              Aucune séquence pour l’instant. Créez-en une dans l’onglet{" "}
              <strong>Emails</strong>, puis revenez l’ajouter ici.
            </p>
          ) : (
            <select
              value={action.sequenceId}
              onChange={(e) =>
                onChange({ kind: "enroll_in_sequence", sequenceId: e.target.value })
              }
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            >
              <option value="">— Choisir une séquence —</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ))}

        {action.kind === "notify_owner" && (
          <div className="grid gap-2">
            <input
              value={action.subject ?? ""}
              onChange={(e) =>
                onChange({ kind: "notify_owner", subject: e.target.value, message: action.message })
              }
              placeholder="Objet (optionnel) — défaut : « Nouveau lead »"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
            <textarea
              value={action.message ?? ""}
              onChange={(e) =>
                onChange({ kind: "notify_owner", subject: action.subject, message: e.target.value })
              }
              rows={2}
              placeholder="Message (optionnel) — les infos du lead sont ajoutées automatiquement."
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
          </div>
        )}

        {action.kind === "wait" && (
          <label className="flex items-center gap-2 text-sm text-ink">
            Attendre
            <input
              type="number"
              min={1}
              max={365}
              value={action.days}
              onChange={(e) =>
                onChange({ kind: "wait", days: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-20 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
            jour(s) avant l’action suivante.
          </label>
        )}
      </div>
    </div>
  );
}
