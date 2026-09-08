import { describe, expect, it } from "vitest";
import { parseAudience } from "@/lib/crm/campaigns";
import { workflowInputSchema } from "@/lib/workflows/validate";

const LIST_ID = "2a38ad38-bdb5-4a54-a06b-40659c0bc93c";

describe("ciblage email par liste", () => {
  it("accepte une liste CRM identifiée par un UUID", () => {
    expect(parseAudience({ type: "list", listId: LIST_ID })).toEqual({
      type: "list",
      listId: LIST_ID,
    });
  });

  it("rejette un ciblage de liste incomplet ou forgé", () => {
    expect(parseAudience({ type: "list", listId: "liste-externe" })).toBeNull();
    expect(parseAudience({ type: "inconnu" })).toBeNull();
  });
});

describe("listes dans les workflows", () => {
  const base = {
    name: "Classement automatique",
    status: "active" as const,
    trigger: { event: "lead.created" as const },
  };

  it("conserve l'action d'ajout à une liste", () => {
    const parsed = workflowInputSchema.parse({
      ...base,
      actions: [{ kind: "add_to_list", listId: LIST_ID }],
    });
    expect(parsed.actions[0]).toEqual({ kind: "add_to_list", listId: LIST_ID });
  });

  it("conserve une condition d'appartenance à une liste", () => {
    const parsed = workflowInputSchema.parse({
      ...base,
      actions: [
        {
          kind: "condition",
          test: { type: "in_list", listId: LIST_ID },
          then: [{ kind: "add_to_list", listId: LIST_ID }],
          otherwise: [],
        },
      ],
    });
    expect(parsed.actions[0]).toMatchObject({
      kind: "condition",
      test: { type: "in_list", listId: LIST_ID },
    });
  });
});
