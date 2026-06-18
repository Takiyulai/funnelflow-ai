"use client";

import { Star } from "lucide-react";
import type {
  FunnelSection,
  SectionItem,
  TestimonialMedia,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  bodySize?: string;
  compact?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Parsing vidéo robuste (partagé conceptuellement avec lib/export/html.ts)
// Retourne :
//   - { kind: "iframe", src } pour YouTube / Vimeo / inconnu
//   - { kind: "file",   src } pour mp4 / webm / mov / ogg
// ─────────────────────────────────────────────────────────────────────────────
type ParsedVideo = { kind: "iframe" | "file"; src: string } | null;

function parseVideoUrl(raw: string): ParsedVideo {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // Fichier direct : mp4, webm, mov, ogg, m4v
  if (/\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(url)) {
    return { kind: "file", src: url };
  }

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be"
  ) {
    let id = "";
    if (host === "youtu.be") {
      id = u.pathname.replace(/^\//, "").split("/")[0];
    } else if (u.pathname.startsWith("/shorts/")) {
      id = u.pathname.replace("/shorts/", "").split("/")[0];
    } else if (u.pathname.startsWith("/embed/")) {
      id = u.pathname.replace("/embed/", "").split("/")[0];
    } else if (u.pathname.startsWith("/live/")) {
      id = u.pathname.replace("/live/", "").split("/")[0];
    } else if (u.pathname === "/watch") {
      id = u.searchParams.get("v") || "";
    }
    if (!id) return null;

    const params = new URLSearchParams();
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (t) {
      const sec = /^\d+$/.test(t)
        ? t
        : String(
            parseInt(/(\d+)h/.exec(t)?.[1] || "0", 10) * 3600 +
              parseInt(/(\d+)m/.exec(t)?.[1] || "0", 10) * 60 +
              parseInt(/(\d+)s/.exec(t)?.[1] || "0", 10),
          );
      if (sec && sec !== "0") params.set("start", sec);
    }
    const qs = params.toString();
    return {
      kind: "iframe",
      src: `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ""}`,
    };
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segs = u.pathname.split("/").filter(Boolean);
    if (host === "player.vimeo.com") {
      // /video/123456 ou /video/123456/abcdef
      const vIdx = segs.indexOf("video");
      if (vIdx >= 0 && segs[vIdx + 1]) {
        const id = segs[vIdx + 1];
        const hash = segs[vIdx + 2];
        return {
          kind: "iframe",
          src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`,
        };
      }
      return null;
    }
    // vimeo.com/123456 ou vimeo.com/123456/abcdef
    const id = segs[0];
    const hash = segs[1];
    if (!id || !/^\d+$/.test(id)) return null;
    return {
      kind: "iframe",
      src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`,
    };
  }

  // Fallback : iframe brute
  return { kind: "iframe", src: url };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu d'un média individuel
// Utilise les classes `ff-testimonial-media*` pour partager exactement
// les mêmes styles entre preview et export Systeme.io (cf. funnel-theme.css).
// ─────────────────────────────────────────────────────────────────────────────
function MediaCard({ media }: { media: TestimonialMedia }) {
  if (!media.url) return null;

  if (media.kind === "image") {
    return (
      <div className="ff-testimonial-media ff-testimonial-media--image">
        <img src={media.url} alt={media.alt || ""} loading="lazy" />
      </div>
    );
  }

  const parsed = parseVideoUrl(media.url);
  if (!parsed) return null;

  if (parsed.kind === "file") {
    return (
      <div className="ff-testimonial-media ff-testimonial-media--video">
        <video controls preload="metadata" poster={media.posterUrl}>
          <source src={parsed.src} />
        </video>
      </div>
    );
  }

  return (
    <div className="ff-testimonial-media ff-testimonial-media--video">
      <div className="ff-testimonial-media-frame">
        <iframe
          src={parsed.src}
          title={media.alt || "Témoignage vidéo"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Galerie des médias d'un témoignage (grille adaptative)
// Le nombre de colonnes est défini par la classe ff-tm-cols-{1|2|3}
// (gérée dans funnel-theme.css + responsive mobile/tablette).
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialMediaGallery({ medias }: { medias: TestimonialMedia[] }) {
  const list = medias.filter((m) => !!m.url);
  if (list.length === 0) return null;

  const colsCls =
    list.length === 1
      ? "ff-tm-cols-1"
      : list.length === 2
        ? "ff-tm-cols-2"
        : "ff-tm-cols-3";

  return (
    <div className={`ff-testimonial-media-gallery ${colsCls}`}>
      {list.map((m) => (
        <MediaCard key={m.id} media={m} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────
export function TestimonialsRenderer({
  section,
  bodySize = "text-base",
  compact,
}: Props) {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "testimonial" } =>
      it.kind === "testimonial",
  );

  if (items.length === 0) return null;

  // 🆕 Grille auto-fit avec largeur MINIMALE de carte : les colonnes ne
  // deviennent jamais trop étroites (le bug « cartes compactes » venait de
  // 3 colonnes forcées dans l'aperçu desktop réduit). À une carte → centrée.
  const gridStyle: React.CSSProperties =
    items.length === 1
      ? { gridTemplateColumns: "minmax(0, 520px)", justifyContent: "center" }
      : { gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" };

  return (
    <div
      className="ff-testimonials grid gap-5 md:gap-6 mt-10"
      style={gridStyle}
      data-ff-anim={section.animations?.bullets ?? "fade-up"}
    >
      {items.map((item, idx) => {
        const initials = (item.data.authorName || "?")
          .split(" ")
          .map((s) => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();

        const medias = item.data.medias ?? [];

        return (
          <div
            key={idx}
            className={`ff-testimonial-card ff-card relative rounded-2xl ${compact ? "p-5" : "p-6"} transition-all duration-500 hover:-translate-y-2 flex flex-col group`}
          >
            {/* Elegant Quote Mark */}
            <div className="absolute top-6 right-8 opacity-10 transition-opacity group-hover:opacity-20">
              <svg
                width="40"
                height="30"
                viewBox="0 0 40 30"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0 17.5C0 7.8 7.2 0 16.1 0V7.5C11.5 7.5 7.9 10.9 7.9 15.3H16.1V30H0V17.5ZM23.9 17.5C23.9 7.8 31.1 0 40 0V7.5C35.4 7.5 31.8 10.9 31.8 15.3H40V30H23.9V17.5Z" />
              </svg>
            </div>

            {/* 🆕 Médias additionnels (preuves) : AU-DESSUS de la citation */}
            {medias.length > 0 && <TestimonialMediaGallery medias={medias} />}

            {item.data.rating && item.data.rating > 0 && (
              <div className="mb-6 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="h-3.5 w-3.5"
                    fill={
                      n <= (item.data.rating || 0) ? "currentColor" : "none"
                    }
                    style={{ color: "var(--ff-accent, #f59e0b)" }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}

            {item.data.quote && (
              <blockquote
                className={`${bodySize} mb-8 leading-relaxed flex-1 font-medium italic opacity-90`}
                style={{ color: "var(--ff-ink)" }}
              >
                « {item.data.quote} »
              </blockquote>
            )}

            <div className="flex items-center gap-4 mt-auto pt-6 border-t border-[var(--ff-border)]/10">
              {item.data.avatarUrl ? (
                <div className="relative">
                  <img
                    src={item.data.avatarUrl}
                    alt={item.data.authorName || ""}
                    className="h-12 w-12 rounded-full object-cover shrink-0 ring-2 ring-[var(--ff-accent)]/20"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 rounded-full shadow-inner pointer-events-none"></div>
                </div>
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-[13px] font-bold shrink-0 ring-2 ring-[var(--ff-accent)]/20"
                  style={{
                    background: "var(--ff-accent)",
                    color: "var(--ff-accent-ink, #ffffff)",
                  }}
                  aria-hidden="true"
                >
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {item.data.authorName && (
                  <div
                    className="text-sm font-bold truncate tracking-tight"
                    style={{ color: "var(--ff-ink)" }}
                  >
                    {item.data.authorName}
                  </div>
                )}
                {item.data.authorRole && (
                  <div
                    className="text-xs truncate font-medium"
                    style={{
                      color: "var(--ff-ink-soft, var(--ff-ink))",
                      opacity: 0.6,
                    }}
                  >
                    {item.data.authorRole}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
