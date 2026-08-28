import { describe, expect, it } from "vitest";
import {
  buildPublishedPageRoleLookup,
  getPublishedPageRole,
  isPostConversionPageRole,
  resolvePublishedPage,
} from "@/lib/funnels/publishedPageRoles";

describe("publishedPageRoles", () => {
  it("résout le rôle depuis le snapshot même si le slug est personnalisé", () => {
    const page = resolvePublishedPage(
      {
        pages: [
          { slug: "accueil", isHome: true, role: "landing" },
          { slug: "bravo-vous-etes-inscrit", role: "confirmation" },
        ],
      },
      "bravo-vous-etes-inscrit",
    );

    expect(page).toEqual({
      slug: "bravo-vous-etes-inscrit",
      role: "confirmation",
    });
    expect(isPostConversionPageRole(page?.role)).toBe(true);
  });

  it("classe thankyou comme post-conversion mais conserve les autres rôles", () => {
    const lookup = buildPublishedPageRoleLookup([
      {
        id: "funnel-1",
        pages: [
          { slug: "offre", role: "sales" },
          { slug: "merci-personnalise", role: "thankyou" },
        ],
      },
    ]);

    expect(getPublishedPageRole(lookup, "funnel-1", "offre")).toBe("sales");
    expect(isPostConversionPageRole(getPublishedPageRole(lookup, "funnel-1", "offre"))).toBe(false);
    expect(getPublishedPageRole(lookup, "funnel-1", "merci-personnalise")).toBe("thankyou");
    expect(
      isPostConversionPageRole(
        getPublishedPageRole(lookup, "funnel-1", "merci-personnalise"),
      ),
    ).toBe(true);
  });

  it("préserve les anciens funnels mono-page comme pages de contenu", () => {
    expect(resolvePublishedPage({}, null)).toEqual({ slug: "", role: null });
    expect(resolvePublishedPage({}, "inconnue")).toBeNull();
  });
});
