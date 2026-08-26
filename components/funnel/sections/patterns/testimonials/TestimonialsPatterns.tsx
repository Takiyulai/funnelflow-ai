"use client";

// Patterns TÉMOIGNAGES (zip Claude Design) → composants React color-aware.
// 4 variantes : testimonials-3cards-grid, testimonials-2x2-stars-date,
// testimonials-list-quotes, testimonials-carousel-video.
// Données normalisées en TItem[] par TestimonialsRenderer (découplé du modèle).
// Contenu SEUL : la <section>/fond/padding viennent du wrapper de FunnelPreview.

import { useRef, type ComponentType, type CSSProperties } from "react";
import type { FunnelSection, TestimonialMedia } from "@/lib/funnels/types";
import { RichText } from "@/components/funnel/RichText";

export type TItem = {
  quote: string;
  authorName?: string;
  authorRole?: string;
  avatarUrl?: string;
  rating?: number;
  medias?: TestimonialMedia[];
  videoUrl?: string;
};

export type TestimonialsPatternProps = {
  section: FunnelSection;
  items: TItem[];
  mode?: "preview" | "public";
};

function Header({ section }: { section: FunnelSection }) {
  if (!section.headline && !section.subheadline) return null;
  return (
    <div data-ff-anim="fade-up" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
      {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} />}
      {section.subheadline && (
        <div style={{ marginTop: 12 }}>
          <RichText as="p" className="ff-subheadline" text={section.subheadline} />
        </div>
      )}
    </div>
  );
}

function Stars({ n = 5 }: { n?: number }) {
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <div aria-hidden="true" style={{ display: "flex", gap: 2, color: "var(--ff-accent)", fontSize: 15 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ opacity: i <= full ? 1 : 0.25 }}>★</span>
      ))}
    </div>
  );
}

function getItemState(it: TItem) {
  const medias = (it.medias ?? []).filter((media) => Boolean(media.url?.trim()));
  const hasQuote = Boolean(it.quote?.trim());
  const hasRating = typeof it.rating === "number" && it.rating > 0;
  const hasAuthor = Boolean(it.authorName?.trim());
  const hasAvatar = Boolean(it.avatarUrl?.trim());
  const hasRole = Boolean(it.authorRole?.trim());
  const hasAttribution = hasAuthor || hasAvatar || hasRole;
  const hasMedia = medias.length > 0;
  return {
    medias,
    hasQuote,
    hasRating,
    hasAuthor,
    hasAvatar,
    hasRole,
    hasAttribution,
    hasMedia,
    isMediaOnly: hasMedia && !hasQuote && !hasRating && !hasAttribution,
  };
}

function Avatar({ name, url }: { name?: string; url?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || ""}
        loading="lazy"
        style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  if (!name?.trim()) return null;
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--ff-accent)",
        color: "var(--ff-accent-ink, #fff)",
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {initials}
    </span>
  );
}

function Attribution({ it }: { it: TItem }) {
  const { hasAuthor, hasAvatar, hasRole, hasAttribution } = getItemState(it);
  if (!hasAttribution) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
      {(hasAvatar || hasAuthor) && <Avatar name={it.authorName} url={it.avatarUrl} />}
      {(hasAuthor || hasRole) && <div style={{ minWidth: 0 }}>
        {it.authorName && (
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ff-ink)" }}>{it.authorName}</div>
        )}
        {it.authorRole && (
          <div style={{ fontSize: 12.5, color: "var(--ff-ink)", opacity: 0.6 }}>{it.authorRole}</div>
        )}
      </div>}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ff-card-bg, #fff)",
  border: "1px solid var(--ff-card-border, var(--ff-border, rgba(0,0,0,.1)))",
  borderRadius: 16,
  padding: "24px 24px",
  boxShadow: "0 10px 30px rgba(0,0,0,.08)",
  display: "flex",
  flexDirection: "column",
};

function cardStyle(it: TItem): React.CSSProperties {
  return getItemState(it).isMediaOnly
    ? { ...card, padding: 0, overflow: "hidden" }
    : card;
}

function Quote({ children }: { children: string }) {
  if (!children.trim()) return null;
  return (
    <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "var(--ff-ink)", opacity: 0.88, fontStyle: "italic" }}>
      « {children} »
    </p>
  );
}

// ── Pattern 1 : 3 cartes en grille ────────────────────────────────────────────
function Testimonials3CardsGrid({ section, items }: TestimonialsPatternProps) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Header section={section} />
      <div className="ff-tm-grid3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={cardStyle(it)} className={getItemState(it).isMediaOnly ? "ff-testimonial-card--media-only" : undefined}>
            {getItemState(it).isMediaOnly && <PatternMediaGallery medias={getItemState(it).medias} />}
            {getItemState(it).hasRating ? <div style={{ marginBottom: 12 }}><Stars n={it.rating} /></div> : null}
            <Quote>{it.quote}</Quote>
            <Attribution it={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 2 : grille 2×2, étoiles + « avis vérifié » ────────────────────────
function Testimonials2x2StarsDate({ section, items }: TestimonialsPatternProps) {
  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      <Header section={section} />
      <div className="ff-tm-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {items.map((it, i) => (
          <div key={i} data-ff-anim="fade-up" data-ff-anim-index={i} style={cardStyle(it)} className={getItemState(it).isMediaOnly ? "ff-testimonial-card--media-only" : undefined}>
            {getItemState(it).isMediaOnly && <PatternMediaGallery medias={getItemState(it).medias} />}
            {getItemState(it).hasRating && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <Stars n={it.rating} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ff-accent)", opacity: 0.85 }}>Avis vérifié ✓</span>
              </div>
            )}
            <Quote>{it.quote}</Quote>
            <Attribution it={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 3 : liste de citations (blockquotes empilées) ─────────────────────
function TestimonialsListQuotes({ section, items }: TestimonialsPatternProps) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Header section={section} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {items.map((it, i) => (
          <blockquote
            key={i}
            data-ff-anim="fade-up"
            data-ff-anim-index={i}
            className={getItemState(it).isMediaOnly ? "ff-testimonial-card--media-only" : undefined}
            style={getItemState(it).isMediaOnly
              ? { margin: 0, padding: 0, overflow: "hidden", borderRadius: 16 }
              : {
                  margin: 0,
                  padding: "0 0 0 22px",
                  borderLeft: "3px solid var(--ff-accent)",
                }}
          >
            {getItemState(it).isMediaOnly && <PatternMediaGallery medias={getItemState(it).medias} />}
            {getItemState(it).hasRating ? <div style={{ marginBottom: 10 }}><Stars n={it.rating} /></div> : null}
            {getItemState(it).hasQuote && (
              <p style={{ margin: 0, fontSize: 19, lineHeight: 1.55, color: "var(--ff-ink)", fontWeight: 500 }}>
                « {it.quote} »
              </p>
            )}
            <Attribution it={it} />
          </blockquote>
        ))}
      </div>
    </div>
  );
}

