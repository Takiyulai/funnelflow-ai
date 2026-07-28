// lib/workflows/validate.ts
// 🆕 Validation des entrées d'écriture des workflows (routes API).
import { z } from "zod";
import type { WorkflowInput } from "./types";

// 🆕 VAGUE 1 / LOT 5 — Test de condition (purement logique, aucun appel IA).
const conditionTestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("has_tag"), tagId: z.string().uuid() }),
  z.object({
    type: z.literal("status_is"),
    status: z.enum(["nouveau", "contacte", "qualifie", "client", "perdu"]),
  }),
  z.object({ type: z.literal("language_is"), language: z.enum(["fr", "en", "es"]) }),
  z.object({ type: z.literal("source_is"), source: z.string().trim().min(1).max(120) }),
  z.object({
    type: z.literal("country_is"),
    country: z.string().trim().length(2),
  }),
  z.object({
    type: z.literal("has_opened_email"),
    sinceDays: z.number().int().min(1).max(365).optional(),
    // 🆕 Sans cette entrée, sequenceId serait silencieusement retiré par ce
    // schéma (z.object non-strict) avant d'atteindre la base — même piège que
    // briefSchema (cf. autofunnel-zod-brief-schema-gap).
    sequenceId: z.string().uuid().optional(),
    // 🆕 Même piège pour sequenceEmailId (email précis dans la séquence).
    sequenceEmailId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("has_clicked_email"),
    sinceDays: z.number().int().min(1).max(365).optional(),
    sequenceId: z.string().uuid().optional(),
    sequenceEmailId: z.string().uuid().optional(),
    urlContains: z.string().trim().min(1).max(500).optional(),
  }),
]);

// ⚠️ Piège connu (cf. briefSchema) : tout champ absent d'un schéma zod est
// SILENCIEUSEMENT retiré. Chaque nouveau champ d'action doit donc être ajouté
// ici ET dans lib/workflows/types.ts.
//
// Les branches d'une condition contiennent des actions → schéma récursif via
// z.lazy(), profondeur bornée par le superRefine du tableau d'actions.
type ActionSchemaType = z.ZodTypeAny;

const baseActionSchemas = [
  z.object({
    kind: z.literal("add_tag"),
    tags: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  }),
  z.object({
    kind: z.literal("set_status"),
    status: z.enum(["nouveau", "contacte", "qualifie", "client", "perdu"]),
  }),
  z.object({
    kind: z.literal("enroll_in_sequence"),
    sequenceId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("notify_owner"),
    subject: z.string().max(300).optional(),
    message: z.string().max(5000).optional(),
  }),
  z.object({
    kind: z.literal("wait"),
    // 🆕 Jours ET/OU heures ET/OU minutes (au moins une unité > 0,
    // vérifié dans le superRefine du tableau d'actions ci-dessous).
    days: z.number().int().min(0).max(365).optional(),
    hours: z.number().int().min(0).max(23).optional(),
    minutes: z.number().int().min(0).max(59).optional(),
  }),
  // 🆕 Attente jusqu'à une date/heure fixe (instant absolu, converti en ISO UTC
  // côté client). `datetime()` exige un ISO complet avec fuseau (…Z).
  z.object({
    kind: z.literal("wait_until"),
    dateTime: z.string().datetime(),
  }),
  // 🆕 LOT 5 — Email direct au contact.
  z.object({
    kind: z.literal("send_email"),
    subject: z.string().trim().min(1).max(300),
    content: z.string().trim().min(1).max(20000),
  }),
] as const;

const actionSchema: ActionSchemaType = z.lazy(() =>
  z.discriminatedUnion("kind", [
    ...baseActionSchemas,
    // 🆕 LOT 5 — Condition si/alors : branches d'actions imbriquées.
    z.object({
      kind: z.literal("condition"),
      test: conditionTestSchema,
      negate: z.boolean().optional(),
      then: z.array(actionSchema).max(10).default([]),
      otherwise: z.array(actionSchema).max(10).default([]),
    }),
  ]),
);

/** Profondeur d'imbrication des conditions (2 niveaux max côté API). */
function conditionDepth(action: unknown, depth = 0): number {
  const a = action as { kind?: string; then?: unknown[]; otherwise?: unknown[] };
  if (a?.kind !== "condition") return depth;
  const branches = [...(a.then ?? []), ...(a.otherwise ?? [])];
  return Math.max(
    depth + 1,
    ...branches.map((b) => conditionDepth(b, depth + 1)),
    depth + 1,
  );
}

