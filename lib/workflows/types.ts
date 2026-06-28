// lib/workflows/types.ts
// 🆕 Moteur d'automatisation interne V1 (FunnelFlow AI).
//
// Modèle : un workflow = 1 trigger + N actions ordonnées, stockés dans les
// tables EXISTANTES `workflows` (en-tête) et `workflow_steps` (étapes).
//   - workflow_steps.type   = "trigger" | "action"
//   - workflow_steps.config = JSON typé (cf. ci-dessous)
//   - workflow_steps.position = ordre (0 = trigger, puis actions 1..n)
//
// Aucune nouvelle table : on réutilise aussi `scheduled_emails` (file d'envoi du
// cron) pour les emails différés, exactement comme les séquences CRM.

export type WorkflowStatus = "draft" | "active" | "paused";

/** Événements déclencheurs V1.
 *  - lead.created    : un lead capturé via /api/leads (défaut).
 *  - tag.added       : un tag assigné à un contact (action explicite CRM).
 *  - status.changed  : le statut CRM d'un lead change. */
export type WorkflowTriggerEvent = "lead.created" | "tag.added" | "status.changed";

export const WORKFLOW_TRIGGER_EVENTS: readonly WorkflowTriggerEvent[] = [
  "lead.created",
  "tag.added",
  "status.changed",
] as const;

/** Types d'étape stockés dans workflow_steps.type. */
export type WorkflowStepType = "trigger" | "action";

/** Actions disponibles en V1 (workflow_steps.config.kind). */
export type WorkflowActionKind =
  | "add_tag"
  | "set_status"
  | "enroll_in_sequence"
  | "notify_owner"
  | "wait";

/** Statuts CRM valides d'un lead (cf. contrainte SQL leads.status). */
export type LeadStatus = "nouveau" | "contacte" | "qualifie" | "client" | "perdu";

export const LEAD_STATUSES: readonly LeadStatus[] = [
  "nouveau",
  "contacte",
  "qualifie",
  "client",
  "perdu",
] as const;

export const WORKFLOW_ACTION_KINDS: readonly WorkflowActionKind[] = [
  "add_tag",
  "set_status",
  "enroll_in_sequence",
  "notify_owner",
  "wait",
] as const;

// ─── Configs typées ──────────────────────────────────────────────────────────

export type WorkflowTriggerConfig = {
  event: WorkflowTriggerEvent;
  /** lead.created : null/absent = TOUS les funnels du propriétaire. */
  funnelId?: string | null;
  /** tag.added : null/absent = n'importe quel tag. */
  tagId?: string | null;
  /** status.changed : null/absent = n'importe quel statut cible. */
  status?: LeadStatus | null;
};

export type WorkflowActionConfig =
  | { kind: "add_tag"; tags: string[] }
  | { kind: "set_status"; status: LeadStatus }
  | { kind: "enroll_in_sequence"; sequenceId: string }
  | { kind: "notify_owner"; subject?: string; message?: string }
  | { kind: "wait"; days: number };

// ─── Lignes brutes (telles que lues en base) ────────────────────────────────

export type WorkflowStepRow = {
  id: string;
  workflow_id: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
  created_at?: string;
};

export type WorkflowRow = {
  id: string;
  user_id: string;
  name: string;
  status: WorkflowStatus;
  created_at?: string;
  updated_at?: string;
};

export type WorkflowWithSteps = WorkflowRow & { steps: WorkflowStepRow[] };

// ─── Vue applicative (parsée/normalisée) ────────────────────────────────────

export type WorkflowAction = {
  id?: string;
  position: number;
  config: WorkflowActionConfig;
};

export type Workflow = {
  id: string;
  userId: string;
  name: string;
  status: WorkflowStatus;
  trigger: WorkflowTriggerConfig;
  actions: WorkflowAction[];
};

/** Forme acceptée en entrée des routes d'écriture (create/update). */
export type WorkflowInput = {
  name: string;
  status: WorkflowStatus;
  trigger: WorkflowTriggerConfig;
  actions: WorkflowActionConfig[];
};
