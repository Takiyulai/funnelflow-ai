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
              "relative rounded-2xl p-8 flex flex-col",
              "transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)",
              highlighted ? "ring-1 ring-inset ring-[var(--ff-accent)]/20" : "",
              "hover:-translate-y-2 hover:shadow-2xl",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {highlighted && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap z-10"
                style={{
                  background: "var(--ff-accent)",
                  color: "var(--ff-accent-ink, #ffffff)",
                  boxShadow:
                    "0 10px 20px -5px color-mix(in srgb, var(--ff-accent) 50%, transparent)",
                }}
              >
                <Star
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  aria-hidden="true"
                />
                {item.data.badge || "Recommandé"}
              </div>
            )}

            <div className="mb-6">
              <h3
                className="text-xl font-bold mb-2"
                style={{ color: "var(--ff-ink)" }}
              >
                {item.data.name || `Plan ${idx + 1}`}
              </h3>
              {item.data.description && (
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--ff-ink-soft, var(--ff-ink))" }}
                >
                  {item.data.description}
                </p>
              )}
            </div>

            <div className="mb-8 flex items-baseline gap-1.5">
              <span
                className="text-5xl font-black tracking-tighter"
                style={{
                  color: "var(--ff-ink)",
                }}
              >
                {item.data.price || "—"}
              </span>
              {item.data.period && (
                <span
                  className="text-sm font-medium"
                  style={{
                    color: "var(--ff-ink-soft, var(--ff-ink))",
                    opacity: 0.6,
                  }}
                >
                  {item.data.period}
                </span>
              )}
            </div>

            {item.data.features && item.data.features.length > 0 && (
              <ul className="space-y-4 mb-8 flex-1">
                {item.data.features.map((feat, fIdx) => (
                  <li
                    key={fIdx}
                    className={`flex items-start gap-3 ${bodySize}`}
                    style={{ color: "var(--ff-ink)" }}
                  >
                    <span
                      className="shrink-0 mt-1 flex items-center justify-center p-0.5 rounded-full bg-[var(--ff-accent)]/10"
                      style={{
                        color: "var(--ff-accent)",
                      }}
                    >
                      <IconRenderer
                        config={featureIconConfig}
                        fallbackName="check"
                        className="w-3.5 h-3.5"
                      />
                    </span>
                    <span className="flex-1 opacity-90">{feat}</span>
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
