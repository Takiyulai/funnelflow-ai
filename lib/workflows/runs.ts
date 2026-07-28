// lib/workflows/runs.ts
// 🆕 Journal d'exécution des workflows + garde de ré-entrée.
//
// Voir db/workflow-runs-history.sql pour le schéma et le raisonnement.
//
// PRINCIPE DE NON-INTERFÉRENCE : tout ce module est best-effort. Le moteur de
// workflows ne doit JAMAIS échouer parce que le journal a échoué — un email
// envoyé sans trace vaut mieux qu'un email non envoyé. Chaque fonction avale
// donc ses erreurs et se contente de les journaliser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowActionConfig, WorkflowTriggerEvent } from "./types";

export type RunStepStatus = "done" | "failed" | "deferred" | "skipped";

export type RunStep = {
  position: number;
  kind: string;
  status: RunStepStatus;
  at: string;
  /** Précision lisible : branche empruntée, motif d'échec, date de report… */
  detail?: string;
};

/**
 * 🆕 La ré-entrée est-elle INTERDITE par défaut pour cet événement ?
 *
 * Tout dépend de la nature de l'événement, et c'est ce qui rend un réglage
 * unique impossible :
 *
 *  • Les événements d'ENTRÉE marquent le début d'un parcours. Une inscription,
 *    une candidature, une réservation : les rejouer produit des doublons. Un
 *    visiteur qui soumet deux fois le formulaire ne veut pas deux séquences.
 *
 *  • Les événements RÉPÉTABLES décrivent un changement d'état qui peut
 *    légitimement se reproduire : un deuxième achat, un tag reposé, une page
 *    revisitée. Les bloquer casserait des usages parfaitement valides — un
 *    client fidèle qui rachète doit redéclencher le workflow d'achat.
 *
 * Surchargeable par workflow via `trigger.allowReentry` (aucune migration : le
 * déclencheur est stocké en JSON).
 */
const ENTRY_EVENTS: ReadonlySet<string> = new Set<WorkflowTriggerEvent>([
  "lead.created",
  "webinar.registered",
  "application.submitted",
  "appointment.booked",
]);

export function reentryBlockedByDefault(event: WorkflowTriggerEvent): boolean {
  return ENTRY_EVENTS.has(event);
}

export type StartRunParams = {
  workflowId: string;
  userId: string;
  leadId: string | null;
  leadEmail: string | null;
  triggerEvent: WorkflowTriggerEvent;
  funnelId: string | null;
  actionsTotal: number;
  /** true = ré-entrée autorisée → pas de clé de déduplication. */
  allowReentry: boolean;
};

export type StartRunResult =
  /** Exécution autorisée : `runId` peut être null si le journal a échoué. */
  | { proceed: true; runId: string | null }
  /** Ce contact est déjà passé par ce workflow : on n'exécute pas. */
  | { proceed: false; runId: null };

/**
 * Ouvre une exécution. C'est aussi le point où la ré-entrée est tranchée : si
 * la clé de déduplication existe déjà, l'insertion échoue (index unique) et on
 * renvoie `proceed: false`.
 *
 * ⚠️ Le verdict vient de la BASE, pas d'un test applicatif préalable. Deux
 * soumissions simultanées passeraient toutes deux un « est-ce que ça existe
 * déjà ? » avant que l'une n'ait écrit ; ici, la seconde insertion est refusée.
 */
export async function startWorkflowRun(
  admin: SupabaseClient,
  p: StartRunParams,
): Promise<StartRunResult> {
  // Sans contact identifié, la déduplication n'a pas de sens.
  const dedupeKey =
    !p.allowReentry && p.leadId ? `${p.workflowId}:${p.leadId}` : null;

  try {
    const { data, error } = await admin
      .from("workflow_runs")
      .insert({
        workflow_id: p.workflowId,
        user_id: p.userId,
        lead_id: p.leadId,
        lead_email: p.leadEmail,
        trigger_event: p.triggerEvent,
        funnel_id: p.funnelId,
        status: "running",
        actions_total: p.actionsTotal,
        dedupe_key: dedupeKey,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = violation d'unicité → le contact est déjà passé par ici.
      if (error.code === "23505") {
        console.log(
          `[workflows] ré-entrée bloquée : le contact ${p.leadId} est déjà passé par le workflow ${p.workflowId}.`,
        );
        return { proceed: false, runId: null };
      }
      // Toute autre erreur (table absente, RLS…) ne doit PAS bloquer le
      // workflow : on exécute sans journal.
      console.warn("[workflows] journal indisponible, exécution sans trace :", error.message);
      return { proceed: true, runId: null };
    }

    return { proceed: true, runId: (data?.id as string) ?? null };
  } catch (e) {
    console.warn(
      "[workflows] journal indisponible, exécution sans trace :",
      e instanceof Error ? e.message : e,
    );
    return { proceed: true, runId: null };
  }
}

/** Clôt une exécution avec son journal pas à pas. */
export async function finishWorkflowRun(
  admin: SupabaseClient,
  runId: string | null,
  outcome: { status: "done" | "failed"; steps: RunStep[]; error?: string | null },
): Promise<void> {
  if (!runId) return;
  try {
    await admin
      .from("workflow_runs")
      .update({
        status: outcome.status,
        steps: outcome.steps,
        actions_done: outcome.steps.filter((s) => s.status === "done").length,
        error: outcome.error ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  } catch (e) {
    console.warn(
      "[workflows] clôture du journal échouée :",
      e instanceof Error ? e.message : e,
    );
  }
}

/** Libellé court d'une action, pour le journal. */
export function describeAction(a: WorkflowActionConfig): string {
  switch (a.kind) {
    case "wait":
      return `attente ${a.days ?? 0}j ${a.hours ?? 0}h ${a.minutes ?? 0}min`;
    case "wait_until":
      return `attente jusqu'au ${a.dateTime}`;
    case "add_tag":
      return `tags : ${a.tags.join(", ")}`;
    case "set_status":
      return `statut → ${a.status}`;
    case "enroll_in_sequence":
      return "inscription à une séquence";
    case "notify_owner":
      return "notification au propriétaire";
    case "send_email":
      return `email « ${a.subject} »`;
    case "condition":
      return `condition ${a.test.type}`;
    default:
      return "action";
  }
}
