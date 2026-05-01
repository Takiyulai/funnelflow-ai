"use client";

import { useEffect, useState } from "react";

const steps = [
  "Analyse de l’offre",
  "Création du copywriting",
  "Création des sections",
  "Création du design",
  "Optimisation mobile",
  "Préparation export Systeme.io"
];

export function LoaderIA() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setActive((value) => (value + 1) % steps.length), 900);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border border-line bg-white p-6 shadow-premium">
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-softBlue">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-green" />
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div key={step} className={`flex items-center gap-3 text-sm font-semibold ${index <= active ? "text-navy" : "text-muted"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${index <= active ? "bg-green" : "bg-line"}`} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
