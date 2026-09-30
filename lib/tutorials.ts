export type Tutorial = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
};

export function tutorialFromRow(row: Record<string, unknown>): Tutorial {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    videoUrl: String(row.video_url ?? ""),
    thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    sortOrder: Number(row.sort_order ?? 0),
    isPublished: row.is_published !== false,
    createdAt: String(row.created_at ?? ""),
  };
}

export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function isTellaVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    return (
      (hostname === "tella.tv" || hostname === "www.tella.tv") &&
      parts[0] === "video" &&
      Boolean(parts[1])
    );
  } catch {
    return false;
  }
}

export function tutorialEmbedUrl(url: string): string | null {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (isTellaVideoUrl(url)) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      return `https://www.tella.tv/video/${encodeURIComponent(parts[1])}/embed`;
    }
  } catch {
    return null;
  }
  return null;
}

export function tutorialThumbnail(tutorial: Pick<Tutorial, "videoUrl" | "thumbnailUrl">): string | null {
  if (tutorial.thumbnailUrl) return tutorial.thumbnailUrl;
  const yt = youtubeId(tutorial.videoUrl);
  return yt ? `https://i.ytimg.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg` : null;
}
