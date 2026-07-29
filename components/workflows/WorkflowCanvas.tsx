"use client";

// components/workflows/WorkflowCanvas.tsx
//
// 🆕 MODULE 4 — Vue graphique d'un workflow.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE CANVAS N'EST PAS UN ÉDITEUR PAR GLISSER-RELIER
//
// Le réflexe, en voyant « workflows visuels » dans un cahier des charges, est
// de faire un canvas où l'on relie librement les nœuds. Ce serait une erreur
// ici : le modèle de données est une LISTE ordonnée d'actions, où seule
// l'action `condition` ouvre deux sous-listes qui se rejoignent ensuite. Un
// canvas libre permettrait de dessiner des boucles, des sauts, des nœuds
// orphelins — des graphes que `lib/workflows/engine.ts` ne saurait pas
// exécuter. L'utilisateur découvrirait le problème en production, sur ses
// vrais contacts.
//
// Le canvas est donc une LECTURE fidèle de la structure, et l'édition continue
// de passer par les formulaires existants : on clique un nœud, le formulaire
// correspondant s'ouvre. On gagne la compréhension d'un coup d'œil — ce qui
// manquait vraiment — sans introduire un écart entre ce qu'on dessine et ce
// qui s'exécute.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Zap,
  Tag,
  UserCheck,
  Mail,
  Bell,
  Clock,
  CalendarClock,
  GitBranch,
  ListChecks,
  CircleDot,
  Merge,
} from "lucide-react";
import type {
  Workflow,
  WorkflowActionConfig,
  WorkflowTriggerConfig,
} from "@/lib/workflows/types";
import { describeAction } from "@/lib/workflows/runs";
import {
  buildCanvasGraph,
  type ActionPath,
  type CanvasNodeData,
} from "@/lib/workflows/canvasLayout";

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<string, string> = {
  "lead.created": "Un lead est capturé",
  "tag.added": "Un tag est ajouté",
  "status.changed": "Le statut change",
  "purchase.completed": "Un paiement est confirmé",
  "webinar.registered": "Inscription au webinaire",
  "webinar.attended": "Présence au webinaire",
  "webinar.absent": "Absence au webinaire",
  "application.submitted": "Une candidature est envoyée",
  "appointment.booked": "Un rendez-vous est réservé",
  "time.elapsed": "Après un délai",
  "time.before_event": "Avant une date fixe",
  "email.link_clicked": "Un lien d'email est cliqué",
  "page.visited": "Une page est revisitée",
};

const ACTION_LABEL: Record<WorkflowActionConfig["kind"], string> = {
  add_tag: "Ajouter un tag",
  set_status: "Changer le statut",
  enroll_in_sequence: "Inscrire à une séquence",
  notify_owner: "Me notifier",
  wait: "Attendre",
  wait_until: "Attendre jusqu'à",
  send_email: "Envoyer un email",
  condition: "Condition",
};

const ACTION_ICON: Record<WorkflowActionConfig["kind"], typeof Tag> = {
  add_tag: Tag,
  set_status: UserCheck,
  enroll_in_sequence: ListChecks,
  notify_owner: Bell,
  wait: Clock,
  wait_until: CalendarClock,
  send_email: Mail,
  condition: GitBranch,
};

