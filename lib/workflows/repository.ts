// lib/workflows/repository.ts
// 🆕 Accès données du moteur de workflows. Logique pure (supabase + userId),
// réutilisable par les routes API (client serveur, RLS) ET par l'engine (client
// admin, hors session, depuis /api/leads).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LeadStatus,
  Workflow,
  WorkflowAction,
  WorkflowActionConfig,
  WorkflowInput,
  WorkflowRow,
  WorkflowStatus,
  WorkflowStepRow,
  WorkflowTriggerConfig,
  WorkflowTriggerEvent,
} from "./types";
import { LEAD_STATUSES } from "./types";

const WORKFLOW_COLS = "id, user_id, name, status, created_at, updated_at";
const STEP_COLS = "id, workflow_id, type, position, config, created_at";

// ─── Parsing défensif des config jsonb ──────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function parseTriggerConfig(config: Record<string, unknown>): WorkflowTriggerConfig {
  const rawEvent = config.event;
  const event: WorkflowTriggerEvent =
    rawEvent === "tag.added" || rawEvent === "status.changed"
      ? rawEvent
      : "lead.created";
  const funnelId =
    typeof config.funnelId === "string" && config.funnelId.trim()
      ? (config.funnelId as string)
      : null;
  const tagId =
    typeof config.tagId === "string" && config.tagId.trim()
      ? (config.tagId as string)
      : null;
  const status =
    typeof config.status === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(config.status)
      ? (config.status as LeadStatus)
      : null;
  return { event, funnelId, tagId, status };
}

function parseActionConfig(config: Record<string, unknown>): WorkflowActionConfig | null {
  const kind = config.kind;
  switch (kind) {
    case "add_tag": {
      const tags = Array.isArray(config.tags)
        ? (config.tags as unknown[])
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim())
        : [];
      if (tags.length === 0) return null;
      return { kind: "add_tag", tags };
    }
    case "set_status": {
      const status = config.status;
      if (typeof status === "string" && (LEAD_STATUSES as readonly string[]).includes(status)) {
        return { kind: "set_status", status: status as LeadStatus };
      }
      return null;
    }
    case "enroll_in_sequence": {
      const sequenceId =
        typeof config.sequenceId === "string" ? config.sequenceId.trim() : "";
      if (!sequenceId) return null;
      return { kind: "enroll_in_sequence", sequenceId };
    }
    case "notify_owner": {
      return {
        kind: "notify_owner",
        subject: typeof config.subject === "string" ? config.subject : undefined,
        message: typeof config.message === "string" ? config.message : undefined,
      };
    }
    case "wait": {
      const days = Number(config.days);
      if (!Number.isFinite(days) || days <= 0) return null;
      return { kind: "wait", days: Math.min(Math.round(days), 365) };
    }
    default:
      return null;
  }
}

