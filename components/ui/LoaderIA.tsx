// components/ui/LoaderIA.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  "Analyse du brief",
  "Structure du tunnel",
  "Rédaction du copywriting",
  "Composition des sections",
  "Adaptation mobile",
  "Préparation de l'export",
];

export function LoaderIA() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActive((value) => Math.min(STEPS.length - 1, value + 1));
    }, 900);
    return () => window.clearInterval(interval);
  }, []);

  const progress = ((active + 1) / STEPS.length) * 100;

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-navy" />
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          Génération en cours
        </p>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green to-navy transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-2.5">
        {STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <div
              key={step}
              className={`flex items-center gap-2.5 text-sm transition ${
                done
                  ? "text-ink"
                  : current
                  ? "text-navy font-bold"
                  : "text-muted"
              }`}
            >
              {done ? (
                <CheckCircle2 size={14} className="text-green" />
              ) : current ? (
                <Loader2 size={14} className="animate-spin text-navy" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-line" />
              )}
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
