"use client";

import type { CSSProperties } from "react";
import type {
  DecorativeIcon,
  DecorativeIconPosition,
} from "@/lib/funnels/types";
import { IconRenderer } from "@/components/funnel/IconRenderer";

type Props = {
  icons?: DecorativeIcon[];
  filter?: DecorativeIconPosition | DecorativeIconPosition[];
};

const EDGE_POSITIONS: DecorativeIconPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "floating-bg",
];

/**
 * Styles de position de base.
 * Les coins utilisent des offsets responsifs (var CSS) pour ne pas
 * chevaucher le contenu sur mobile.
 */
const POSITION_STYLES: Record<DecorativeIconPosition, CSSProperties> = {
  "top-left": {
    position: "absolute",
    top: "var(--ff-deco-edge, 12px)",
    left: "var(--ff-deco-edge, 12px)",
  },
  "top-center": {
    position: "absolute",
    top: "var(--ff-deco-edge, 12px)",
    left: "50%",
    transform: "translateX(-50%)",
  },
  "top-right": {
    position: "absolute",
    top: "var(--ff-deco-edge, 12px)",
    right: "var(--ff-deco-edge, 12px)",
  },
  "bottom-left": {
    position: "absolute",
    bottom: "var(--ff-deco-edge, 12px)",
    left: "var(--ff-deco-edge, 12px)",
  },
  "bottom-center": {
    position: "absolute",
    bottom: "var(--ff-deco-edge, 12px)",
    left: "50%",
    transform: "translateX(-50%)",
  },
  "bottom-right": {
    position: "absolute",
    bottom: "var(--ff-deco-edge, 12px)",
    right: "var(--ff-deco-edge, 12px)",
  },
  "floating-bg": {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  // Inline (gérées séparément par <InlineDecorativeIcon>)
  "before-headline": { display: "inline-flex" },
  "after-headline": { display: "inline-flex" },
  "before-cta": { display: "inline-flex" },
  "after-cta": { display: "inline-flex" },
};

export function DecorativeIconsLayer({ icons, filter }: Props) {
  if (!icons || icons.length === 0) return null;

  const allowed = Array.isArray(filter)
    ? filter
    : filter
    ? [filter]
    : EDGE_POSITIONS;

  const visible = icons.filter((it) => allowed.includes(it.position));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((deco) => {
        const baseStyle = POSITION_STYLES[deco.position] || {};
        const isFloatingBg = deco.position === "floating-bg";
        const opacity = deco.opacity ?? (isFloatingBg ? 0.08 : 1);

        const baseTransform = (baseStyle.transform as string) || "";
        const offsetTransform =
          deco.offsetX || deco.offsetY
            ? `translate(${deco.offsetX || 0}px, ${deco.offsetY || 0}px)`
            : "";
        const rotationTransform = deco.rotation
          ? `rotate(${deco.rotation}deg)`
          : "";
        const composedTransform =
          [baseTransform, offsetTransform, rotationTransform]
            .filter(Boolean)
            .join(" ") || undefined;

        const style: CSSProperties = {
          ...baseStyle,
          transform: composedTransform,
          opacity,
          pointerEvents: isFloatingBg ? "none" : undefined,
          // ─── Lot L : z-index supérieur au contenu pour les "edge",
          // mais reste sous le contenu pour "floating-bg" (qui est un fond).
          zIndex: isFloatingBg ? 0 : 3,
        };

        const config = isFloatingBg
          ? {
              ...deco.icon,
              size: "custom" as const,
              customSizePx: deco.icon.customSizePx || 240,
            }
          : deco.icon;

        return (
          <div
            key={deco.id}
            style={style}
            className="ff-deco-icon flex items-center gap-1.5"
            aria-hidden="true"
          >
            <IconRenderer config={config} />
            {deco.label && !isFloatingBg && (
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: deco.icon.color || "var(--ff-accent, #31845C)" }}
              >
                {deco.label}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

export function InlineDecorativeIcon({
  icons,
  position,
}: {
  icons?: DecorativeIcon[];
  position: "before-headline" | "after-headline" | "before-cta" | "after-cta";
}) {
  if (!icons) return null;
  const matching = icons.filter((it) => it.position === position);
  if (matching.length === 0) return null;

  // Marges automatiques selon la position (avant/après)
  const isBefore = position.startsWith("before");
  const marginStyle: CSSProperties = isBefore
    ? { marginRight: "0.5rem" }
    : { marginLeft: "0.5rem" };

  return (
    <span
      className="inline-flex items-center align-middle"
      style={{ verticalAlign: "middle" }}
    >
      {matching.map((deco) => (
        <span
          key={deco.id}
          style={{
            ...marginStyle,
            opacity: deco.opacity ?? 1,
            transform: deco.rotation ? `rotate(${deco.rotation}deg)` : undefined,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <IconRenderer config={deco.icon} />
          {deco.label && (
            <span
              className="text-sm font-medium"
              style={{ color: deco.icon.color || "var(--ff-accent, #31845C)" }}
            >
              {deco.label}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
