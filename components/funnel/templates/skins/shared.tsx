"use client";

// Briques partagées des skins de templates (rendu bespoke data-driven).

import { useEffect, useState, type ReactNode } from "react";
import type {
  FunnelSection,
  SectionColors,
  TimerItem,
} from "@/lib/funnels/types";
import { getMedia, IDB_MEDIA_PREFIX } from "@/lib/store/mediaStore";

/* ─── Couleurs de section (copie de la logique FunnelPreview) ──────────── */

export function skinSectionColors(section: FunnelSection): SectionColors {
  const style = (section.style ?? {}) as {
    colors?: SectionColors;
    userColorsOverride?: boolean;
  };
  const colors: SectionColors = style.colors ?? {};
  if (style.userColorsOverride) return colors;

  const hasExplicitBg =
    typeof colors.bg === "string" && colors.bg.trim().length > 0;
  if (hasExplicitBg) return colors;

  const { bg: _ignored, ...rest } = colors;
  return rest;
}

/* ─── Résolution du fond de section (image uploadée) ───────────────────────
 * Copie de la logique de FunnelPreview.useResolvedBackgroundUrl : une image
 * uploadée est stockée en data-URL en mémoire, puis externalisée vers
 * IndexedDB ("idb-media://…") à la sauvegarde. On résout la référence IDB en
 * data-URL affichable de façon asynchrone. Sans ça, les skins de templates
 * ignoraient totalement `section.background` → l'image de fond n'apparaissait
 * jamais (« c'est le template qui l'empêche »). */
function useResolvedBackgroundUrl(rawUrl: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(
    rawUrl && !rawUrl.startsWith(IDB_MEDIA_PREFIX) ? rawUrl : undefined,
  );
  useEffect(() => {
    let cancelled = false;
    if (!rawUrl) {
      setResolved(undefined);
      return;
    }
    if (!rawUrl.startsWith(IDB_MEDIA_PREFIX)) {
      setResolved(rawUrl);
      return;
    }
    getMedia(rawUrl.slice(IDB_MEDIA_PREFIX.length))
      .then((data) => {
        if (!cancelled) setResolved(data ?? undefined);
      })
      .catch(() => {
        if (!cancelled) setResolved(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [rawUrl]);
  return resolved;
}

/* ─── Shell de section : conserve les attributs data-ff-* (click-to-edit,
 *     thème, export) et applique les overrides de couleurs utilisateur. ── */

export function SkinSection({
  section,
  children,
  className,
  maxWidth = 1180,
  style,
}: {
  section: FunnelSection;
  children: ReactNode;
  className?: string;
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  const colors = skinSectionColors(section);

  // 🆕 Fond de section (image uploadée) — désormais respecté par les skins.
  const bg = section.background;
  const resolvedBgUrl = useResolvedBackgroundUrl(bg?.imageUrl);
  const rawUsable =
    bg?.imageUrl && !bg.imageUrl.startsWith(IDB_MEDIA_PREFIX)
      ? bg.imageUrl
      : undefined;
  const finalBgUrl = resolvedBgUrl ?? rawUsable;
  const hasBgImage = !!finalBgUrl;
  const overlayColor = bg?.overlayColor ?? "#000000";
  const overlayOpacity =
    typeof bg?.overlayOpacity === "number"
      ? Math.min(100, Math.max(0, bg.overlayOpacity))
      : typeof bg?.overlay === "number"
        ? Math.min(100, Math.max(0, bg.overlay * 100))
        : 0;

  const bgStyle: React.CSSProperties = hasBgImage
    ? {
        backgroundImage: `url("${finalBgUrl}")`,
        backgroundSize: bg?.size ?? "cover",
        backgroundPosition: bg?.position ?? "center",
        backgroundRepeat: "no-repeat",
        ...(bg?.attachment === "fixed"
          ? { backgroundAttachment: "fixed" as const }
          : {}),
      }
    : {};

  return (
    <section
      id={section.id || section.type}
      data-ff-section={section.type}
      data-ff-section-id={section.id}
      data-ff-skin="true"
      data-ff-has-bg-image={hasBgImage ? "true" : undefined}
      className={`t1-sec relative ${className ?? ""}`}
      style={{
        ...(colors.bg ? { backgroundColor: colors.bg } : {}),
        ...(colors.ink ? { color: colors.ink } : {}),
        ...(colors.accent
          ? ({ ["--ff-accent" as string]: colors.accent } as React.CSSProperties)
          : {}),
        ...bgStyle,
        ...style,
      }}
    >
      {hasBgImage && overlayOpacity > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: overlayColor,
            opacity: overlayOpacity / 100,
            zIndex: 0,
          }}
        />
      )}
      <div
        className="relative"
        style={{ maxWidth, margin: "0 auto", padding: "0 24px", zIndex: 1 }}
      >
        {children}
      </div>
    </section>
  );
}

/* ─── Helpers contenu ──────────────────────────────────────────────────── */

/** "Titre | description" (ou — – ::) → { title, description } sinon null. */
export function splitTitleDesc(
  raw: string,
): { title: string; description: string } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(.+?)\s*(?:\||—|–|::)\s*(.+?)\s*$/);
  if (!m) return null;
  const title = m[1].trim();
  const description = m[2].trim();
  if (!title || !description) return null;
  return { title, description };
}

/** Retire la syntaxe de surlignage [[texte|#hex]] → texte brut. */
export function stripHighlights(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1").trim();
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstTimer(section: FunnelSection): TimerItem | undefined {
  if (!Array.isArray(section.items)) return undefined;
  const it = section.items.find((i) => i.kind === "timer");
  return it && it.kind === "timer" ? it.data : undefined;
}

/** Cible du countdown (attribut data-target du runtime d'animations). */
export function timerTarget(timer: TimerItem | undefined): string | undefined {
  if (!timer) return undefined;
  if (timer.mode === "countdown-date" && timer.targetDate) {
    return timer.targetDate;
  }
  if (timer.mode === "countdown-duration" && timer.durationHours) {
    return String(timer.durationHours * 3600); // secondes → géré par le hook
  }
  return undefined;
}
