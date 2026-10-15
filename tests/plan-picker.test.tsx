import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanPicker } from "@/components/billing/PlanPicker";

describe("page d'abonnement", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CHARIOW_URL_PRO = "https://checkout.example.test/pro";
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });

  it("propose un parcours Afrique prioritaire sans exposer les prestataires", () => {
    render(
      <PlanPicker
        currentPlan={null}
        isActive={false}
        hasCustomer={false}
        initialPaymentRegion="africa"
      />,
    );

    expect(screen.getByText("Recommandé pour débuter")).toBeInTheDocument();
    expect(screen.getByText("Choisis ton moyen de paiement")).toBeInTheDocument();
    expect(screen.getByText("Paiement depuis l'Afrique")).toBeInTheDocument();
    expect(screen.getByText("Paiement international")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Payer depuis l'Afrique/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Payer depuis l'international/i })).toBeInTheDocument();
    expect(screen.getByText(/39\s*000 F CFA/)).toBeInTheDocument();
    expect(screen.getByText("59 € / mois")).toBeInTheDocument();
    expect(screen.getAllByText("Recommandé pour toi")).toHaveLength(1);
    expect(screen.queryByText(/SasPay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chariow/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("4 expertises réunies (stratégie, textes, design et suivi)")).toHaveLength(4);
    expect(screen.getAllByText("Export systeme.io prêt en 1 clic")).toHaveLength(3);
    expect(screen.getByText("1 séquence d'emails prête à l'envoi / mois")).toBeInTheDocument();
    expect(screen.getByText("10 séquences d'emails prêtes à l'envoi / mois")).toBeInTheDocument();
    expect(screen.getByText("Séquences d'emails prêtes à l'envoi illimitées")).toBeInTheDocument();
    expect(screen.queryByText(/CinetPay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Stripe$/i)).not.toBeInTheDocument();
  });

  it("recommande visuellement le paiement international hors d'Afrique", () => {
    render(
      <PlanPicker
        currentPlan={null}
        isActive={false}
        hasCustomer={false}
        initialPaymentRegion="international"
      />,
    );

    const internationalCard = screen
      .getByText("Paiement international")
      .closest("div.rounded-2xl");
    expect(internationalCard).toHaveTextContent("Recommandé pour toi");
    expect(screen.getAllByText("Recommandé pour toi")).toHaveLength(1);
  });
});
