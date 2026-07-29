// lib/workflows/canvasLayout.ts
//
// 🆕 MODULE 4 — Traduction d'un workflow en graphe positionné.
//
// FONCTION PURE, volontairement séparée du composant : la logique de mise en
// page est la partie délicate (branches imbriquées, reconvergence), et elle
// mérite d'être lisible et testable sans monter React Flow.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE LE GRAPHE DOIT DIRE — ET NE PAS DIRE
//
// Le modèle de données n'est PAS un graphe libre : un workflow est une LISTE
// ordonnée d'actions, où une action `condition` contient deux sous-listes
// (`then` / `otherwise`). Et dans le moteur (lib/workflows/engine.ts), après
// une condition, l'exécution REPREND avec les actions qui suivent — les deux
// branches se rejoignent.
//
// Le canvas reproduit donc exactement cette structure : un tronc vertical, des
// bifurcations qui se referment. Il ne propose PAS de relier n'importe quel
// nœud à n'importe quel autre : on pourrait dessiner des graphes que le moteur
// serait incapable d'exécuter, et l'utilisateur découvrirait le problème à
// l'exécution, sur ses vrais contacts.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Workflow,
  WorkflowActionConfig,
  WorkflowTriggerConfig,
} from "@/lib/workflows/types";

/** Chemin d'accès à une action dans l'arbre : suite d'index et de branches.
 *  Ex. [2, "then", 0] = 1re action de la branche « alors » de la 3e action.
 *  Permet à l'interface de savoir QUELLE action éditer au clic, y compris
 *  profondément imbriquée. */
export type ActionPath = (number | "then" | "otherwise")[];

export type CanvasNodeData =
  | { kind: "trigger"; trigger: WorkflowTriggerConfig }
  | { kind: "action"; action: WorkflowActionConfig; path: ActionPath }
  | { kind: "join"; label: string }
  | { kind: "end" };

export type CanvasNode = {
  id: string;
  position: { x: number; y: number };
  data: CanvasNodeData;
  type: "ffNode";
};

export type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Branche « sinon » : rendue en pointillé, couleur atténuée. */
  muted?: boolean;
};

export type CanvasGraph = { nodes: CanvasNode[]; edges: CanvasEdge[] };

// Géométrie. Des constantes plutôt qu'un moteur de placement automatique :
// la structure est connue à l'avance (tronc + bifurcations), un algorithme
// générique produirait un résultat moins lisible pour plus de complexité.
const ROW_H = 120;
const COL_W = 300;
const NODE_W = 240;

/**
 * Profondeur visuelle d'une liste d'actions, en nombre de rangées.
 * Une condition occupe une rangée pour elle-même, puis la hauteur de sa
 * branche la plus longue, puis une rangée de reconvergence.
 */
function chainRows(actions: WorkflowActionConfig[]): number {
  let rows = 0;
  for (const a of actions) {
    if (a.kind === "condition") {
      rows += 1 + Math.max(chainRows(a.then), chainRows(a.otherwise), 1) + 1;
    } else {
      rows += 1;
    }
  }
  return rows;
}

/**
 * Place une liste d'actions à partir d'une rangée et d'une colonne données.
 *
 * @returns l'id du dernier nœud posé (pour y raccrocher la suite) et la
 *          rangée suivante disponible.
 */
