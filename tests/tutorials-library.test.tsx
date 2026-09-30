import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TutorialsLibrary } from "@/components/tutorials/TutorialsLibrary";

describe("aperçu des tutoriels Tella", () => {
  it("affiche le lecteur Tella et sa miniature native avant tout clic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          tutorials: [
            {
              id: "tutorial-1",
              title: "Prendre en main AutoFunnel",
              description: "",
              videoUrl: "https://www.tella.tv/video/vid_demo/view",
              thumbnailUrl: null,
              sortOrder: 0,
              isPublished: true,
              createdAt: "2026-09-30T00:00:00.000Z",
            },
          ],
        }),
      }),
    );

    render(<TutorialsLibrary isAdmin={false} />);

    const player = await screen.findByTitle("Prendre en main AutoFunnel");
    expect(player).toHaveAttribute(
      "src",
      "https://www.tella.tv/video/vid_demo/embed",
    );
    expect(player).toHaveAttribute("loading", "lazy");
  });
});
