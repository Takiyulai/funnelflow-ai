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

function decodeEmbedEntities(value: string): string {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

/**
 * Accepte une URL vidéo brute ou le code iframe copié depuis un hébergeur.
 * Seule l'URL http(s) est conservée : le HTML fourni n'est jamais rendu.
 */
export function normalizeTutorialVideoUrl(input: string): string | null {
  const decoded = decodeEmbedEntities(input.trim());
  if (!decoded) return null;

  const iframeSource = decoded.match(
    /<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const candidate = (iframeSource?.[1] ?? iframeSource?.[2] ?? iframeSource?.[3] ?? decoded).trim();

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function youtubeId(input: string): string | null {
  const url = normalizeTutorialVideoUrl(input);
  if (!url) return null;
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

function tellaVideoId(input: string): string | null {
  const url = normalizeTutorialVideoUrl(input);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    const isTellaHost = hostname === "tella.tv" || hostname.endsWith(".tella.tv");
    return isTellaHost && parts[0] === "video" && parts[1] ? parts[1] : null;
  } catch {
    return null;
  }
}

export function isTellaVideoUrl(input: string): boolean {
  return Boolean(tellaVideoId(input));
}

export function tutorialEmbedUrl(input: string): string | null {
  const sourceUrl = normalizeTutorialVideoUrl(input);
  if (!sourceUrl) return null;

  const yt = youtubeId(sourceUrl);
  if (yt) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`;
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    const tellaId = tellaVideoId(sourceUrl);
    if (tellaId) {
      const embed = new URL(`https://www.tella.tv/video/${encodeURIComponent(tellaId)}/embed`);
      // Conserve les options d'intégration choisies dans Tella. L'autoplay est
      // neutralisé pour ne jamais démarrer une vidéo sans action utilisateur.
      parsed.searchParams.forEach((value, key) => embed.searchParams.set(key, value));
      if (embed.searchParams.has("autoPlay")) embed.searchParams.set("autoPlay", "false");
      if (embed.searchParams.has("autoplay")) embed.searchParams.set("autoplay", "false");
      return embed.toString();
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
