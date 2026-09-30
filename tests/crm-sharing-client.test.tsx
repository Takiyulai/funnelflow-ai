import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrmSharingClient } from "@/components/crm/CrmSharingClient";

describe("consultation d'un CRM partagé", () => {
  it("affiche les listes et les tags indépendamment du forfait du destinataire", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          granted: [],
          received: [
            {
              id: "share-1",
              permission: "read_only",
              createdAt: "2026-09-30T00:00:00.000Z",
              owner: { id: "owner-1", email: "owner@example.com", full_name: "Compte partagé" },
              grantee: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          snapshot: {
            owner: { id: "owner-1", email: "owner@example.com", full_name: "Compte partagé" },
            totalContacts: 1,
            contacts: [],
            lists: [
              { id: "list-1", name: "Prospects webinaire", color: "#2563EB", description: "Inscrits au webinaire" },
            ],
            tags: [{ id: "tag-1", name: "À relancer", color: "#DC2626" }],
            limit: 200,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<CrmSharingClient />);

    fireEvent.click(await screen.findByRole("button", { name: /Voir/i }));

    expect(await screen.findByText("Listes partagées (1)")).toBeInTheDocument();
    expect(screen.getByText("Prospects webinaire")).toBeInTheDocument();
    expect(screen.getByText("Tags partagés (1)")).toBeInTheDocument();
    expect(screen.getByText("À relancer")).toBeInTheDocument();
    expect(
      screen.getByText(/Le forfait du destinataire ne limite pas cette consultation/i),
    ).toBeInTheDocument();
  });
});
