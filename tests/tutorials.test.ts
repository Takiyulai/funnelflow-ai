import { describe, expect, it } from "vitest";
import {
  isTellaVideoUrl,
  normalizeTutorialVideoUrl,
  sortTutorialsOldestFirst,
  tutorialEmbedUrl,
} from "@/lib/tutorials";

describe("tutorial video helpers", () => {
  it("convertit un lien public Tella en lecteur intégré", () => {
    expect(tutorialEmbedUrl("https://www.tella.tv/video/vid_demo/view")).toBe(
      "https://www.tella.tv/video/vid_demo/embed",
    );
  });

  it("accepte le code iframe copié depuis Tella", () => {
    const iframe = '<iframe src="https://www.tella.tv/video/vid_demo/embed?a=1&amp;autoPlay=true" allowfullscreen></iframe>';

    expect(normalizeTutorialVideoUrl(iframe)).toBe(
      "https://www.tella.tv/video/vid_demo/embed?a=1&autoPlay=true",
    );
    expect(tutorialEmbedUrl(iframe)).toBe(
      "https://www.tella.tv/video/vid_demo/embed?a=1&autoPlay=false",
    );
    expect(isTellaVideoUrl(iframe)).toBe(true);
  });

  it("refuse les domaines qui imitent Tella", () => {
    expect(isTellaVideoUrl("https://tella.tv.example.com/video/demo/view")).toBe(false);
  });

  it("transforme aussi les anciens liens Tella avec slug", () => {
    expect(tutorialEmbedUrl("https://www.tella.tv/video/mon-tutoriel-abc1")).toBe(
      "https://www.tella.tv/video/mon-tutoriel-abc1/embed",
    );
  });

  it("continue de prendre en charge YouTube", () => {
    expect(tutorialEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(tutorialEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("refuse un protocole non web", () => {
    expect(normalizeTutorialVideoUrl("javascript:alert(1)")).toBeNull();
    expect(tutorialEmbedUrl("javascript:alert(1)")).toBeNull();
  });

  it("affiche les tutoriels du plus ancien ajouté au plus récent", () => {
    const common = {
      description: "",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      thumbnailUrl: null,
      sortOrder: 0,
      isPublished: true,
    };
    const ordered = sortTutorialsOldestFirst([
      { ...common, id: "recent", title: "Récent", createdAt: "2026-10-02T10:00:00.000Z" },
      { ...common, id: "old", title: "Ancien", createdAt: "2026-09-01T10:00:00.000Z" },
      { ...common, id: "middle", title: "Intermédiaire", createdAt: "2026-09-15T10:00:00.000Z" },
    ]);

    expect(ordered.map((tutorial) => tutorial.id)).toEqual([
      "old",
      "middle",
      "recent",
    ]);
  });
});
