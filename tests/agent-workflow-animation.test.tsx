import { fireEvent, render, screen } from "@testing-library/react";
import { AgentWorkflowAnimation } from "@/components/marketing/AgentWorkflowAnimation";
import { ProductDashboardPreview } from "@/components/marketing/ProductDashboardPreview";

const members = [
  { name: "L'Analyste", role: "Stratégie", desc: "Structure le tunnel." },
  { name: "Le Rédacteur", role: "Copywriting", desc: "Rédige les textes." },
  { name: "Le Designer", role: "Mise en page", desc: "Habille les pages." },
  { name: "Le Closer", role: "Conversion & suivi", desc: "Branche le CRM." },
] as const;

describe("animation de la chaîne des agents IA", () => {
  it("conserve les agents réels et leur ordre logique", () => {
    render(<AgentWorkflowAnimation language="fr" members={members} />);
    expect(screen.getAllByRole("listitem").map(item => item.querySelector("h3")?.textContent))
      .toEqual(["L'Analyste", "Le Rédacteur", "Le Designer", "Le Closer"]);
    expect(screen.getByText("Ton offre")).toBeInTheDocument();
    expect(screen.getByText("Client acquis")).toBeInTheDocument();
  });

  it("permet de mettre la boucle en pause et de la reprendre", () => {
    render(<AgentWorkflowAnimation language="fr" members={members} />);
    const pause = screen.getByRole("button", { name: "Mettre l’animation en pause" });
    fireEvent.click(pause);
    expect(screen.getByRole("button", { name: "Reprendre l’animation" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Reprendre l’animation" }));
    expect(screen.getByRole("button", { name: "Mettre l’animation en pause" })).toHaveAttribute("aria-pressed", "false");
  });

  it("remplace le contenu visible sans changer le composant-cadre", () => {
    render(<ProductDashboardPreview language="fr" caption="Parcours des agents"><p>Nouveau contenu</p></ProductDashboardPreview>);
    expect(screen.getByRole("figure", { name: "Parcours des agents" })).toContainElement(screen.getByText("Nouveau contenu"));
    expect(screen.getByText("Votre activité, au même endroit.").closest("[aria-hidden=true]")).not.toBeNull();
  });
});
