"use client";

import { Check, Star } from "lucide-react";
import type { FunnelSection, SectionItem } from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  bodySize?: string;
  compact?: boolean;
};

export function PricingRenderer({ section, bodySize = "text-base", compact }: Props) {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "pricing" } => it.kind === "pricing"
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
      className={`ff-pricing grid ${gridCols} gap-4 mt-4`}
      data-ff-anim={section.animations?.bullets ?? "fade-up"}
    >
      {items.map((item, idx) => {
        const highlighted = item.data.highlighted;
        const cta = item.data.cta;

        // Résolution de la destination selon le mode du CTA (union discriminée)
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

        return (
          <div
            key={idx}
            className="ff-pricing-card relative rounded-xl p-6 flex flex-col"
            style={{
              background: highlighted
                ? "color-mix(in srgb, var(--ff-accent, #31845C) 8%, transparent)"
                : "color-mix(in srgb, var(--ff-ink, #0f172a) 3%, transparent)",
              border: highlighted
                ? "2px solid var(--ff-accent, #31845C)"
                : "1px solid var(--ff-border, rgba(0,0,0,0.08))",
              transform: highlighted && !compact ? "scale(1.02)" : "none",
              boxShadow: highlighted
                ? "0 10px 30px -10px color-mix(in srgb, var(--ff-accent, #31845C) 40%, transparent)"
                : "none",
            }}
          >
            {highlighted && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "var(--ff-accent, #31845C)",
                  color: "#ffffff",
                }}
              >
                <Star className="h-3 w-3" fill="currentColor" aria-hidden="true" />
                Populaire
              </div>
            )}

            <div className="mb-4">
              <h3
                className="text-lg font-bold mb-1"
                style={{ color: "var(--ff-ink, #0f172a)" }}
              >
                {item.data.name || `Plan ${idx + 1}`}
              </h3>
              {item.data.description && (
                <p
                  className="text-sm"
                  style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.65 }}
                >
                  {item.data.description}
                </p>
              )}
            </div>

            <div className="mb-5 flex items-baseline gap-1">
              <span
                className="text-4xl font-black"
                style={{
                  color: highlighted
                    ? "var(--ff-accent, #31845C)"
                    : "var(--ff-ink, #0f172a)",
                }}
              >
                {item.data.price || "—"}
              </span>
              {item.data.period && (
                <span
                  className="text-sm"
                  style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.6 }}
                >
                  {item.data.period}
                </span>
              )}
            </div>

            {item.data.features && item.data.features.length > 0 && (
              <ul className="space-y-2 mb-5 flex-1">
                {item.data.features.map((feat, fIdx) => (
                  <li
                    key={fIdx}
                    className={`flex items-start gap-2 ${bodySize}`}
                    style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85 }}
                  >
                    <Check
                      className="h-5 w-5 shrink-0 mt-0.5"
                      style={{ color: "var(--ff-accent, #31845C)" }}
                      aria-hidden="true"
                    />
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
                className="ff-btn inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg font-bold text-sm no-underline mt-auto"
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
