// lib/workflows/engine.ts
// 🆕 Exécution des workflows sur l'événement lead.created. Appelé depuis
// /api/leads (client admin), de façon NON bloquante : toute erreur est avalée
// pour ne jamais empêcher la capture du lead.
//
// Délais : une action "wait" décale les emails SUIVANTS (accumulateur de jours).
// Les emails (notify_owner / séquences enrôlées) sont déposés dans la file existante
// `scheduled_emails` (source_type='workflow') et envoyés par le cron — aucune
// dépendance ni planificateur supplémentaire.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateTagsByName, assignTagsToContacts } from "@/lib/crm/tags";
import { enrollContact } from "@/lib/crm/sequences";
import { personalize, renderSequenceEmailHtml } from "@/lib/crm/emailRender";
import { getActiveWorkflowsForEvent, getActiveWorkflowsWaitingOnEvent } from "./repository";
import type {
  WorkflowActionConfig,
  WorkflowConditionTest,
  WorkflowTriggerConfig,
  WorkflowTriggerEvent,
  LeadStatus,
} from "./types";
import { waitActionMs } from "./types";

type LeadContext = {
  id: string;
  email: string;
  name?: string | null;
};

/** Contexte d'un événement déclencheur. Le `lead` (contact concerné) est commun
 *  à tous les événements ; les autres champs sont le « discriminant » de filtre
 *  propre à chaque type d'événement (funnel/tag/statut/page/lien).
 *  🆕 LOT 2 : `funnelId` sert aussi de filtre pour purchase.completed,
 *  webinar.*, application.submitted, appointment.booked et page.visited. */
export type WorkflowEventContext = {
  event: WorkflowTriggerEvent;
  lead: LeadContext;
  /** lead.created + 🆕 purchase.completed / webinar.* / application.submitted /
   *  appointment.booked / page.visited : funnel d'origine de l'événement. */
  funnelId?: string | null;
  /** tag.added : tag qui vient d'être ajouté. */
  tagId?: string | null;
  /** status.changed : nouveau statut du lead. */
  status?: LeadStatus | null;
  /** 🆕 page.visited : slug de la page visitée. */
  pageSlug?: string | null;
  /** 🆕 email.link_clicked : URL du lien cliqué. */
  linkLabel?: string | null;
};

/** Le filtre du trigger correspond-il au contexte de l'événement ?
 *  Un filtre absent (null) = « n'importe lequel » (workflow large). */
function triggerFilterMatches(
  trigger: WorkflowTriggerConfig,
  ctx: WorkflowEventContext,
): boolean {
  switch (ctx.event) {
    case "lead.created":
    case "purchase.completed":
    case "webinar.registered":
    case "webinar.attended":
    case "webinar.absent":
    case "application.submitted":
    case "appointment.booked":
      return !trigger.funnelId || trigger.funnelId === ctx.funnelId;
    case "tag.added":
      return !trigger.tagId || trigger.tagId === ctx.tagId;
    case "status.changed":
      return !trigger.status || trigger.status === ctx.status;
    case "page.visited":
      return (
        (!trigger.funnelId || trigger.funnelId === ctx.funnelId) &&
        (!trigger.pageSlug || trigger.pageSlug === ctx.pageSlug)
      );
    case "email.link_clicked":
      return !trigger.linkLabel || trigger.linkLabel === ctx.linkLabel;
    // 🆕 time.elapsed ne se déclenche JAMAIS directement sur un événement —
    // voir la planification différée plus bas dans runWorkflowsForEvent.
    case "time.elapsed":
    default:
      return false;
  }
}

/** 🆕 LOT 2 — Planifie (au lieu d'exécuter tout de suite) les workflows dont le
 *  déclencheur est `time.elapsed` et dont l'événement de référence vient de se
 *  produire. Insère une ligne dans `workflow_pending_runs`, traitée plus tard
 *  par le CRON. NON bloquant. */
