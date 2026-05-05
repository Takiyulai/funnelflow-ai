// lib/funnels/video.ts
// Helper unique pour transformer une URL YouTube/Vimeo/autre en URL embed
// Utilisé par : VideoStep (déjà), FunnelPreview, app/tunnel/[slug], export HTML

export type VideoEmbed = {
  // URL prête à mettre dans un iframe src (YouTube/Vimeo) si reconnu
  embedUrl: string | null;
  // Provider détecté
  provider: "youtube" | "vimeo" | "url" | "unknown";
  // ID de la vidéo (utile pour le poster ou les analytics)
  id: string | null;
};

// Extrait l'ID YouTube depuis n'importe quel format d'URL connu
function extractYouTubeId(u: URL): string | null {
  // youtu.be/<id>
  if (u.hostname === "youtu.be") {
    const id = u.pathname.replace(/^\/+/, "").split("/")[0];
    return id || null;
  }
  // youtube.com/watch?v=<id>
  const v = u.searchParams.get("v");
  if (v) return v;
  // youtube.com/embed/<id>, /shorts/<id>, /live/<id>
  const m = u.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
  if (m) return m[2];
  return null;
}

// Extrait l'ID Vimeo (numérique)
function extractVimeoId(u: URL): string | null {
  // vimeo.com/<id> ou vimeo.com/channels/.../<id>
  const parts = u.pathname.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{5,}$/.test(parts[i])) return parts[i];
  }
  return null;
}

export function getVideoEmbed(rawUrl?: string | null): VideoEmbed {
  if (!rawUrl) return { embedUrl: null, provider: "unknown", id: null };
  const trimmed = rawUrl.trim();
  if (!trimmed) return { embedUrl: null, provider: "unknown", id: null };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { embedUrl: null, provider: "unknown", id: null };
  }

  if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
    const id = extractYouTubeId(u);
    if (id) {
      return {
        embedUrl: `https://www.youtube.com/embed/${id}`,
        provider: "youtube",
        id,
      };
    }
    return { embedUrl: null, provider: "youtube", id: null };
  }

  if (u.hostname.includes("vimeo.com") || u.hostname.includes("player.vimeo.com")) {
    const id = extractVimeoId(u);
    if (id) {
      return {
        embedUrl: `https://player.vimeo.com/video/${id}`,
        provider: "vimeo",
        id,
      };
    }
    return { embedUrl: null, provider: "vimeo", id: null };
  }

  // URL inconnue mais valide : on autorise un iframe direct uniquement en HTTPS
  if (u.protocol === "https:") {
    return { embedUrl: trimmed, provider: "url", id: null };
  }

  return { embedUrl: null, provider: "unknown", id: null };
}
