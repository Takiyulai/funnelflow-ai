"use client";

import { useState } from "react";
import { handlePlanGate } from "@/lib/billing/planGate";
import {
  Bell,
  Clock,
  GitBranch,
  Mail,
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
  WorkflowConditionTest,
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
  // 🆕 LOT 2
  pageSlug: string;
  linkLabel: string;
  afterEvent: WorkflowTriggerEvent;
  delayDays: number;
  delayHours: number;
  actions: WorkflowActionConfig[];
};

const TRIGGER_LABELS: Record<WorkflowTriggerEvent, string> = {
  "lead.created": "Nouveau lead capturé",
  "tag.added": "Tag ajouté à un contact",
  "status.changed": "Statut CRM modifié",
  "purchase.completed": "Achat / paiement réussi",
  "webinar.registered": "Inscription à un webinaire",
  "webinar.attended": "Présence au webinaire",
  "webinar.absent": "Absence au webinaire",
  "application.submitted": "Candidature soumise",
  "appointment.booked": "RDV réservé",
  "time.elapsed": "Délai écoulé après un autre événement",
  "email.link_clicked": "Lien cliqué dans un email",
  "page.visited": "Page visitée",
};

// 🆕 VAGUE 1 / LOT 5 — `webinar.attended` et `webinar.absent` sont MASQUÉS du
// sélecteur tant qu'aucun événement ne les émet (la détection de présence au
// webinaire n'existe pas encore). Les workflows existants qui les utilisent
// restent affichés/éditables (labels conservés ci-dessus). À réintroduire ici
// le jour où la présence live est trackée.
const TRIGGER_EVENTS: WorkflowTriggerEvent[] = [
  "lead.created",
  "tag.added",
  "status.changed",
  "purchase.completed",
  "webinar.registered",
  "application.submitted",
  "appointment.booked",
  "email.link_clicked",
  "page.visited",
  "time.elapsed",
];

// 🆕 LOT 2 — Événements utilisables comme référence pour `time.elapsed`
// (tous SAUF time.elapsed lui-même, qui ne peut pas se référencer).
const TIME_ELAPSED_BASE_EVENTS: WorkflowTriggerEvent[] = TRIGGER_EVENTS.filter(
  (e) => e !== "time.elapsed",
);

// Événements dont le filtre principal est "s'applique à ce tunnel".
const FUNNEL_FILTER_EVENTS: WorkflowTriggerEvent[] = [
  "lead.created",
  "purchase.completed",
  "webinar.registered",
  "webinar.attended",
  "webinar.absent",
  "application.submitted",
  "appointment.booked",
  "page.visited",
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
  // 🆕 VAGUE 1 / LOT 5
  send_email: { label: "Envoyer un email", icon: Mail },
  condition: { label: "Condition (si / alors)", icon: GitBranch },
};

// 🆕 LOT 5 — Libellés des tests de condition.
const CONDITION_TYPE_LABELS: Record<WorkflowConditionTest["type"], string> = {
  has_tag: "Le contact a le tag…",
  status_is: "Le statut CRM est…",
  language_is: "La langue du contact est…",
  source_is: "La source du contact est…",
  country_is: "Le pays (téléphone) est…",
  has_opened_email: "A ouvert au moins un email",
  has_clicked_email: "A cliqué au moins un lien d'email",
};

// Dans les branches d'une condition, on propose toutes les actions SAUF une
// nouvelle condition (l'imbrication est supportée côté moteur/API, mais on
// garde l'interface simple et lisible pour les débutants).
const BRANCH_ACTION_KINDS: WorkflowActionKind[] = [
  "add_tag",
  "set_status",
  "enroll_in_sequence",
  "send_email",
  "notify_owner",
  "wait",
];

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
    pageSlug: "",
    linkLabel: "",
    afterEvent: "lead.created",
    delayDays: 1,
    delayHours: 0,
    actions: [],
  };
}

