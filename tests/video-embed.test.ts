import { describe, expect, it } from "vitest";
import { getVideoEmbed } from "@/lib/funnels/video";

describe("getVideoEmbed", () => {
  it("identifie une vidéo uploadée comme un fichier natif", () => {
    const result = getVideoEmbed("https://cdn.example.org/demo/video.mp4?version=2");
    expect(result.kind).toBe("file");
    expect(result.embedUrl).toContain("video.mp4");
  });

  it("conserve YouTube comme iframe", () => {
    const result = getVideoEmbed("https://www.youtube.com/watch?v=abcdefghijk");
    expect(result.kind).toBe("iframe");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/abcdefghijk");
  });

  it("reconnaît une URL vidéo Cloudinary même sans extension", () => {
    const result = getVideoEmbed(
      "https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/autofunnel/uploads/video-id",
    );
    expect(result.kind).toBe("file");
    expect(result.provider).toBe("url");
  });
});