function describeTrigger(t: WorkflowTriggerConfig): string {
  const parts: string[] = [];
  if (t.event === "time.elapsed" && t.afterEvent) {
    parts.push(`${t.delayDays ?? 0} j ${t.delayHours ?? 0} h après « ${TRIGGER_LABEL[t.afterEvent] ?? t.afterEvent} »`);
  }
  if (t.event === "time.before_event") {
    parts.push(`${t.delayDays ?? 0} j ${t.delayHours ?? 0} h avant l'événement`);
  }
  if (t.pageSlug) parts.push(`page ${t.pageSlug}`);
  if (t.status) parts.push(`vers « ${t.status} »`);
  if (!t.funnelId) parts.push("tous les tunnels");
  return parts.join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Nœud
// ─────────────────────────────────────────────────────────────────────────────

type FfNodeData = CanvasNodeData & {
  onSelect?: (path: ActionPath) => void;
  selectedPath?: string;
};

function FfNode({ data }: NodeProps<Node<FfNodeData>>) {
  // Les points d'ancrage sont invisibles mais nécessaires : React Flow s'en
  // sert pour raccrocher les arêtes au bon endroit du nœud.
  const handles = (
    <>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </>
  );

  if (data.kind === "trigger") {
    const detail = describeTrigger(data.trigger);
    return (
      <div className="w-[240px] rounded-xl border-2 border-accent bg-accent-soft px-3 py-2.5 shadow-card">
        {handles}
        <div className="flex items-center gap-1.5">
          <Zap size={13} className="shrink-0 text-accent-ink" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-ink">
            Déclencheur
          </span>
        </div>
        <p className="mt-1 text-sm font-bold leading-snug text-ink">
          {TRIGGER_LABEL[data.trigger.event] ?? data.trigger.event}
        </p>
        {detail && <p className="mt-0.5 text-[11px] leading-snug text-muted">{detail}</p>}
      </div>
    );
  }

  if (data.kind === "join") {
    return (
      <div className="w-[240px] rounded-full border border-dashed border-line bg-canvas px-3 py-1.5 text-center">
        {handles}
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted">
          <Merge size={11} />
          {data.label}
        </span>
      </div>
    );
  }

  if (data.kind === "end") {
    return (
      <div className="w-[240px] rounded-xl border border-line bg-canvas px-3 py-2 text-center">
        {handles}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <CircleDot size={12} />
          Fin du workflow
        </span>
      </div>
    );
  }

  const Icon = ACTION_ICON[data.action.kind] ?? Tag;
  const isCondition = data.action.kind === "condition";

  return (
    <button
      type="button"
      onClick={() => data.onSelect?.(data.path)}
      className={`w-[240px] rounded-xl border bg-surface px-3 py-2.5 text-left shadow-card transition hover:border-accent ${
        isCondition ? "border-info" : "border-line"
      }`}
    >
      {handles}
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={`shrink-0 ${isCondition ? "text-info-ink" : "text-muted"}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {ACTION_LABEL[data.action.kind] ?? data.action.kind}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-ink">
        {describeAction(data.action)}
      </p>
    </button>
  );
}

const nodeTypes = { ffNode: FfNode };

// ─────────────────────────────────────────────────────────────────────────────

export function WorkflowCanvas({
  workflow,
  onSelectAction,
  height = 520,
}: {
  workflow: Workflow;
  /** Clic sur un nœud d'action : l'appelant ouvre le formulaire correspondant. */
  onSelectAction?: (path: ActionPath) => void;
  height?: number;
}) {
  const graph = useMemo(() => buildCanvasGraph(workflow), [workflow]);

  const nodes = useMemo<Node<FfNodeData>[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { ...n.data, onSelect: onSelectAction },
        // Les nœuds ne sont pas déplaçables : leur position DIT quelque chose
        // (l'ordre d'exécution). Laisser l'utilisateur les bouger créerait un
        // dessin qui ne correspond plus à ce qui s'exécute.
        draggable: false,
        selectable: n.data.kind === "action",
      })),
    [graph, onSelectAction],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "smoothstep",
        animated: false,
        style: e.muted
          ? { stroke: "var(--ff-muted)", strokeDasharray: "4 4" }
          : { stroke: "var(--ff-line)" },
        labelStyle: { fontSize: 10, fontWeight: 700, fill: "var(--ff-muted)" },
        labelBgStyle: { fill: "var(--ff-canvas)" },
      })),
    [graph],
  );

  // `fitView` recadre au montage ; sans `nodesDraggable={false}` et
  // `nodesConnectable={false}`, React Flow laisserait croire à une édition
  // possible alors que rien ne serait enregistré.
  const onInit = useCallback(() => {}, []);

  return (
    <div
      className="rounded-xl border border-line bg-canvas"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: false }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background gap={20} size={1} color="var(--ff-line)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default WorkflowCanvas;
