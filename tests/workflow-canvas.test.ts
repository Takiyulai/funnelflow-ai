// tests/workflow-canvas.test.ts
//
// 🆕 MODULE 4 — Mise en page du canvas de workflow.
//
// Ces tests portent sur la partie la plus facile à casser du module : le
// placement des branches imbriquées et leur reconvergence. La logique est
// volontairement une fonction PURE (lib/workflows/canvasLayout.ts), justement
// pour être vérifiable sans monter React Flow.

import { describe, it, expect } from "vitest";
import { buildCanvasGraph, countActions } from "@/lib/workflows/canvasLayout";
import type { Workflow, WorkflowActionConfig } from "@/lib/workflows/types";

function makeWorkflow(actions: WorkflowActionConfig[]): Workflow {
  return {
    id: "w1",
    userId: "u1",
    name: "Test",
    status: "active",
    trigger: { event: "lead.created" },
    actions: actions.map((config, position) => ({ position, config })),
  };
}

const addTag: WorkflowActionConfig = { kind: "add_tag", tags: ["chaud"] };
const wait: WorkflowActionConfig = { kind: "wait", days: 1 };

describe("buildCanvasGraph", () => {
  it("relie le déclencheur, les actions et la fin en une seule chaîne", () => {
    const graph = buildCanvasGraph(makeWorkflow([addTag, wait]));

    expect(graph.nodes.find((n) => n.data.kind === "trigger")).toBeTruthy();
    expect(graph.nodes.find((n) => n.data.kind === "end")).toBeTruthy();
    expect(graph.nodes.filter((n) => n.data.kind === "action")).toHaveLength(2);

    // Chaîne complète : trigger → a-0 → a-1 → end
    expect(graph.edges).toHaveLength(3);
  });

  it("gère un workflow sans aucune action", () => {
    const graph = buildCanvasGraph(makeWorkflow([]));
    // Le déclencheur doit pointer directement sur la fin, sans nœud orphelin.
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe("trigger");
    expect(graph.edges[0].target).toBe("end");
  });

  it("fait diverger puis reconverger les branches d'une condition", () => {
    const condition: WorkflowActionConfig = {
      kind: "condition",
      test: { type: "status_is", status: "client" },
      then: [addTag],
      otherwise: [wait],
    };
    const graph = buildCanvasGraph(makeWorkflow([condition, addTag]));

    const join = graph.nodes.find((n) => n.data.kind === "join");
    expect(join).toBeTruthy();

    // Les deux branches arrivent bien sur le nœud de reconvergence : c'est ce
    // qui rend le dessin fidèle au moteur, où l'exécution reprend le tronc
    // commun après la condition.
    const intoJoin = graph.edges.filter((e) => e.target === join!.id);
    expect(intoJoin).toHaveLength(2);

    // Les branches sont placées de part et d'autre du tronc.
    const thenNode = graph.nodes.find((n) => n.id.includes("-then-"));
    const elseNode = graph.nodes.find((n) => n.id.includes("-else-"));
    expect(thenNode!.position.x).toBeLessThan(0);
    expect(elseNode!.position.x).toBeGreaterThan(0);
  });

  it("garde deux arêtes DISTINCTES quand les deux branches sont vides", () => {
    // 🔒 RÉGRESSION. Une condition « si déjà client, ne rien faire » a ses deux
    // branches vides. Les deux arêtes de reconvergence partaient alors du même
    // nœud (la condition) et portaient le MÊME identifiant : React Flow en
    // écartait une, et une branche disparaissait du dessin sans prévenir.
    const condition: WorkflowActionConfig = {
      kind: "condition",
      test: { type: "has_tag", tagId: "t1" },
      then: [],
      otherwise: [],
    };
    const graph = buildCanvasGraph(makeWorkflow([condition]));

    const ids = graph.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Et les libellés restent lisibles, alors qu'aucune action ne les porte.
    const labels = graph.edges.map((e) => e.label).filter(Boolean);
    expect(labels).toContain("si oui");
    expect(labels).toContain("si non");
  });

  it("n'attribue jamais deux fois le même identifiant de nœud", () => {
    const nested: WorkflowActionConfig = {
      kind: "condition",
      test: { type: "status_is", status: "client" },
      then: [
        {
          kind: "condition",
          test: { type: "has_tag", tagId: "t1" },
          then: [addTag],
          otherwise: [],
        },
      ],
      otherwise: [wait],
    };
    const graph = buildCanvasGraph(makeWorkflow([nested, addTag]));

    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("countActions", () => {
  it("compte les actions des branches, pas seulement le tronc", () => {
    const condition: WorkflowActionConfig = {
      kind: "condition",
      test: { type: "status_is", status: "client" },
      then: [addTag, wait],
      otherwise: [addTag],
    };
    // 1 condition + 2 (alors) + 1 (sinon) + 1 action de tronc = 5
    expect(countActions([condition, addTag])).toBe(5);
  });
});
