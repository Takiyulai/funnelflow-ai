"use client";

import type { FunnelSection, SectionItem } from "@/lib/funnels/types";
import { getIconByName } from "@/components/editor/IconPicker";

type Props = {
  section: FunnelSection;
  bodySize?: string;
};

export function GuaranteeRenderer({ section, bodySize = "text-base" }: Props) {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "guarantee" } => it.kind === "guarantee"
  );

  const item = items[0];
  if (!item) return null;

  const Icon = getIconByName(item.data.iconName || "shield");

  return (
    <div
      className="ff-guarantee mt-4 mx-auto max-w-2xl rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left"
      style={{
        background: "color-mix(in srgb, var(--ff-accent, #31845C) 8%, transparent)",
        border: "2px solid color-mix(in srgb, var(--ff-accent, #31845C) 30%, transparent)",
      }}
      data-ff-anim={section.animations?.body ?? "fade-up"}
    >
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "var(--ff-accent, #31845C)",
          color: "#ffffff",
        }}
      >
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap items-baseline justify-center sm:justify-start gap-2 mb-2">
          <h3
            className="text-xl font-black"
            style={{ color: "var(--ff-ink, #0f172a)" }}
          >
            {item.data.title || "Notre garantie"}
          </h3>
          {item.data.duration && (
            <span
              className="text-sm font-bold rounded-full px-3 py-1"
              style={{
                background: "var(--ff-accent, #31845C)",
                color: "#ffffff",
              }}
            >
              {item.data.duration}
            </span>
          )}
        </div>
        {item.data.description && (
          <p
            className={`${bodySize} leading-relaxed`}
            style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85 }}
          >
            {item.data.description}
          </p>
        )}
      </div>
    </div>
  );
}
