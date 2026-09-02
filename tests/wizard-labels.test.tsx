import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateFunnelWizard } from "@/components/funnel/CreateFunnelWizard";
import { WIZARD_DICT } from "@/lib/i18n/wizard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/store/funnelStore", () => ({
  createFunnelFromAi: vi.fn(), getStorageUsage: vi.fn(),
  FunnelStorageQuotaError: class extends Error {},
}));
vi.mock("@/components/funnel/FunnelPreview", () => ({ FunnelPreview: () => null }));
vi.mock("@/components/funnel/TemplateGalleryStep", () => ({ default: () => null }));
// Seule la sélection du format est simulée : les vrais formulaires d'offre
// vérifient que les trois champs techniques de prix gardent leur branche.
vi.mock("@/components/funnel/wizard/FunnelKindStep", () => ({
  FunnelKindStep: ({ onSelect }: { onSelect: (kind: string) => void }) => (
    <div>{["lead-magnet", "webinar", "challenge"].map((kind) => (
      <button key={kind} onClick={() => onSelect(kind)}>{kind}</button>
    ))}</div>
  ),
  WebinarDetailsFields: () => null,
}));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function enterWizard() {
  const result = render(<CreateFunnelWizard />);
  fireEvent.click(screen.getByRole("button", { name: /Pas à pas/ }));
  return result;
}

function selectStep(question: string) {
  fireEvent.click(screen.getAllByRole("button", { name: new RegExp(question.replace("?", "\\?")) })[0]);
}

describe("libellés du wizard", () => {
  it("formule toutes les étapes traduites sous forme de questions", () => {
    for (const [key, translations] of Object.entries(WIZARD_DICT)) {
      if (!key.startsWith("step.")) continue;
      for (const text of Object.values(translations)) expect(text, key).toMatch(/\?$/);
    }
  });

  it("affiche des questions dans la navigation et conserve la saisie d'audience", () => {
    const { container } = enterWizard();
    const steps = container.querySelectorAll("[data-step-index]");
    expect(steps.length).toBeGreaterThan(5);
    steps.forEach((step) => expect(step.textContent?.trim()).toMatch(/\?$/));
    selectStep("À qui vous adressez-vous ?");
    fireEvent.change(screen.getByLabelText("Quelle est votre cible principale ?"), { target: { value: "Entrepreneurs indépendants" } });
    selectStep("Quelle est votre offre ?");
    selectStep("À qui vous adressez-vous ?");
    expect(screen.getByLabelText("Quelle est votre cible principale ?")).toHaveValue("Entrepreneurs indépendants");
    expect(screen.queryByText("Client idéal")).not.toBeInTheDocument();
  });

  it.each(["lead-magnet", "webinar", "challenge"])("utilise le prix de référence dans l'offre %s sans perdre sa valeur", (kind) => {
    enterWizard();
    fireEvent.click(screen.getByRole("button", { name: kind }));
    selectStep("Quelle est votre offre ?");
    fireEvent.click(screen.getByRole("button", { name: /Quelle offre \?/ }));
    const reference = screen.getByLabelText(/Quel est le prix de référence \?/);
    fireEvent.change(reference, { target: { value: "997€" } });
    selectStep("À qui vous adressez-vous ?");
    selectStep("Quelle est votre offre ?");
    expect(screen.getByLabelText(/Quel est le prix de référence \?/)).toHaveValue("997€");
    expect(screen.queryByText(/Prix barré/i)).not.toBeInTheDocument();
  });
});