async function scheduleTimeElapsedWorkflows(
  admin: SupabaseClient,
  userId: string,
  ctx: WorkflowEventContext,
): Promise<void> {
  let waiting: Awaited<ReturnType<typeof getActiveWorkflowsWaitingOnEvent>>;
  try {
    waiting = await getActiveWorkflowsWaitingOnEvent(admin, userId, ctx.event);
  } catch (e) {
    console.warn("[workflows] chargement time.elapsed échoué (non bloquant):", e);
    return;
  }
  for (const wf of waiting) {
    if (wf.trigger.funnelId && wf.trigger.funnelId !== ctx.funnelId) continue;
    const delayMs =
      ((Number(wf.trigger.delayDays) || 0) * 24 + (Number(wf.trigger.delayHours) || 0)) *
      60 *
      60 *
      1000;
    if (delayMs <= 0) continue;
    try {
      const { error } = await admin.from("workflow_pending_runs").insert({
        workflow_id: wf.id,
        user_id: userId,
        lead_id: ctx.lead.id,
        lead_email: ctx.lead.email,
        lead_name: ctx.lead.name ?? null,
        run_at: new Date(Date.now() + delayMs).toISOString(),
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      console.warn(`[workflows] planification "${wf.name}" échouée (non bloquant):`, e);
    }
  }
}

// 🆕 Événements considérés comme « le contact vient d'entrer dans le tunnel »,
// seuls habilités à déclencher la planification `time.before_event`. Volontairement
// restreint à UN SEUL événement (webinar.registered) : /api/leads déclenche à la
// fois lead.created (toujours) ET l'événement sémantique de la page (souvent en
// PLUS) pour la même inscription — écouter les deux planifierait le même rappel
// deux fois pour le même contact.
const BEFORE_EVENT_ENTRY_EVENTS: readonly WorkflowTriggerEvent[] = ["webinar.registered"];

/** 🆕 Planifie les workflows dont le déclencheur est `time.before_event` pour LE
 *  TUNNEL de cet événement : calcule `funnel.header.eventDateTime - délai` et
 *  insère dans `workflow_pending_runs` (même mécanisme que time.elapsed, déjà
 *  traité par le cron existant — aucun nouveau job à configurer). Si la date de
 *  l'événement est absente/invalide, ou si le calcul tombe déjà dans le passé
 *  (inscription trop proche ou après le live), rien n'est planifié : on préfère
 *  ne pas envoyer un rappel plutôt que d'en envoyer un après coup. NON bloquant. */
async function scheduleBeforeEventWorkflows(
  admin: SupabaseClient,
  userId: string,
  ctx: WorkflowEventContext,
): Promise<void> {
  if (!ctx.funnelId || !BEFORE_EVENT_ENTRY_EVENTS.includes(ctx.event)) return;

  let candidates: Awaited<ReturnType<typeof getActiveWorkflowsForEvent>>;
  try {
    candidates = await getActiveWorkflowsForEvent(admin, userId, "time.before_event");
  } catch (e) {
    console.warn("[workflows] chargement time.before_event échoué (non bloquant):", e);
    return;
  }
  const matching = candidates.filter((wf) => wf.trigger.funnelId === ctx.funnelId);
  if (matching.length === 0) return;

  let eventDateTime: string | null = null;
  try {
    const { data } = await admin
      .from("funnels")
      .select("published_content")
      .eq("id", ctx.funnelId)
      .maybeSingle();
    const content = data?.published_content as { header?: { eventDateTime?: string } } | null;
    eventDateTime = content?.header?.eventDateTime ?? null;
  } catch (e) {
    console.warn("[workflows] lecture eventDateTime échouée (non bloquant):", e);
    return;
  }
  if (!eventDateTime) return;
  const eventMs = new Date(eventDateTime).getTime();
  if (!Number.isFinite(eventMs)) return;

  for (const wf of matching) {
    const offsetMs =
      ((Number(wf.trigger.delayDays) || 0) * 24 + (Number(wf.trigger.delayHours) || 0)) *
      60 *
      60 *
      1000;
    const runAt = eventMs - offsetMs;
    if (runAt <= Date.now()) continue; // trop tard : on n'envoie jamais après coup
    try {
      const { error } = await admin.from("workflow_pending_runs").insert({
        workflow_id: wf.id,
        user_id: userId,
        lead_id: ctx.lead.id,
        lead_email: ctx.lead.email,
        lead_name: ctx.lead.name ?? null,
        run_at: new Date(runAt).toISOString(),
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      console.warn(`[workflows] planification "${wf.name}" (time.before_event) échouée (non bloquant):`, e);
    }
  }
}

/** 🆕 Moteur générique : exécute les workflows actifs dont le trigger correspond
 *  à l'événement + son filtre. NON bloquant (toute erreur est avalée). */
export async function runWorkflowsForEvent(
  admin: SupabaseClient,
  userId: string,
  ctx: WorkflowEventContext,
): Promise<void> {
  let workflows: Awaited<ReturnType<typeof getActiveWorkflowsForEvent>> = [];
  try {
    workflows = await getActiveWorkflowsForEvent(admin, userId, ctx.event);
  } catch (e) {
    console.warn("[workflows] chargement échoué (non bloquant):", e);
    workflows = [];
  }

  for (const wf of workflows) {
    if (!triggerFilterMatches(wf.trigger, ctx)) continue;
    try {
      await executeActions(admin, userId, ctx.lead, wf.actions.map((a) => a.config));
    } catch (e) {
      console.warn(`[workflows] exécution "${wf.name}" échouée (non bloquant):`, e);
    }
  }

  // 🆕 LOT 2 — Greffe des déclencheurs `time.elapsed` référençant CET événement.
  await scheduleTimeElapsedWorkflows(admin, userId, ctx);
  // 🆕 Greffe des déclencheurs `time.before_event` pour ce tunnel (webinaires live).
  await scheduleBeforeEventWorkflows(admin, userId, ctx);
}

/**
 * 🆕 LOT 4/7/8 — Résout l'événement workflow SÉMANTIQUE associé au rôle d'une
 * page de capture (registration → inscription webinaire, booking → RDV,
 * application → candidature coaching). Ces événements ont été introduits au
 * LOT 2 (types + filtres + UI) mais jamais émis faute de page dédiée ; les
 * LOT 4/7/8 ayant depuis construit ces pages, /api/leads peut désormais les
 * déclencher EN PLUS de `lead.created` (jamais à sa place, pour ne rien
 * casser des workflows existants basés sur lead.created).
 * Retourne `null` si le rôle n'a pas d'événement dédié.
 */
export function eventForPageRole(role: string | null | undefined): WorkflowTriggerEvent | null {
  switch (role) {
    case "registration":
      return "webinar.registered";
    case "booking":
      return "appointment.booked";
    case "application":
      return "application.submitted";
    default:
      return null;
  }
}

/** Compat : point d'entrée historique de /api/leads (événement lead.created).
 *  Délègue au moteur générique — la capture de leads reste inchangée. */
export async function runLeadCreatedWorkflows(params: {
  admin: SupabaseClient;
  userId: string;
  funnelId: string;
  lead: LeadContext;
}): Promise<void> {
  return runWorkflowsForEvent(params.admin, params.userId, {
    event: "lead.created",
    lead: params.lead,
    funnelId: params.funnelId,
  });
}

/** 🆕 VAGUE 1 / LOT 5 — Profondeur max d'imbrication des conditions (une
 *  condition peut contenir des conditions dans ses branches, avec une limite
 *  dure pour éviter toute récursion pathologique). */
const MAX_CONDITION_DEPTH = 3;

/** 🆕 LOT 2 — Exportée pour être réutilisée par le CRON qui traite les
 *  exécutions différées `workflow_pending_runs` (déclencheur `time.elapsed`).
 *  🆕 LOT 5 — `initialDelayMs`/`depth` servent à la récursion des branches de
 *  condition ; les appels existants (2 ou 4 arguments) sont inchangés. */
export async function executeActions(
  admin: SupabaseClient,
  userId: string,
  lead: LeadContext,
  actions: WorkflowActionConfig[],
  initialDelayMs = 0,
  depth = 0,
): Promise<void> {
  // 🆕 Accumulateur de délai en MILLISECONDES : le "wait" accepte désormais
  // jours + heures + minutes (rétro-compat : anciennes étapes { days }).
  let delayMs = initialDelayMs;

  for (const action of actions) {
    // 🆕 Robustesse : chaque action est isolée. Si l'une échoue (ex. enrôlement
    // d'une séquence introuvable, insert refusé…), on logue et on CONTINUE avec
    // les actions suivantes — un échec ne doit plus interrompre le reste du
    // workflow (c'est ce qui masquait l'échec de l'enrôlement, qui sautait la
    // notification placée juste après).
    try {
      switch (action.kind) {
        case "wait": {
          delayMs += waitActionMs(action);
          break;
        }
        case "add_tag": {
          const tags = await getOrCreateTagsByName(admin, userId, action.tags);
          if (tags.length > 0) {
            await assignTagsToContacts(
              admin,
              userId,
              [lead.id],
              tags.map((t) => t.id),
            );
          }
          break;
        }
        case "set_status": {
          const { error } = await admin
            .from("leads")
            .update({ status: action.status })
            .eq("id", lead.id);
          if (error) throw new Error(error.message);
          break;
        }
        case "enroll_in_sequence": {
          // Pont Workflows → Emails : le contenu vit dans la séquence (onglet
          // Emails), source unique. enrollContact programme tous ses emails dans
          // `scheduled_emails` selon leurs propres délais internes. 🆕 CORRECTIF :
          // le délai accumulé par les "wait" placés AVANT cette action dans le
          // workflow est désormais répercuté sur le DÉPART de la séquence (tous
          // ses emails sont décalés d'autant) — avant, il était silencieusement
          // ignoré et la séquence démarrait toujours immédiatement.
          await enrollContact(admin, userId, action.sequenceId, lead.id, delayMs);
          break;
        }
        case "notify_owner": {
          const ownerEmail = await getOwnerEmail(admin, userId);
          if (ownerEmail) {
            await scheduleEmail(admin, {
              userId,
              contactId: lead.id,
              recipient: ownerEmail,
              subject:
                action.subject?.trim() || `Nouveau lead : ${lead.email}`,
              content: renderOwnerNotification(action.message, lead),
              delayMs,
            });
          }
          break;
        }
        // 🆕 LOT 5 — Email direct AU CONTACT, sans séquence. Respecte les
        // "wait" accumulés (déposé dans la file scheduled_emails → cron).
        case "send_email": {
          const subject = action.subject?.trim();
          const content = action.content?.trim();
          if (!subject || !content) break; // config incomplète : ignorée
          await scheduleEmail(admin, {
            userId,
            contactId: lead.id,
            recipient: lead.email,
            subject: personalize(subject, {
              name: lead.name ?? null,
              email: lead.email,
            }),
            content: renderSequenceEmailHtml(content, {
              name: lead.name ?? null,
              email: lead.email,
            }),
            delayMs,
          });
          break;
        }
        // 🆕 LOT 5 — Embranchement si/alors (test logique, aucun appel IA).
        // La branche choisie hérite du délai accumulé jusqu'ici ; le workflow
        // continue ensuite avec les actions APRÈS la condition (délai inchangé,
        // les "wait" internes à une branche restent locaux à cette branche).
        case "condition": {
          if (depth >= MAX_CONDITION_DEPTH) {
            console.warn("[workflows] condition ignorée (profondeur max atteinte)");
            break;
          }
          const ok = await evaluateConditionTest(admin, userId, lead, action.test);
          const branch = (action.negate ? !ok : ok)
            ? action.then
            : action.otherwise;
          if (Array.isArray(branch) && branch.length > 0) {
            await executeActions(admin, userId, lead, branch, delayMs, depth + 1);
          }
          break;
        }
      }
    } catch (e) {
      console.warn(
        `[workflows] action "${action.kind}" ignorée (échec non bloquant):`,
        e,
      );
    }
  }
}

// ─── 🆕 VAGUE 1 / LOT 5 — Évaluation des tests de condition ─────────────────
// Purement logique et déterministe : lecture des données existantes (leads,
// crm_contact_tags, email_events). AUCUN appel IA. Toute erreur de lecture
// fait échouer le test en `false` (comportement prudent, jamais bloquant).

async function evaluateConditionTest(
  admin: SupabaseClient,
  userId: string,
  lead: LeadContext,
  test: WorkflowConditionTest,
): Promise<boolean> {
  try {
    switch (test.type) {
      case "has_tag": {
        if (!test.tagId) return false;
        const { data } = await admin
          .from("crm_contact_tags")
          .select("contact_id")
          .eq("user_id", userId)
          .eq("contact_id", lead.id)
          .eq("tag_id", test.tagId)
          .maybeSingle();
        return Boolean(data);
      }
      case "status_is":
      case "language_is":
      case "source_is":
      case "country_is": {
        const { data } = await admin
          .from("leads")
          .select("status, language, source, phone_country")
          .eq("user_id", userId)
          .eq("id", lead.id)
          .maybeSingle();
        if (!data) return false;
        if (test.type === "status_is") return data.status === test.status;
        if (test.type === "language_is")
          return (data.language ?? "").toLowerCase().startsWith(test.language);
        if (test.type === "source_is")
          return (data.source ?? "") === test.source.trim();
        return (
          (data.phone_country ?? "").toUpperCase() ===
          test.country.trim().toUpperCase()
        );
      }
      case "has_opened_email":
      case "has_clicked_email": {
        const kind = test.type === "has_opened_email" ? "open" : "click";
        let query = admin
          .from("email_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("contact_id", lead.id)
          .eq("kind", kind);
        const days = Number(test.sinceDays) || 0;
        if (days > 0) {
          query = query.gte(
            "created_at",
            new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          );
        }
        // 🆕 Filtre optionnel sur la séquence d'origine — sans lui, le test
        // reste « n'importe quel email envoyé » (comportement historique).
        if (test.sequenceId) {
          query = query.eq("sequence_id", test.sequenceId);
        }
        // 🆕 Filtre optionnel sur L'EMAIL PRÉCIS dans cette séquence — sans
        // lui, le test reste « n'importe quel email de la séquence » (ex.
        // distinguer « a ouvert le rappel H-2 » de « a ouvert un email
        // quelconque de la séquence du webinaire »). Sans effet si sequenceId
        // n'est pas renseigné (cohérent avec l'UI, qui ne l'affiche qu'après
        // le choix d'une séquence).
        if (test.sequenceEmailId) {
          query = query.eq("sequence_email_id", test.sequenceEmailId);
        }
        // 🆕 Filtre optionnel sur l'URL cliquée (kind='click' uniquement) —
        // permet de distinguer « a cliqué CE lien précis » de « a cliqué un
        // lien quelconque ». Comparaison insensible à la casse, substring.
        if (test.type === "has_clicked_email" && test.urlContains?.trim()) {
          query = query.ilike("url", `%${test.urlContains.trim()}%`);
        }
        const { count } = await query;
        return (count ?? 0) > 0;
      }
      default:
        return false;
    }
  } catch (e) {
    console.warn("[workflows] évaluation de condition échouée → false:", e);
    return false;
  }
}

async function scheduleEmail(
  admin: SupabaseClient,
  args: {
    userId: string;
    contactId: string;
    recipient: string;
    subject: string;
    content: string;
    delayMs: number;
  },
): Promise<void> {
  const scheduledAt = new Date(Date.now() + args.delayMs).toISOString();
  const { error } = await admin.from("scheduled_emails").insert({
    user_id: args.userId,
    source_type: "workflow",
    contact_id: args.contactId,
    recipient_email: args.recipient,
    subject: args.subject,
    content: args.content,
    scheduled_at: scheduledAt,
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

async function getOwnerEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

// ─── Helpers de rendu ───────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderOwnerNotification(message: string | undefined, lead: LeadContext): string {
  const intro = message?.trim()
    ? `<p>${escapeHtml(message.trim())}</p>`
    : `<p>Un nouveau lead vient d'être capturé sur votre tunnel.</p>`;
  const name = lead.name?.trim() ? escapeHtml(lead.name.trim()) : "—";
  return `${intro}
<ul>
  <li><strong>Email :</strong> ${escapeHtml(lead.email)}</li>
  <li><strong>Nom :</strong> ${name}</li>
</ul>`;
}
