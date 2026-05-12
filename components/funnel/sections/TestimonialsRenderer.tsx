"use client";

import { Star } from "lucide-react";
import type { FunnelSection, SectionItem } from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  bodySize?: string;
  compact?: boolean;
};

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

  const gridCols =
    compact || items.length === 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className={`ff-testimonials grid ${gridCols} gap-5 mt-6`}
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

        return (
          <div
            key={idx}
            className="ff-testimonial-card ff-card rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 flex flex-col"
          >
            {item.data.rating && item.data.rating > 0 && (
              <div className="mb-3 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="h-4 w-4"
                    fill={n <= (item.data.rating || 0) ? "currentColor" : "none"}
                    style={{ color: "var(--ff-accent, #f59e0b)" }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}

            {item.data.quote && (
              <blockquote
                className={`${bodySize} mb-4 leading-relaxed flex-1`}
                style={{ color: "var(--ff-ink)" }}
              >
                « {item.data.quote} »
              </blockquote>
            )}

            <div className="flex items-center gap-3 mt-auto">
              {item.data.avatarUrl ? (
                <img
                  src={item.data.avatarUrl}
                  alt={item.data.authorName || ""}
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold shrink-0"
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
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--ff-ink)" }}
                  >
                    {item.data.authorName}
                  </div>
                )}
                {item.data.authorRole && (
                  <div
                    className="text-xs truncate"
                    style={{
                      color: "var(--ff-ink-soft, var(--ff-ink))",
                      opacity: 0.7,
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
