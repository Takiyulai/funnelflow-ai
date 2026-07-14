"use client";

// app/(app)/create/demo/page.tsx
// 🆕 FIX bouton « Démo » du wizard : aperçu PLEIN NAVIGATEUR du tunnel en
// cours de composition (template + ambiance + brief actuels), ouvert dans un
// nouvel onglet. Le wizard dépose son funnel d'aperçu dans le storage sous la
// clé ff:wizard-demo juste avant d'ouvrir cet écran. Fallback : tunnel de
// démonstration générique (lib/funnels/demo) si aucun aperçu n'est trouvé
// (accès direct à l'URL, storage vidé…).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";
import { demoFunnel } from "@/lib/funnels/demo";
import type { Funnel } from "@/lib/funnels/types";

export const dynamic = "force-dynamic";

// ⚠️ Ne pas exporter (Next.js restreint les exports d'une page). La même clé
// est utilisée par CreateFunnelWizard pour déposer l'aperçu.
const WIZARD_DEMO_KEY = "ff:wizard-demo";

function readWizardDemo(): Funnel | null {
  try {
    const raw =
      window.localStorage.getItem(WIZARD_DEMO_KEY) ??
      window.sessionStorage.getItem(WIZARD_DEMO_KEY);
    if (!raw) return null;
    return normalizeFunnel(JSON.parse(raw));
  } catch {
    return null;
  }
}

export default function WizardDemoPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);

  useEffect(() => {
    setFunnel(readWizardDemo() ?? normalizeFunnel(demoFunnel));
  }, []);

  if (!funnel) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0B0F14] text-sm text-white/60">
        Chargement de la démo…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0B0F14" }}>
      {/* Bandeau discret : rappel que c'est une démo + retour */}
      <div className="flex items-center justify-between gap-3 bg-black/80 px-4 py-2 text-xs text-white/70 backdrop-blur">
        <span>
          Démo du template « {String((funnel.meta as { templateId?: string } | undefined)?.templateId ?? "défaut")} » —
          contenu d&apos;exemple, rendu identique à une page publiée.
        </span>
        <Link
          href="/create"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 px-2.5 py-1 font-semibold text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au créateur
        </Link>
      </div>

      {/* Rendu pleine page, identique à la page publiée (mode raw, sans toolbar) */}
      <FunnelPreview
        funnel={funnel}
        forcedMode="raw"
        showToolbar={false}
        viewportHeight="auto"
        className="ff-fill-col"
      />
    </div>
  );
}