function layoutChain(
  actions: WorkflowActionConfig[],
  opts: {
    startRow: number;
    col: number;
    parentId: string;
    parentLabel?: string;
    parentMuted?: boolean;
    basePath: ActionPath;
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    idPrefix: string;
  },
): { lastId: string; nextRow: number } {
  let row = opts.startRow;
  let previousId = opts.parentId;
  let pendingLabel = opts.parentLabel;
  let pendingMuted = opts.parentMuted;

  actions.forEach((action, index) => {
    const path = [...opts.basePath, index];
    const id = `${opts.idPrefix}-${index}`;

    opts.nodes.push({
      id,
      type: "ffNode",
      position: { x: opts.col * COL_W, y: row * ROW_H },
      data: { kind: "action", action, path },
    });
    opts.edges.push({
      id: `e-${previousId}-${id}`,
      source: previousId,
      target: id,
      label: pendingLabel,
      muted: pendingMuted,
    });
    pendingLabel = undefined;
    pendingMuted = undefined;

    if (action.kind === "condition") {
      const branchRow = row + 1;

      // Branche « alors » à gauche, « sinon » à droite. Toujours dans cet
      // ordre : la constance de la position vaut mieux qu'une optimisation
      // d'espace, l'œil apprend où regarder.
      const thenEnd = layoutChain(action.then, {
        startRow: branchRow,
        col: opts.col - 1,
        parentId: id,
        parentLabel: "si oui",
        basePath: [...path, "then"],
        nodes: opts.nodes,
        edges: opts.edges,
        idPrefix: `${id}-then`,
      });

      const elseEnd = layoutChain(action.otherwise, {
        startRow: branchRow,
        col: opts.col + 1,
        parentId: id,
        parentLabel: "si non",
        parentMuted: true,
        basePath: [...path, "otherwise"],
        nodes: opts.nodes,
        edges: opts.edges,
        idPrefix: `${id}-else`,
      });

      // Reconvergence : c'est ce qui rend le dessin fidèle au moteur, où
      // l'exécution reprend le tronc commun après la condition.
      const joinRow = Math.max(thenEnd.nextRow, elseEnd.nextRow);
      const joinId = `${id}-join`;
      opts.nodes.push({
        id: joinId,
        type: "ffNode",
        position: { x: opts.col * COL_W, y: joinRow * ROW_H },
        data: { kind: "join", label: "les deux branches se rejoignent" },
      });

      // ⚠️ BRANCHE VIDE. Une condition dont le « alors » ou le « sinon » ne
      // contient aucune action est parfaitement légitime (« si déjà client,
      // ne rien faire »). Dans ce cas `layoutChain` n'a posé aucun nœud et
      // renvoie l'id de la CONDITION elle-même.
      //
      // Deux conséquences qu'il faut traiter ici :
      //   1. les deux arêtes de reconvergence partiraient du même nœud et
      //      auraient donc le MÊME identifiant — React Flow en écarte une, et
      //      une branche disparaîtrait silencieusement du dessin ;
      //   2. le libellé « si oui » / « si non » n'aurait jamais été posé,
      //      puisqu'il est consommé par la première action de la branche.
      // D'où des identifiants préfixés par branche, et le libellé reporté sur
      // l'arête de reconvergence quand la branche est vide.
      const thenEmpty = thenEnd.lastId === id;
      const elseEmpty = elseEnd.lastId === id;

      opts.edges.push({
        id: `e-then-${id}-${joinId}`,
        source: thenEnd.lastId,
        target: joinId,
        label: thenEmpty ? "si oui" : undefined,
      });
      opts.edges.push({
        id: `e-else-${id}-${joinId}`,
        source: elseEnd.lastId,
        target: joinId,
        label: elseEmpty ? "si non" : undefined,
        muted: true,
      });

      previousId = joinId;
      row = joinRow + 1;
      return;
    }

    previousId = id;
    row += 1;
  });

  return { lastId: previousId, nextRow: row };
}

/** Construit le graphe complet d'un workflow. */
export function buildCanvasGraph(workflow: Workflow): CanvasGraph {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  const triggerId = "trigger";
  nodes.push({
    id: triggerId,
    type: "ffNode",
    position: { x: 0, y: 0 },
    data: { kind: "trigger", trigger: workflow.trigger },
  });

  const actions = workflow.actions.map((a) => a.config);
  const { lastId, nextRow } = layoutChain(actions, {
    startRow: 1,
    col: 0,
    parentId: triggerId,
    basePath: [],
    nodes,
    edges,
    idPrefix: "a",
  });

  // Nœud de fin : sans lui, un workflow se termine sur une flèche dans le
  // vide et on ne sait pas si la liste est complète ou tronquée à l'affichage.
  const endId = "end";
  nodes.push({
    id: endId,
    type: "ffNode",
    position: { x: 0, y: nextRow * ROW_H },
    data: { kind: "end" },
  });
  edges.push({ id: `e-${lastId}-${endId}`, source: lastId, target: endId });

  return { nodes, edges };
}

/** Largeur/hauteur approximatives du graphe, pour le cadrage initial. */
export function graphExtent(graph: CanvasGraph): { width: number; height: number } {
  let minX = 0;
  let maxX = 0;
  let maxY = 0;
  for (const n of graph.nodes) {
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x);
    maxY = Math.max(maxY, n.position.y);
  }
  return { width: maxX - minX + NODE_W, height: maxY + ROW_H };
}

/** Nombre total d'actions, branches comprises. Sert au libellé de l'onglet. */
export function countActions(actions: WorkflowActionConfig[]): number {
  return actions.reduce(
    (n, a) =>
      a.kind === "condition"
        ? n + 1 + countActions(a.then) + countActions(a.otherwise)
        : n + 1,
    0,
  );
}

export { chainRows };