// 🆕 LOT 2 — Événements déclencheurs étendus.
const triggerEventEnum = z.enum([
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
  "time.before_event",
  "email.link_clicked",
  "page.visited",
]);

export const workflowInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(["draft", "active", "paused"]),
  trigger: z
    .object({
      event: triggerEventEnum.default("lead.created"),
      // Filtres optionnels (selon l'événement) ; un filtre absent = « tous ».
      funnelId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
      status: z
        .enum(["nouveau", "contacte", "qualifie", "client", "perdu"])
        .nullable()
        .optional(),
      // 🆕 LOT 2
      pageSlug: z.string().trim().max(160).nullable().optional(),
      linkLabel: z.string().trim().max(500).nullable().optional(),
      afterEvent: triggerEventEnum.nullable().optional(),
      delayDays: z.number().int().min(0).max(365).optional(),
      delayHours: z.number().int().min(0).max(23).optional(),
      // 🆕 RÉ-ENTRÉE. Sans cette entrée, zod retirerait SILENCIEUSEMENT le champ
      // du déclencheur (le schéma reconstruit l'objet clé par clé plus bas) —
      // même piège que brandColors/authorName côté génération de tunnels.
      allowReentry: z.boolean().optional(),
    })
    .superRefine((t, ctx) => {
      if (t.event === "time.elapsed") {
        if (!t.afterEvent) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["afterEvent"],
            message: "Choisis l'événement de référence.",
          });
        }
        if ((t.delayDays ?? 0) + (t.delayHours ?? 0) <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["delayDays"],
            message: "Le délai doit être d'au moins 1 heure.",
          });
        }
      }
      // 🆕 time.before_event : funnel obligatoire (une date par tunnel) + délai > 0.
      if (t.event === "time.before_event") {
        if (!t.funnelId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["funnelId"],
            message: "Choisis le tunnel dont l'événement daté doit être utilisé.",
          });
        }
        if ((t.delayDays ?? 0) + (t.delayHours ?? 0) <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["delayDays"],
            message: "Le délai doit être d'au moins 1 heure.",
          });
        }
      }
    }),
  actions: z
    .array(actionSchema)
    .max(20)
    .superRefine((actions, ctx) => {
      const checkWait = (a: unknown, path: (number | string)[]) => {
        const w = a as { kind?: string; days?: number; hours?: number; minutes?: number };
        if (
          w?.kind === "wait" &&
          (w.days ?? 0) + (w.hours ?? 0) + (w.minutes ?? 0) <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: "L'attente doit être d'au moins 1 minute.",
          });
        }
        // 🆕 LOT 5 — vérifie aussi les "wait" imbriqués dans les branches.
        const c = a as { kind?: string; then?: unknown[]; otherwise?: unknown[] };
        if (c?.kind === "condition") {
          (c.then ?? []).forEach((b, j) => checkWait(b, [...path, "then", j]));
          (c.otherwise ?? []).forEach((b, j) =>
            checkWait(b, [...path, "otherwise", j]),
          );
        }
      };
      actions.forEach((a, i) => {
        checkWait(a, [i]);
        // 🆕 LOT 5 — imbrication des conditions bornée (2 niveaux).
        if (conditionDepth(a) > 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i],
            message: "Deux niveaux de condition imbriqués maximum.",
          });
        }
      });
    }),
});

/** Parse + normalise une entrée workflow. Lève une ZodError si invalide. */
export function parseWorkflowInput(body: unknown): WorkflowInput {
  const parsed = workflowInputSchema.parse(body);
  return {
    name: parsed.name,
    status: parsed.status,
    trigger: {
      event: parsed.trigger.event,
      funnelId: parsed.trigger.funnelId ?? null,
      tagId: parsed.trigger.tagId ?? null,
      status: parsed.trigger.status ?? null,
      pageSlug: parsed.trigger.pageSlug ?? null,
      linkLabel: parsed.trigger.linkLabel ?? null,
      afterEvent: parsed.trigger.afterEvent ?? null,
      delayDays: parsed.trigger.delayDays ?? 0,
      delayHours: parsed.trigger.delayHours ?? 0,
      // Volontairement PAS de `?? false` : `undefined` signifie « laisse le
      // moteur décider selon la nature de l'événement » (cf. runs.ts), ce qui
      // n'est pas la même chose que « bloquer explicitement ».
      allowReentry: parsed.trigger.allowReentry,
    },
    actions: parsed.actions,
  };
}