// 🆕 LOT 2 — Description humaine du déclencheur choisi, réutilisée à la fois
// dans le bandeau de réglages et dans le nœud "Déclencheur" de la timeline.
function describeTrigger(draft: Draft): string {
  switch (draft.triggerEvent) {
    case "tag.added":
      return `Un tag${draft.tagId ? " précis" : ""} est ajouté à un contact.`;
    case "status.changed":
      return `Le statut CRM d’un lead ${draft.triggerStatus ? "passe à la valeur choisie" : "change"}.`;
    case "page.visited":
      return `Un contact identifié visite ${draft.pageSlug.trim() ? `la page « ${draft.pageSlug.trim()} »` : "une page"} sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "email.link_clicked":
      return `Un contact clique sur ${draft.linkLabel.trim() ? "ce lien précis" : "un lien"} dans un email envoyé.`;
    case "time.elapsed": {
      const delay = [draft.delayDays ? `${draft.delayDays}j` : null, draft.delayHours ? `${draft.delayHours}h` : null]
        .filter(Boolean)
        .join(" ") || "0h";
      return `${delay} après « ${TRIGGER_LABELS[draft.afterEvent]} ».`;
    }
    case "purchase.completed":
      return `Un paiement est confirmé sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "webinar.registered":
      return `Un contact s’inscrit à un webinaire sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "webinar.attended":
      return `Un contact assiste au webinaire sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "webinar.absent":
      return `Un contact ne s’est pas présenté au webinaire sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "application.submitted":
      return `Une candidature est soumise sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "appointment.booked":
      return `Un RDV est réservé sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
    case "lead.created":
    default:
      return `Un nouveau lead est capturé sur ${draft.funnelId ? "ce tunnel" : "vos tunnels"}.`;
  }
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
    // 🆕 VAGUE 1 / LOT 5
    case "send_email":
      return { kind, subject: "", content: "" };
    case "condition":
      return {
        kind,
        test: { type: "has_opened_email" },
        then: [],
        otherwise: [],
      };
  }
}

// 🆕 LOT 5 — Config par défaut d'un test quand on change son type.
function defaultConditionTest(
  type: WorkflowConditionTest["type"],
): WorkflowConditionTest {
  switch (type) {
    case "has_tag":
      return { type, tagId: "" };
    case "status_is":
      return { type, status: "client" };
    case "language_is":
      return { type, language: "fr" };
    case "source_is":
      return { type, source: "funnel_form" };
    case "country_is":
      return { type, country: "" };
    case "has_opened_email":
    case "has_clicked_email":
      return { type };
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
      pageSlug: wf.trigger.pageSlug ?? "",
      linkLabel: wf.trigger.linkLabel ?? "",
      afterEvent: wf.trigger.afterEvent ?? "lead.created",
      delayDays: wf.trigger.delayDays ?? 1,
      delayHours: wf.trigger.delayHours ?? 0,
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
        funnelId: FUNNEL_FILTER_EVENTS.includes(draft.triggerEvent) ? draft.funnelId : null,
        tagId: draft.triggerEvent === "tag.added" ? draft.tagId : null,
        status: draft.triggerEvent === "status.changed" ? draft.triggerStatus : null,
        pageSlug: draft.triggerEvent === "page.visited" ? draft.pageSlug.trim() || null : null,
        linkLabel:
          draft.triggerEvent === "email.link_clicked" ? draft.linkLabel.trim() || null : null,
        afterEvent: draft.triggerEvent === "time.elapsed" ? draft.afterEvent : null,
        delayDays: draft.triggerEvent === "time.elapsed" ? draft.delayDays : undefined,
        delayHours: draft.triggerEvent === "time.elapsed" ? draft.delayHours : undefined,
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
      // 🆕 Invite d'abonnement uniforme (workflows non inclus dans le forfait).
      if (handlePlanGate(res.status, json, (m) => setError(`${m.title}. ${m.description}`))) return;
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
    if (wf.trigger.event === "page.visited")
      return `${label} · ${wf.trigger.pageSlug || "toute page"} · ${funnelName(wf.trigger.funnelId)}`;
    if (wf.trigger.event === "email.link_clicked")
      return `${label} · ${wf.trigger.linkLabel || "tout lien"}`;
    if (wf.trigger.event === "time.elapsed") {
      const d = wf.trigger.delayDays ?? 0;
      const h = wf.trigger.delayHours ?? 0;
      const delay = [d ? `${d}j` : null, h ? `${h}h` : null].filter(Boolean).join(" ") || "0h";
      const ref = wf.trigger.afterEvent ? TRIGGER_LABELS[wf.trigger.afterEvent] : "un événement";
      return `${label} · ${delay} après « ${ref} »`;
    }
    if (FUNNEL_FILTER_EVENTS.includes(wf.trigger.event))
      return `${label} · ${funnelName(wf.trigger.funnelId)}`;
    return label;
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
    "send_email",
    "notify_owner",
    "wait",
    "condition",
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
        {FUNNEL_FILTER_EVENTS.includes(draft.triggerEvent) && (
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

        {draft.triggerEvent === "page.visited" && (
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">Page précise (optionnel)</span>
            <input
              value={draft.pageSlug}
              onChange={(e) => setDraft((d) => ({ ...d, pageSlug: e.target.value }))}
              placeholder="Ex. tarifs — laisser vide pour n’importe quelle page"
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
        )}

        {draft.triggerEvent === "email.link_clicked" && (
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted">Lien précis (optionnel)</span>
            <input
              value={draft.linkLabel}
              onChange={(e) => setDraft((d) => ({ ...d, linkLabel: e.target.value }))}
              placeholder="URL exacte du lien — laisser vide pour n’importe quel lien"
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
        )}

        {draft.triggerEvent === "time.elapsed" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Après l’événement</span>
              <select
                value={draft.afterEvent}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, afterEvent: e.target.value as WorkflowTriggerEvent }))
                }
                className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
              >
                {TIME_ELAPSED_BASE_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {TRIGGER_LABELS[ev]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Délai</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={draft.delayDays}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      delayDays: Math.min(365, Math.max(0, Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-20 rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus-ring"
                  aria-label="Jours"
                />
                j
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.delayHours}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      delayHours: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-20 rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus-ring"
                  aria-label="Heures"
                />
                h
              </div>
              {draft.delayDays + draft.delayHours <= 0 && (
                <p className="mt-1 text-xs text-red-500">Le délai doit être d’au moins 1 heure.</p>
              )}
            </label>
          </div>
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
          <Zap size={14} className="text-gold" /> Déclencheur : {describeTrigger(draft)}
        </div>
      </div>

      {/* Flux d'automatisation — timeline à nœuds reliés */}
      <div className="mt-6">
        <h3 className="text-sm font-black text-ink">Flux d’automatisation</h3>
        <p className="mt-1 text-xs text-muted">
          Le déclencheur lance la suite. Les actions s’exécutent de haut en bas.
        </p>

        <div className="mt-4">
          {/* Nœud déclencheur (configuré dans les réglages ci-dessus) */}
          <TimelineNode
            tone="gold"
            badge={<Zap size={15} />}
            title="Déclencheur"
            subtitle={describeTrigger(draft)}
            hasNext
          />

          {/* Nœuds actions */}
          {draft.actions.map((action, i) => {
            const Meta = ACTION_META[action.kind];
            const Icon = Meta.icon;
            return (
              <TimelineNode
                key={i}
                tone="navy"
                badge={<span className="text-xs font-bold">{i + 1}</span>}
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size={14} /> {Meta.label}
                  </span>
                }
                hasNext
                onMoveUp={i > 0 ? () => onMoveAction(i, -1) : undefined}
                onMoveDown={
                  i < draft.actions.length - 1 ? () => onMoveAction(i, 1) : undefined
                }
                onRemove={() => onRemoveAction(i)}
              >
                <ActionConfigFields
                  action={action}
                  sequences={sequences}
                  tags={tags}
                  onChange={(next) => onUpdateAction(i, next)}
                />
              </TimelineNode>
            );
          })}

          {draft.actions.length === 0 && (
            <div className="mb-4 ml-[3.25rem] rounded-lg border border-dashed border-line bg-surface px-3 py-3 text-center text-xs text-muted">
              Aucune action — ajoutez la première étape ci-dessous.
            </div>
          )}

          {/* Nœud d'ajout d'action */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-line text-muted">
                <Plus size={16} />
              </div>
            </div>
            <div className="flex-1 pb-1">
              <p className="mb-2 text-xs font-bold text-muted">Ajouter une action</p>
              <div className="flex flex-wrap gap-2">
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
          </div>
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
// Nœud de timeline (rail + connecteur + carte)
// ─────────────────────────────────────────────────────────────────────────────

function TimelineNode({
  tone,
  badge,
  title,
  subtitle,
  hasNext,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: {
  tone: "gold" | "navy";
  badge: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  hasNext?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;
}) {
  const badgeCls = tone === "gold" ? "bg-gold text-[#08111F]" : "bg-navy text-white";
  return (
    <div className="flex gap-4">
      {/* Rail : pastille + ligne de connexion vers le nœud suivant */}
      <div className="flex flex-col items-center">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-sm ${badgeCls}`}
        >
          {badge}
        </div>
        {hasNext && <div className="w-px flex-1 bg-line" style={{ minHeight: 16 }} />}
      </div>

      {/* Carte du nœud */}
      <div className={`flex-1 ${hasNext ? "pb-5" : "pb-2"}`}>
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">{title}</div>
              {subtitle && (
                <div className="mt-0.5 text-[11px] text-muted">{subtitle}</div>
              )}
            </div>
            {onRemove && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={!onMoveUp}
                  className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:text-ink disabled:opacity-30"
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={!onMoveDown}
                  className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:text-ink disabled:opacity-30"
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
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Champs de configuration d'une action (selon le type)
// ─────────────────────────────────────────────────────────────────────────────

function ActionConfigFields({
  action,
  sequences,
  tags,
  onChange,
}: {
  action: WorkflowActionConfig;
  sequences: SequenceOption[];
  tags: TagOption[];
  onChange: (next: WorkflowActionConfig) => void;
}) {
  return (
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
          <div className="text-sm text-ink">
            {/* 🆕 Attente en jours + heures + minutes */}
            <div className="flex flex-wrap items-center gap-2">
              Attendre
              <input
                type="number"
                min={0}
                max={365}
                value={action.days ?? 0}
                onChange={(e) =>
                  onChange({
                    ...action,
                    days: Math.min(365, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-16 rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus-ring"
                aria-label="Jours"
              />
              j
              <input
                type="number"
                min={0}
                max={23}
                value={action.hours ?? 0}
                onChange={(e) =>
                  onChange({
                    ...action,
                    hours: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-16 rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus-ring"
                aria-label="Heures"
              />
              h
              <input
                type="number"
                min={0}
                max={59}
                value={action.minutes ?? 0}
                onChange={(e) =>
                  onChange({
                    ...action,
                    minutes: Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-16 rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus-ring"
                aria-label="Minutes"
              />
              min avant l'action suivante.
            </div>
            {(action.days ?? 0) + (action.hours ?? 0) + (action.minutes ?? 0) <= 0 && (
              <p className="mt-1 text-xs text-red-500">
                L'attente doit être d'au moins 1 minute.
              </p>
            )}
          </div>
        )}

        {/* 🆕 VAGUE 1 / LOT 5 — Email direct au contact */}
        {action.kind === "send_email" && (
          <div className="grid gap-2">
            <input
              value={action.subject}
              onChange={(e) =>
                onChange({ ...action, subject: e.target.value })
              }
              placeholder="Objet — ex. Bienvenue {{prenom}} !"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
            <textarea
              value={action.content}
              onChange={(e) =>
                onChange({ ...action, content: e.target.value })
              }
              rows={4}
              placeholder={"Contenu de l'email…\nVariables : {{prenom}}, {{email}}"}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
            />
            <p className="text-[11px] text-muted">
              Envoyé au contact (mise en forme automatique, même gabarit que les
              séquences). Respecte les « Attendre » placés avant.
            </p>
          </div>
        )}

        {/* 🆕 VAGUE 1 / LOT 5 — Condition si/alors */}
        {action.kind === "condition" && (
          <ConditionFields
            action={action}
            sequences={sequences}
            tags={tags}
            onChange={onChange}
          />
        )}
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 VAGUE 1 / LOT 5 — Éditeur de condition si/alors.
// Test purement logique (aucun appel IA), deux branches d'actions simples.
// ─────────────────────────────────────────────────────────────────────────────

type ConditionAction = Extract<WorkflowActionConfig, { kind: "condition" }>;

function ConditionFields({
  action,
  sequences,
  tags,
  onChange,
}: {
  action: ConditionAction;
  sequences: SequenceOption[];
  tags: TagOption[];
  onChange: (next: WorkflowActionConfig) => void;
}) {
  const test = action.test;

  const setTest = (next: WorkflowConditionTest) =>
    onChange({ ...action, test: next });

  const setBranch = (branch: "then" | "otherwise", actions: WorkflowActionConfig[]) =>
    onChange({ ...action, [branch]: actions });

  return (
    <div className="grid gap-3">
      {/* Choix du test */}
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={test.type}
          onChange={(e) =>
            setTest(defaultConditionTest(e.target.value as WorkflowConditionTest["type"]))
          }
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
        >
          {(Object.keys(CONDITION_TYPE_LABELS) as WorkflowConditionTest["type"][]).map(
            (t) => (
              <option key={t} value={t}>
                {CONDITION_TYPE_LABELS[t]}
              </option>
            ),
          )}
        </select>

        {/* Paramètre du test selon son type */}
        {test.type === "has_tag" && (
          <select
            value={test.tagId}
            onChange={(e) => setTest({ type: "has_tag", tagId: e.target.value })}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          >
            <option value="">— Choisir un tag —</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {test.type === "status_is" && (
          <select
            value={test.status}
            onChange={(e) =>
              setTest({ type: "status_is", status: e.target.value as LeadStatus })
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
        {test.type === "language_is" && (
          <select
            value={test.language}
            onChange={(e) =>
              setTest({
                type: "language_is",
                language: e.target.value as "fr" | "en" | "es",
              })
            }
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          >
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
          </select>
        )}
        {test.type === "source_is" && (
          <input
            value={test.source}
            onChange={(e) => setTest({ type: "source_is", source: e.target.value })}
            placeholder='Ex. "funnel_form"'
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          />
        )}
        {test.type === "country_is" && (
          <input
            value={test.country}
            onChange={(e) =>
              setTest({ type: "country_is", country: e.target.value.toUpperCase() })
            }
            placeholder="Code pays à 2 lettres — ex. CI, FR, CM"
            maxLength={2}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
          />
        )}
        {(test.type === "has_opened_email" || test.type === "has_clicked_email") && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <span className="text-xs text-muted">Sur les</span>
            <input
              type="number"
              min={0}
              max={365}
              value={test.sinceDays ?? 0}
              onChange={(e) => {
                const n = Math.min(365, Math.max(0, Number(e.target.value) || 0));
                setTest({ type: test.type, sinceDays: n > 0 ? n : undefined });
              }}
              className="w-20 rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus-ring"
              aria-label="Jours"
            />
            <span className="text-xs text-muted">derniers jours (0 = toujours)</span>
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={Boolean(action.negate)}
          onChange={(e) => onChange({ ...action, negate: e.target.checked })}
          className="h-3.5 w-3.5"
        />
        Inverser la condition (« SI ce n&apos;est PAS le cas »)
      </label>

      <p className="rounded-lg bg-canvas px-3 py-2 text-[11px] text-muted">
        La condition est évaluée au moment où le workflow s&apos;exécute, sur les
        données réelles du contact — instantané, sans IA. Les emails des branches
        respectent les « Attendre » placés avant la condition.
      </p>

      {/* Branches */}
      <ConditionBranch
        label="SI OUI"
        tone="green"
        actions={action.then}
        sequences={sequences}
        tags={tags}
        onChange={(a) => setBranch("then", a)}
      />
      <ConditionBranch
        label="SINON"
        tone="red"
        actions={action.otherwise}
        sequences={sequences}
        tags={tags}
        onChange={(a) => setBranch("otherwise", a)}
      />
    </div>
  );
}

function ConditionBranch({
  label,
  tone,
  actions,
  sequences,
  tags,
  onChange,
}: {
  label: string;
  tone: "green" | "red";
  actions: WorkflowActionConfig[];
  sequences: SequenceOption[];
  tags: TagOption[];
  onChange: (actions: WorkflowActionConfig[]) => void;
}) {
  const toneCls =
    tone === "green"
      ? "border-green/40 bg-green/5 text-green"
      : "border-red/40 bg-red/5 text-red";

  return (
    <div className="rounded-lg border border-line bg-canvas/60 p-3">
      <span
        className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${toneCls}`}
      >
        {label}
      </span>

      {actions.length === 0 && (
        <p className="mt-2 text-[11px] text-muted">
          Aucune action dans cette branche (rien ne se passera).
        </p>
      )}

      <div className="mt-2 grid gap-2">
        {actions.map((a, i) => {
          const Meta = ACTION_META[a.kind];
          const Icon = Meta.icon;
          return (
            <div key={i} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Icon size={13} /> {Meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(actions.filter((_, j) => j !== i))}
                  className="grid h-6 w-6 place-items-center rounded-md border border-line text-muted hover:text-red"
                  aria-label="Retirer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <ActionConfigFields
                action={a}
                sequences={sequences}
                tags={tags}
                onChange={(next) => onChange(actions.map((x, j) => (j === i ? next : x)))}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {BRANCH_ACTION_KINDS.map((kind) => {
          const Meta = ACTION_META[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onChange([...actions, defaultActionConfig(kind)])}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-bold text-ink hover:border-navy/40"
            >
              <Plus size={11} /> {Meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