// ── Pattern 4 : carrousel vidéo (scroll horizontal + prev/next) ───────────────
function embedSrc(url: string): { kind: "iframe" | "file"; src: string } | null {
  const u = (url || "").trim();
  if (!u) return null;
  if (/\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(u)) return { kind: "file", src: u };
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  return { kind: "iframe", src: u };
}

function PatternMediaGallery({ medias }: { medias: TestimonialMedia[] }) {
  const list = medias.filter((media) => Boolean(media.url?.trim()));
  if (list.length === 0) return null;
  const colsClass = list.length === 1
    ? "ff-tm-cols-1"
    : list.length === 2
      ? "ff-tm-cols-2"
      : "ff-tm-cols-3";

  return (
    <div className={`ff-testimonial-media-gallery ${colsClass}`}>
      {list.map((media, index) => {
        if (media.kind === "image") {
          return (
            <div key={media.id} className="ff-testimonial-media ff-testimonial-media--image" data-ff-anim="zoom-in" data-ff-anim-index={index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt={media.alt || ""} loading="lazy" />
            </div>
          );
        }

        const parsed = embedSrc(media.url);
        if (!parsed) return null;
        return (
          <div key={media.id} className="ff-testimonial-media ff-testimonial-media--video" data-ff-anim="zoom-in" data-ff-anim-index={index}>
            {parsed.kind === "file" ? (
              <video controls preload="metadata" poster={media.posterUrl}>
                <source src={parsed.src} />
              </video>
            ) : (
              <div className="ff-testimonial-media-frame">
                <iframe
                  src={parsed.src}
                  title={media.alt || "Témoignage vidéo"}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VideoCard({ it, index }: { it: TItem; index: number }) {
  const state = getItemState(it);
  const v = it.videoUrl ? embedSrc(it.videoUrl) : null;
  return (
    <div
      data-ff-anim="fade-up"
      data-ff-anim-index={index}
      className={state.isMediaOnly ? "ff-testimonial-card--media-only" : undefined}
      style={{
        ...card,
        scrollSnapAlign: "start",
        flex: "0 0 300px",
        width: 300,
        padding: state.isMediaOnly ? 0 : 14,
        gap: state.isMediaOnly ? 0 : 12,
        ...(state.isMediaOnly ? { overflow: "hidden" } : {}),
      }}
    >
      {state.isMediaOnly ? (
        <PatternMediaGallery medias={state.medias} />
      ) : v ? <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--ff-ink) 12%, transparent)" }}>
        {v?.kind === "iframe" ? (
          <iframe
            src={v.src}
            title={it.authorName || "Témoignage vidéo"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        ) : v?.kind === "file" ? (
          <video controls preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}>
            <source src={v.src} />
          </video>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ff-accent)", fontSize: 30 }}>▶</div>
        )}
      </div> : (
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--ff-ink) 12%, transparent)" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ff-accent)", fontSize: 30 }}>▶</div>
        </div>
      )}
      {state.hasQuote && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ff-ink)", opacity: 0.85, fontStyle: "italic" }}>« {it.quote} »</p>
      )}
      <Attribution it={it} />
    </div>
  );
}

function TestimonialsCarouselVideo({ section, items }: TestimonialsPatternProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => {
    trackRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 26, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 560 }}>
          {section.headline && <RichText as="h2" className="ff-headline" text={section.headline} />}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" aria-label="Précédent" onClick={() => scrollBy(-1)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--ff-card-border, rgba(0,0,0,.15))", background: "var(--ff-card-bg, #fff)", color: "var(--ff-ink)", cursor: "pointer" }}>←</button>
          <button type="button" aria-label="Suivant" onClick={() => scrollBy(1)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--ff-card-border, rgba(0,0,0,.15))", background: "var(--ff-card-bg, #fff)", color: "var(--ff-ink)", cursor: "pointer" }}>→</button>
        </div>
      </div>
      <div
        ref={trackRef}
        style={{ display: "flex", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 8, scrollbarWidth: "none" }}
      >
        {items.map((it, i) => (
          <VideoCard key={i} it={it} index={i} />
        ))}
      </div>
    </div>
  );
}

export const TESTIMONIALS_PATTERNS: Record<string, ComponentType<TestimonialsPatternProps>> = {
  "testimonials-3cards-grid": Testimonials3CardsGrid,
  "testimonials-2x2-stars-date": Testimonials2x2StarsDate,
  "testimonials-list-quotes": TestimonialsListQuotes,
  "testimonials-carousel-video": TestimonialsCarouselVideo,
};