/** Reconstruit un Workflow applicatif depuis l'en-tête + ses étapes brutes. */
export function parseWorkflow(row: WorkflowRow, steps: WorkflowStepRow[]): Workflow {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const triggerStep = ordered.find((s) => s.type === "trigger");
  const trigger = parseTriggerConfig(asRecord(triggerStep?.config));

  const actions: WorkflowAction[] = [];
  for (const step of ordered) {
    if (step.type !== "action") continue;
    const parsed = parseActionConfig(asRecord(step.config));
    if (parsed) actions.push({ id: step.id, position: step.position, config: parsed });
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status,
    trigger,
    actions,
  };
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

async function loadSteps(
  sb: SupabaseClient,
  workflowIds: string[],
): Promise<Map<string, WorkflowStepRow[]>> {
  const byWorkflow = new Map<string, WorkflowStepRow[]>();
  if (workflowIds.length === 0) return byWorkflow;
  const { data, error } = await sb
    .from("workflow_steps")
    .select(STEP_COLS)
    .in("workflow_id", workflowIds)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  for (const step of (data ?? []) as WorkflowStepRow[]) {
    const list = byWorkflow.get(step.workflow_id) ?? [];
    list.push(step);
    byWorkflow.set(step.workflow_id, list);
  }
  return byWorkflow;
}

export async function listWorkflows(
  sb: SupabaseClient,
  userId: string,
): Promise<Workflow[]> {
  const { data, error } = await sb
    .from("workflows")
    .select(WORKFLOW_COLS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WorkflowRow[];
  const steps = await loadSteps(sb, rows.map((r) => r.id));
  return rows.map((r) => parseWorkflow(r, steps.get(r.id) ?? []));
}

export async function getWorkflow(
  sb: SupabaseClient,
  id: string,
): Promise<Workflow | null> {
  const { data, error } = await sb
    .from("workflows")
    .select(WORKFLOW_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const steps = await loadSteps(sb, [id]);
  return parseWorkflow(data as WorkflowRow, steps.get(id) ?? []);
}

/** Workflows ACTIFS déclenchés par un ÉVÉNEMENT donné (chargés via client admin). */
export async function getActiveWorkflowsForEvent(
  admin: SupabaseClient,
  userId: string,
  event: WorkflowTriggerEvent,
): Promise<Workflow[]> {
  const { data, error } = await admin
    .from("workflows")
    .select(WORKFLOW_COLS)
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WorkflowRow[];
  const steps = await loadSteps(admin, rows.map((r) => r.id));
  return rows
    .map((r) => parseWorkflow(r, steps.get(r.id) ?? []))
    .filter((w) => w.trigger.event === event);
}

// ─── Écriture (create / update / delete) ────────────────────────────────────

function buildStepRows(
  workflowId: string,
  input: WorkflowInput,
): Array<{ workflow_id: string; type: string; position: number; config: Record<string, unknown> }> {
  const rows: Array<{
    workflow_id: string;
    type: string;
    position: number;
    config: Record<string, unknown>;
  }> = [];
  // Position 0 : trigger. On persiste l'événement + uniquement le filtre
  // pertinent pour cet événement (les autres restent null → « n'importe lequel »).
  rows.push({
    workflow_id: workflowId,
    type: "trigger",
    position: 0,
    config: {
      event: input.trigger.event ?? "lead.created",
      funnelId: input.trigger.funnelId ?? null,
      tagId: input.trigger.tagId ?? null,
      status: input.trigger.status ?? null,
    },
  });
  // Positions 1..n : actions (on ignore les actions invalides).
  let pos = 1;
  for (const action of input.actions) {
    const valid = parseActionConfig({ ...action });
    if (!valid) continue;
    rows.push({
      workflow_id: workflowId,
      type: "action",
      position: pos,
      config: valid as unknown as Record<string, unknown>,
    });
    pos += 1;
  }
  return rows;
}

async function replaceSteps(
  sb: SupabaseClient,
  workflowId: string,
  input: WorkflowInput,
): Promise<void> {
  const { error: delErr } = await sb
    .from("workflow_steps")
    .delete()
    .eq("workflow_id", workflowId);
  if (delErr) throw new Error(delErr.message);

  const rows = buildStepRows(workflowId, input);
  const { error: insErr } = await sb.from("workflow_steps").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export async function createWorkflow(
  sb: SupabaseClient,
  userId: string,
  input: WorkflowInput,
): Promise<Workflow> {
  const status: WorkflowStatus = input.status ?? "draft";
  const { data, error } = await sb
    .from("workflows")
    .insert({ user_id: userId, name: input.name.trim() || "Workflow", status })
    .select(WORKFLOW_COLS)
    .single();
  if (error) throw new Error(error.message);
  const row = data as WorkflowRow;
  await replaceSteps(sb, row.id, input);
  const result = await getWorkflow(sb, row.id);
  if (!result) throw new Error("workflow_create_failed");
  return result;
}

export async function updateWorkflow(
  sb: SupabaseClient,
  id: string,
  input: WorkflowInput,
): Promise<Workflow | null> {
  const { error } = await sb
    .from("workflows")
    .update({
      name: input.name.trim() || "Workflow",
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await replaceSteps(sb, id, input);
  return getWorkflow(sb, id);
}

export async function deleteWorkflow(sb: SupabaseClient, id: string): Promise<void> {
  // workflow_steps supprimés en cascade (FK on delete cascade).
  const { error } = await sb.from("workflows").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
