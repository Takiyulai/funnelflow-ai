import { afterEach, describe, expect, it, vi } from "vitest";
import type { FunnelBrief } from "@/lib/funnels/types";
import {
  prepareWizardBriefForGeneration,
  WizardMediaUploadError,
} from "@/lib/media/prepareWizardBrief";

function makeBrief(patch: Partial<FunnelBrief> = {}): FunnelBrief {
  return {
    brandName: "Marque",
    offerName: "Offre",
    price: "0",
    targetAudience: "Audience",
    mainPain: "Problème",
    promise: "Promesse",
    tone: "direct",
    funnelType: "Lead magnet",
    designStyle: "modern",
    language: "fr",
    ...patch,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prepareWizardBriefForGeneration", () => {
  it("conserve le brief intact lorsqu'il ne contient que des URL distantes", async () => {
    const brief = makeBrief({
      logoUrl: "https://cdn.example/logo.png",
      medias: [
        {
          id: "media-1",
          kind: "image",
          url: "https://cdn.example/photo.png",
        },
      ],
    });

    const result = await prepareWizardBriefForGeneration(brief);

    expect(result).toBe(brief);
  });

  it("remplace le logo et les médias inline par les URL retournées par l'upload", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      const spotId = String(form.get("spotId"));
      return {
        ok: true,
        json: async () => ({ url: `https://cdn.example/${spotId}` }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const brief = makeBrief({
      logoUrl: "data:image/png;base64,aGVsbG8=",
      medias: [
        {
          id: "media-1",
          kind: "image",
          url: "data:image/png;base64,d29ybGQ=",
          fileName: "photo.png",
        },
        {
          id: "media-2",
          kind: "video",
          url: "https://cdn.example/video.mp4",
        },
      ],
    });

    const result = await prepareWizardBriefForGeneration(brief);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.logoUrl).toBe("https://cdn.example/brief-logo");
    expect(result.medias?.[0].url).toBe("https://cdn.example/brief-media-media-1");
    expect(result.medias?.[1]).toBe(brief.medias?.[1]);
  });

  it("retourne une erreur contrôlée si l'upload échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) } as Response)),
    );

    await expect(
      prepareWizardBriefForGeneration(
        makeBrief({ logoUrl: "data:image/png;base64,aGVsbG8=" }),
      ),
    ).rejects.toBeInstanceOf(WizardMediaUploadError);
  });
});
