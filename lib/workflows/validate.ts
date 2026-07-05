// lib/workflows/validate.ts
// 🆕 Validation des entrées d'écriture des workflows (routes API).
import { z } from "zod";
import type { WorkflowInput } from "./types";

const actionSchema = z.discriminatedUnion("kind", [
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
]);

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
    }),
  actions: z
    .array(actionSchema)
    .max(20)
    .superRefine((actions, ctx) => {
      actions.forEach((a, i) => {
        if (
          a.kind === "wait" &&
          (a.days ?? 0) + (a.hours ?? 0) + (a.minutes ?? 0) <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i],
            message: "L'attente doit être d'au moins 1 minute.",
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
    },
    actions: parsed.actions,
  };
}
