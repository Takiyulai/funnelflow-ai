"use client";

import { Star } from "lucide-react";
import type { FunnelSection, SectionItem } from "@/lib/funnels/types";
import { IconRenderer } from "@/components/funnel/IconRenderer";

type Props = {
  section: FunnelSection;
  bodySize?: string;
  compact?: boolean;
};

export function PricingRenderer({
  section,
  bodySize = "text-base",
  compact,
}: Props) {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "pricing" } => it.kind === "pricing",
  );

  if (items.length === 0) return null;

  const gridCols =
    compact || items.length === 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-3";

  return (
    <div
      className={`ff-pricing grid ${gridCols} gap-5 mt-6`}
      data-ff-anim={section.animations?.bullets ?? "fade-up"}
    >
      {items.map((item, idx) => {
        const highlighted = item.data.highlighted;
        const cta = item.data.cta;

        // Résolution de la destination selon le mode du CTA
        let ctaHref = "#lead-form";
        let ctaTarget: "_blank" | "_self" | undefined;
        let ctaRel: string | undefined;
        if (cta) {
          if (cta.mode === "redirect") {
            ctaHref = cta.url || "#";
            ctaTarget = cta.target ?? "_blank";
            ctaRel = ctaTarget === "_blank" ? "noopener noreferrer" : undefined;
          } else if (cta.mode === "anchor") {
            ctaHref = `#${cta.anchorId || "lead-form"}`;
            ctaTarget = "_self";
          } else if (cta.mode === "popup") {
            ctaHref = `#${cta.popupId || "lead-form"}`;
            ctaTarget = "_self";
          }
        }

        const featureIconConfig = item.data.featureIcon;

        return (
          <div
            key={idx}
            data-ff-pricing-highlighted={highlighted ? "true" : undefined}
            className={[
              "ff-pricing-card",
              highlighted ? "ff-card-elevated" : "ff-card",
              "relative rounded-2xl p-6 flex flex-col",
              "transition-transform duration-300",
              !compact && highlighted ? "md:scale-[1.04]" : "",
              "hover:-translate-y-1",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {highlighted && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap z-10"
                style={{
                  background: "var(--ff-accent)",
                  color: "var(--ff-accent-ink, #ffffff)",
                  boxShadow:
                    "0 4px 12px color-mix(in srgb, var(--ff-accent) 40%, transparent)",
                }}
              >
                <Star
                  className="h-3 w-3"
                  fill="currentColor"
                  aria-hidden="true"
                />
                {item.data.badge || "Populaire"}
              </div>
            )}

            <div className="mb-4">
              <h3
                className="text-lg font-bold mb-1"
                style={{ color: "var(--ff-ink)" }}
              >
                {item.data.name || `Plan ${idx + 1}`}
              </h3>
              {item.data.description && (
                <p
                  className="text-sm"
                  style={{ color: "var(--ff-ink-soft, var(--ff-ink))" }}
                >
                  {item.data.description}
                </p>
              )}
            </div>

            <div className="mb-5 flex items-baseline gap-1">
              <span
                className="text-4xl font-black"
                style={{
                  color: highlighted ? "var(--ff-accent)" : "var(--ff-ink)",
                }}
              >
                {item.data.price || "—"}
              </span>
              {item.data.period && (
                <span
                  className="text-sm"
                  style={{
                    color: "var(--ff-ink-soft, var(--ff-ink))",
                    opacity: 0.8,
                  }}
                >
                  {item.data.period}
                </span>
              )}
            </div>

            {item.data.features && item.data.features.length > 0 && (
              <ul className="space-y-2.5 mb-6 flex-1">
                {item.data.features.map((feat, fIdx) => (
                  <li
                    key={fIdx}
                    className={`flex items-start gap-2 ${bodySize}`}
                    style={{ color: "var(--ff-ink)" }}
                  >
                    <span
                      className="shrink-0 mt-0.5 flex items-center justify-center"
                      style={{
                        color: featureIconConfig?.color ?? "var(--ff-accent)",
                      }}
                    >
                      <IconRenderer
                        config={featureIconConfig}
                        fallbackName="check"
                      />
                    </span>
                    <span className="flex-1">{feat}</span>
                  </li>
                ))}
              </ul>
            )}

            {cta?.label && (
              <a
                href={ctaHref}
                target={ctaTarget}
                rel={ctaRel}
                className="ff-btn inline-flex items-center justify-center w-full px-4 py-3 rounded-lg font-bold text-sm no-underline mt-auto"
                data-ff-cta
              >
                {cta.label}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
