// lib/workflows/types.ts
// 🆕 Moteur d'automatisation interne V1 (AutoFunnel AI).
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

/** Événements déclencheurs.
 *  - lead.created         : un lead capturé via /api/leads (défaut).
 *  - tag.added            : un tag assigné à un contact (action explicite CRM).
 *  - status.changed       : le statut CRM d'un lead change.
 *  - purchase.completed   : 🆕 LOT 2 — un paiement a été confirmé (Stripe/CinetPay).
 *  - webinar.registered   : 🆕 LOT 2 — inscription à un webinaire (branché en LOT 4).
 *  - webinar.attended     : 🆕 LOT 2 — présence confirmée au webinaire (LOT 4).
 *  - webinar.absent       : 🆕 LOT 2 — absence au webinaire (LOT 4).
 *  - application.submitted: 🆕 LOT 2 — candidature soumise (coaching VSL, LOT 8).
 *  - appointment.booked   : 🆕 LOT 2 — RDV réservé (calendrier, LOT 7).
 *  - time.elapsed         : 🆕 LOT 2 — délai écoulé après un autre événement
 *                           (voir `afterEvent`/`delayDays`/`delayHours` ci-dessous).
 *                           Ne se déclenche JAMAIS directement : le moteur
 *                           planifie son exécution dans `workflow_pending_runs`
 *                           quand `afterEvent` se produit.
 *  - email.link_clicked   : 🆕 LOT 2 — un lien a été cliqué dans un email envoyé.
 *  - page.visited         : 🆕 LOT 2 — un contact déjà identifié revisite une page. */
export type WorkflowTriggerEvent =
  | "lead.created"
  | "tag.added"
  | "status.changed"
  | "purchase.completed"
  | "webinar.registered"
  | "webinar.attended"
  | "webinar.absent"
  | "application.submitted"
  | "appointment.booked"
  | "time.elapsed"
  | "email.link_clicked"
  | "page.visited";

export const WORKFLOW_TRIGGER_EVENTS: readonly WorkflowTriggerEvent[] = [
  "lead.created",
  "tag.added",
  "status.changed",
  "purchase.completed",
  "webinar.registered",
  "webinar.attended",
  "webinar.absent",
  "application.submitted",
  "appointment.booked",
  "time.elapsed",
  "email.link_clicked",
  "page.visited",
] as const;

/** Événements sur lesquels un déclencheur `time.elapsed` peut se greffer. */
export const TIME_ELAPSED_BASE_EVENTS: readonly WorkflowTriggerEvent[] = [
  "lead.created",
  "tag.added",
  "status.changed",
  "purchase.completed",
  "webinar.registered",
  "webinar.attended",
  "webinar.absent",
  "application.submitted",
  "appointment.booked",
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
  /** null/absent = TOUS les funnels du propriétaire. Utilisé par lead.created,
   *  purchase.completed, webinar.*, application.submitted, appointment.booked,
   *  page.visited. */
  funnelId?: string | null;
  /** tag.added : null/absent = n'importe quel tag. */
  tagId?: string | null;
  /** status.changed : null/absent = n'importe quel statut cible. */
  status?: LeadStatus | null;
  /** 🆕 page.visited : slug de page précis. null/absent = n'importe quelle page du tunnel. */
  pageSlug?: string | null;
  /** 🆕 email.link_clicked : URL du lien à surveiller. null/absent = n'importe quel lien. */
  linkLabel?: string | null;
  /** 🆕 time.elapsed : événement de référence à partir duquel compter le délai. */
  afterEvent?: WorkflowTriggerEvent | null;
  /** 🆕 time.elapsed : délai en jours (cumulé avec delayHours). */
  delayDays?: number;
  /** 🆕 time.elapsed : délai en heures (cumulé avec delayDays). */
  delayHours?: number;
};

export type WorkflowActionConfig =
  | { kind: "add_tag"; tags: string[] }
  | { kind: "set_status"; status: LeadStatus }
  | { kind: "enroll_in_sequence"; sequenceId: string }
  | { kind: "notify_owner"; subject?: string; message?: string }
  /** 🆕 Attente en jours ET/OU heures ET/OU minutes (rétro-compat : les
   *  anciennes étapes n'ont que `days`). */
  | { kind: "wait"; days?: number; hours?: number; minutes?: number };

/** 🆕 Durée totale d'une étape "wait" en millisecondes (rétro-compatible). */
export function waitActionMs(a: { days?: number; hours?: number; minutes?: number }): number {
  const d = Math.max(0, Number(a.days) || 0);
  const h = Math.max(0, Number(a.hours) || 0);
  const m = Math.max(0, Number(a.minutes) || 0);
  return ((d * 24 + h) * 60 + m) * 60 * 1000;
}

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

/** 🆕 LOT 2 — Exécution différée (table workflow_pending_runs), utilisée par le
 *  déclencheur `time.elapsed` : une ligne = « exécuter les actions de ce
 *  workflow pour ce contact à cette date ». Traitée par le CRON existant. */
export type WorkflowPendingRunRow = {
  id: string;
  workflow_id: string;
  user_id: string;
  lead_id: string;
  lead_email: string;
  lead_name: string | null;
  run_at: string;
  status: "pending" | "done" | "failed";
};

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
