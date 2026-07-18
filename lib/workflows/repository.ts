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
  WorkflowConditionTest,
  WorkflowInput,
  WorkflowRow,
  WorkflowStatus,
  WorkflowStepRow,
  WorkflowTriggerConfig,
  WorkflowTriggerEvent,
} from "./types";
import { LEAD_STATUSES, WORKFLOW_TRIGGER_EVENTS } from "./types";

const WORKFLOW_COLS = "id, user_id, name, status, created_at, updated_at";
const STEP_COLS = "id, workflow_id, type, position, config, created_at";

// ─── Parsing défensif des config jsonb ──────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function isTriggerEvent(v: unknown): v is WorkflowTriggerEvent {
  return (
    typeof v === "string" &&
    (WORKFLOW_TRIGGER_EVENTS as readonly string[]).includes(v)
  );
}

function parseTriggerConfig(config: Record<string, unknown>): WorkflowTriggerConfig {
  const event: WorkflowTriggerEvent = isTriggerEvent(config.event)
    ? config.event
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
  // 🆕 LOT 2
  const pageSlug =
    typeof config.pageSlug === "string" && config.pageSlug.trim()
      ? (config.pageSlug as string)
      : null;
  const linkLabel =
    typeof config.linkLabel === "string" && config.linkLabel.trim()
      ? (config.linkLabel as string)
      : null;
  const afterEvent = isTriggerEvent(config.afterEvent) ? config.afterEvent : null;
  const delayDaysNum = Number(config.delayDays);
  const delayDays = Number.isFinite(delayDaysNum) && delayDaysNum > 0 ? Math.min(Math.round(delayDaysNum), 365) : 0;
  const delayHoursNum = Number(config.delayHours);
  const delayHours = Number.isFinite(delayHoursNum) && delayHoursNum > 0 ? Math.min(Math.round(delayHoursNum), 23) : 0;
  return { event, funnelId, tagId, status, pageSlug, linkLabel, afterEvent, delayDays, delayHours };
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
      // 🆕 Jours ET/OU heures ET/OU minutes (rétro-compat : anciens { days }).
      const num = (v: unknown, max: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : 0;
      };
      const days = num(config.days, 365);
      const hours = num(config.hours, 23);
      const minutes = num(config.minutes, 59);
      if (days + hours + minutes <= 0) return null;
      return {
        kind: "wait",
        ...(days ? { days } : {}),
        ...(hours ? { hours } : {}),
        ...(minutes ? { minutes } : {}),
      };
    }
    // 🆕 VAGUE 1 / LOT 5 — Email direct au contact.
    case "send_email": {
      const subject = typeof config.subject === "string" ? config.subject.trim() : "";
      const content = typeof config.content === "string" ? config.content.trim() : "";
      if (!subject || !content) return null;
      return { kind: "send_email", subject, content };
    }
    // 🆕 VAGUE 1 / LOT 5 — Condition si/alors : branches parsées récursivement
    // (une action de branche invalide est simplement ignorée, comme au niveau
    // racine — jamais bloquant).
    case "condition": {
      const test = parseConditionTest(config.test);
      if (!test) return null;
      const parseBranch = (raw: unknown): WorkflowActionConfig[] => {
        if (!Array.isArray(raw)) return [];
        const out: WorkflowActionConfig[] = [];
        for (const item of raw) {
          const parsed = parseActionConfig(asRecord(item));
          if (parsed) out.push(parsed);
        }
        return out;
      };
      return {
        kind: "condition",
        test,
        ...(config.negate === true ? { negate: true } : {}),
        then: parseBranch(config.then),
        otherwise: parseBranch(config.otherwise),
      };
    }
    default:
      return null;
  }
}

