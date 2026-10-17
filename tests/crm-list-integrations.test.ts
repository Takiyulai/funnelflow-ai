import { describe, expect, it } from "vitest";
import { parseAudience } from "@/lib/crm/campaigns";
import { workflowInputSchema } from "@/lib/workflows/validate";

const LIST_ID = "2a38ad38-bdb5-4a54-a06b-40659c0bc93c";
const TAG_ID = "7f22de5c-060f-47c8-82b6-36a13e1bb79b";
const SEQUENCE_ID = "a127d865-ff84-45ef-b104-e267547db05d";
const EMAIL_ID = "72db15d1-a896-4f49-8c05-a1853f3c2b51";

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

  it("conserve le déclencheur d'inscription à une liste", () => {
    const parsed = workflowInputSchema.parse({
      ...base,
      trigger: { event: "list.subscribed", listId: LIST_ID },
      actions: [{ kind: "remove_from_list", listId: LIST_ID }],
    });
    expect(parsed.trigger).toMatchObject({ event: "list.subscribed", listId: LIST_ID });
    expect(parsed.actions[0]).toEqual({ kind: "remove_from_list", listId: LIST_ID });
  });

  it("conserve le déclencheur d'ouverture d'un email précis", () => {
    const parsed = workflowInputSchema.parse({
      ...base,
      trigger: {
        event: "email.opened",
        sequenceId: SEQUENCE_ID,
        sequenceEmailId: EMAIL_ID,
      },
      actions: [{ kind: "remove_tag", tagId: TAG_ID }],
    });
    expect(parsed.trigger).toMatchObject({
      event: "email.opened",
      sequenceId: SEQUENCE_ID,
      sequenceEmailId: EMAIL_ID,
    });
    expect(parsed.actions[0]).toEqual({ kind: "remove_tag", tagId: TAG_ID });
  });

  it("valide les ajustements positifs et négatifs du score", () => {
    const parsed = workflowInputSchema.parse({
      ...base,
      actions: [
        { kind: "increase_score", points: 25 },
        { kind: "decrease_score", points: 5 },
      ],
    });
    expect(parsed.actions).toEqual([
      { kind: "increase_score", points: 25 },
      { kind: "decrease_score", points: 5 },
    ]);
  });
});
