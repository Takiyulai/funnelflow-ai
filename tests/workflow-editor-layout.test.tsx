import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { WorkflowsClient } from "@/components/workflows/WorkflowsClient";
import type { Workflow } from "@/lib/workflows/types";

vi.mock("@/components/workflows/WorkflowCanvas", () => ({
  WorkflowCanvas: ({ workflow, height }: { workflow: Workflow; height: number | string }) =>
    <output data-testid="canvas" style={{ height }}>{JSON.stringify(workflow)}</output>,
}));
vi.mock("@/components/crm/EmailRichEditor", () => ({ EmailRichEditor: () => null }));
vi.mock("@/components/workflows/WorkflowRunsPanel", () => ({ WorkflowRunsPanel: () => null }));

function openEditor() {
  render(<WorkflowsClient initialWorkflows={[]} funnels={[]} sequences={[]} tags={[]} />);
  fireEvent.click(screen.getAllByRole("button", { name: /Créer un workflow/ })[0]);
  const preview = screen.getByRole("complementary", { name: "Aperçu du workflow" });
  return { preview, layout: preview.parentElement! };
}

describe("aperçu workflow côte à côte sur ordinateur", () => {
  it("place le formulaire et l'aperçu dans la même grille, sans changer l'ordre mobile", () => {
    const { preview, layout } = openEditor();
    expect(layout.children).toHaveLength(2);
    expect(within(layout.children[0] as HTMLElement).getByRole("heading", { name: "Nouveau workflow" })).toBeInTheDocument();
    expect(layout.children[1]).toBe(preview);
    expect(preview).toHaveClass("lg:sticky", "lg:top-4");
    expect(preview).not.toHaveClass("sticky");
    expect(screen.getByTestId("canvas")).toHaveStyle({ height: "var(--workflow-preview-height, 560px)" });
  });

  it("actualise immédiatement le graphe pendant l'ajout d'une action", () => {
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un tag" }));
    const workflow = JSON.parse(screen.getByTestId("canvas").textContent!);
    expect(workflow.actions).toHaveLength(1);
    expect(workflow.actions[0].config.kind).toBe("add_tag");
  });

  it("génère les deux colonnes et la hauteur adaptée uniquement à partir de 1024px", async () => {
    const { preview, layout } = openEditor();
    const result = await postcss([tailwindcss({
      content: [{ raw: `<div class="${layout.className}"><aside class="${preview.className}"></aside></div>` }],
      corePlugins: { preflight: false },
    })]).process("@tailwind utilities;", { from: undefined });
    const root = postcss.parse(result.css);
    const desktop = root.nodes.find((node) => node.type === "atrule" && node.params === "(min-width: 1024px)");
    expect(desktop?.toString()).toContain("grid-template-columns: minmax(0,1fr) minmax(0,300px)");
    expect(desktop?.toString()).toContain("position: sticky");
    expect(desktop?.toString()).toContain("--workflow-preview-height: clamp(220px, calc(100dvh - 12rem), 560px)");
    expect(root.nodes.filter((node) => node.type === "rule").map(String).join("\n")).not.toContain("grid-template-columns");
  });
});