/** 🆕 VAGUE 1 / LOT 5 — Parse défensif d'un test de condition stocké en base. */
function parseConditionTest(raw: unknown): WorkflowConditionTest | null {
  const t = asRecord(raw);
  switch (t.type) {
    case "has_tag":
      return typeof t.tagId === "string" && t.tagId.trim()
        ? { type: "has_tag", tagId: t.tagId.trim() }
        : null;
    case "status_is":
      return typeof t.status === "string" &&
        (LEAD_STATUSES as readonly string[]).includes(t.status)
        ? { type: "status_is", status: t.status as LeadStatus }
        : null;
    case "language_is":
      return t.language === "fr" || t.language === "en" || t.language === "es"
        ? { type: "language_is", language: t.language }
        : null;
    case "source_is":
      return typeof t.source === "string" && t.source.trim()
        ? { type: "source_is", source: t.source.trim() }
        : null;
    case "country_is":
      return typeof t.country === "string" && t.country.trim().length === 2
        ? { type: "country_is", country: t.country.trim().toUpperCase() }
        : null;
    // 🆕 sequenceId / urlContains : sans ce parsing, ces filtres seraient
    // silencieusement retirés à l'enregistrement (même piège que
    // briefSchema — voir autofunnel-zod-brief-schema-gap) : le champ existe
    // dans le type et l'UI, mais jamais reconstruit depuis la base. Cas
    // séparés (plutôt qu'un fallthrough commun) pour que chaque objet retourné
    // corresponde exactement au membre d'union attendu.
    case "has_opened_email": {
      const n = Number(t.sinceDays);
      const sequenceId =
        typeof t.sequenceId === "string" && t.sequenceId.trim()
          ? t.sequenceId.trim()
          : undefined;
      // 🆕 sequenceEmailId : même piège que sequenceId — sans ce parsing, un
      // ciblage "cet email précis" enregistré redeviendrait silencieusement
      // "n'importe quel email de la séquence" au rechargement.
      const sequenceEmailId =
        typeof t.sequenceEmailId === "string" && t.sequenceEmailId.trim()
          ? t.sequenceEmailId.trim()
          : undefined;
      return {
        type: "has_opened_email",
        ...(Number.isFinite(n) && n > 0
          ? { sinceDays: Math.min(365, Math.round(n)) }
          : {}),
        ...(sequenceId ? { sequenceId } : {}),
        ...(sequenceEmailId ? { sequenceEmailId } : {}),
      };
    }
    case "has_clicked_email": {
      const n = Number(t.sinceDays);
      const sequenceId =
        typeof t.sequenceId === "string" && t.sequenceId.trim()
          ? t.sequenceId.trim()
          : undefined;
      const sequenceEmailId =
        typeof t.sequenceEmailId === "string" && t.sequenceEmailId.trim()
          ? t.sequenceEmailId.trim()
          : undefined;
      const urlContains =
        typeof t.urlContains === "string" && t.urlContains.trim()
          ? t.urlContains.trim().slice(0, 500)
          : undefined;
      return {
        type: "has_clicked_email",
        ...(Number.isFinite(n) && n > 0
          ? { sinceDays: Math.min(365, Math.round(n)) }
          : {}),
        ...(sequenceId ? { sequenceId } : {}),
        ...(sequenceEmailId ? { sequenceEmailId } : {}),
        ...(urlContains ? { urlContains } : {}),
      };
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

/** 🆕 LOT 2 — Workflows ACTIFS dont le déclencheur est `time.elapsed` ET dont
 *  l'événement de référence (`afterEvent`) correspond à celui qui vient de se
 *  produire. Utilisé par le moteur pour PLANIFIER (au lieu d'exécuter tout de
 *  suite) leurs actions dans `workflow_pending_runs`. */
export async function getActiveWorkflowsWaitingOnEvent(
  admin: SupabaseClient,
  userId: string,
  afterEvent: WorkflowTriggerEvent,
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
    .filter((w) => w.trigger.event === "time.elapsed" && w.trigger.afterEvent === afterEvent);
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
      // 🆕 LOT 2
      pageSlug: input.trigger.pageSlug ?? null,
      linkLabel: input.trigger.linkLabel ?? null,
      afterEvent: input.trigger.afterEvent ?? null,
      delayDays: input.trigger.delayDays ?? 0,
      delayHours: input.trigger.delayHours ?? 0,
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
