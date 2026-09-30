import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanPicker } from "@/components/billing/PlanPicker";

describe("page d'abonnement", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });

  it("propose uniquement Chariow et recommande clairement le plan Pro", () => {
    render(
      <PlanPicker currentPlan={null} isActive={false} hasCustomer={false} />,
    );

    expect(screen.getByText("Recommandé pour débuter")).toBeInTheDocument();
    expect(screen.getByText("Paiement avec Chariow")).toBeInTheDocument();
    expect(screen.getAllByText("4 agents IA spécialisés sur chaque tunnel")).toHaveLength(3);
    expect(screen.getAllByText("Export systeme.io prêt en 1 clic")).toHaveLength(3);
    expect(screen.getByText("1 séquence d'emails IA / mois")).toBeInTheDocument();
    expect(screen.getByText("10 séquences d'emails IA / mois")).toBeInTheDocument();
    expect(screen.getByText("Séquences d'emails IA illimitées")).toBeInTheDocument();
    expect(screen.queryByText(/CinetPay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Stripe$/i)).not.toBeInTheDocument();
  });
});
