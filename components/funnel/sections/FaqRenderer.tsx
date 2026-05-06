"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FunnelSection, SectionItem } from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  bodySize?: string;
};

export function FaqRenderer({ section, bodySize = "text-base" }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "faq" } => it.kind === "faq"
  );

  if (items.length === 0) return null;

  return (
    <div
      className="ff-faq-list mt-4 mx-auto max-w-2xl"
      data-ff-anim={section.animations?.bullets ?? "fade-up"}
    >
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="ff-faq-item"
            style={{
              borderTop:
                idx === 0
                  ? "1px solid var(--ff-border, rgba(0,0,0,0.1))"
                  : "none",
              borderBottom: "1px solid var(--ff-border, rgba(0,0,0,0.1))",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className={`flex w-full items-center justify-between gap-4 py-4 text-left ${bodySize} font-semibold transition-colors`}
              style={{ color: "var(--ff-ink, #0f172a)" }}
              aria-expanded={isOpen}
            >
              <span className="flex-1">{item.data.question || `Question ${idx + 1}`}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
                style={{ color: "var(--ff-accent, #31845C)" }}
                aria-hidden="true"
              />
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <p
                  className={`pb-4 pr-8 ${bodySize} whitespace-pre-line`}
                  style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.8 }}
                >
                  {item.data.answer || (
                    <em style={{ opacity: 0.5 }}>Réponse à compléter…</em>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
