"use client";

import type { FunnelSection, SectionItem } from "@/lib/funnels/types";
import { getIconByName } from "@/components/editor/IconPicker";

type Props = {
  section: FunnelSection;
  bodySize?: string;
  compact?: boolean;
};

export function BonusRenderer({ section, bodySize = "text-base", compact }: Props) {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "bonus" } => it.kind === "bonus"
  );

  if (items.length === 0) return null;

  const gridCols =
    compact || items.length === 1
      ? "grid-cols-1"
      : items.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className={`ff-bonus grid ${gridCols} gap-4 mt-4`}
      data-ff-anim={section.animations?.bullets ?? "fade-up"}
    >
      {items.map((item, idx) => {
        const Icon = getIconByName(item.data.iconName || "gift");
        return (
          <div
            key={idx}
            className="ff-bonus-card rounded-xl p-5 flex gap-4 items-start"
            style={{
              background: "color-mix(in srgb, var(--ff-accent, #31845C) 6%, transparent)",
              border: "1px solid color-mix(in srgb, var(--ff-accent, #31845C) 25%, transparent)",
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "var(--ff-accent, #31845C)",
                color: "#ffffff",
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap mb-1">
                <h3
                  className="font-bold"
                  style={{ color: "var(--ff-ink, #0f172a)" }}
                >
                  {item.data.title || `Bonus ${idx + 1}`}
                </h3>
                {item.data.value && (
                  <span
                    className="text-xs font-semibold rounded-full px-2 py-0.5"
                    style={{
                      background: "var(--ff-accent, #31845C)",
                      color: "#ffffff",
                    }}
                  >
                    {item.data.value}
                  </span>
                )}
              </div>
              {item.data.description && (
                <p
                  className={`${bodySize} leading-relaxed`}
                  style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.8 }}
                >
                  {item.data.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
