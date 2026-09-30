import { describe, expect, it } from "vitest";
import { isTellaVideoUrl, tutorialEmbedUrl } from "@/lib/tutorials";

describe("liens vidéo des tutoriels", () => {
  it("transforme un lien de partage Tella récent en lecteur intégré", () => {
    expect(
      isTellaVideoUrl("https://www.tella.tv/video/vid_cmkpivk0a031j04lh3yydgcq2/view"),
    ).toBe(true);
    expect(
      tutorialEmbedUrl("https://www.tella.tv/video/vid_cmkpivk0a031j04lh3yydgcq2/view"),
    ).toBe("https://www.tella.tv/video/vid_cmkpivk0a031j04lh3yydgcq2/embed");
  });

  it("refuse les domaines qui imitent Tella", () => {
    expect(isTellaVideoUrl("https://tella.tv.example.com/video/demo/view")).toBe(false);
  });

  it("transforme aussi les anciens liens Tella avec slug", () => {
    expect(tutorialEmbedUrl("https://www.tella.tv/video/mon-tutoriel-abc1")).toBe(
      "https://www.tella.tv/video/mon-tutoriel-abc1/embed",
    );
  });

  it("conserve la prise en charge de YouTube et Vimeo", () => {
    expect(tutorialEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(tutorialEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });
});
