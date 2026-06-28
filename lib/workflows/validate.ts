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
    days: z.number().int().min(1).max(365),
  }),
]);

export const workflowInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(["draft", "active", "paused"]),
  trigger: z.object({
    event: z
      .enum(["lead.created", "tag.added", "status.changed"])
      .default("lead.created"),
    // Filtres optionnels (selon l'événement) ; un filtre absent = « tous ».
    funnelId: z.string().uuid().nullable().optional(),
    tagId: z.string().uuid().nullable().optional(),
    status: z
      .enum(["nouveau", "contacte", "qualifie", "client", "perdu"])
      .nullable()
      .optional(),
  }),
  actions: z.array(actionSchema).max(20),
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
    },
    actions: parsed.actions,
  };
}
