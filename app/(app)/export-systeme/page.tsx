"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Check, Copy, Download, FileCode, Layers } from "lucide-react";
import { useState } from "react";

export default function ExportSystemePage() {
  const [mode, setMode] = useState<"full" | "block">("full");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const res = await fetch(`/api/export/systeme?mode=${mode}`);
      const html = await res.text();
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencieux, l'utilisateur verra simplement que rien ne change
    }
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6 animate-[fadeIn_0.4s_ease-out]">
        <div>
          <h1 className="text-3xl font-black text-ink">Export systeme.io</h1>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Export HTML/CSS prêt à coller dans un bloc Code de systeme.io. Aucune balise globale, CSS scopé, formulaires sécurisés
          </p>
        </div>
        <Badge tone="gold">Optimisé systeme.io</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6 max-w-3xl">
        <button
          type="button"
          onClick={() => setMode("full")}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 ${
            mode === "full" ? "border-[#08498D] bg-[#08498D]/5 shadow-sm" : "border-line bg-white hover:border-[#08498D]/40"
          }`}
        >
          <FileCode className="h-5 w-5 text-[#08498D] mb-3" />
          <p className="font-black text-ink">Page complète</p>
          <p className="text-xs text-muted mt-1">
            Un seul bloc HTML contenant toutes les sections, idéal pour une page dédiée
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode("block")}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 ${
            mode === "block" ? "border-[#08498D] bg-[#08498D]/5 shadow-sm" : "border-line bg-white hover:border-[#08498D]/40"
          }`}
        >
          <Layers className="h-5 w-5 text-[#31845C] mb-3" />
          <p className="font-black text-ink">Blocs individuels</p>
          <p className="text-xs text-muted mt-1">
            Chaque section dans son propre bloc Code, à insérer où vous voulez
          </p>
        </button>
      </div>

      <Card className="p-6 max-w-3xl animate-[fadeIn_0.4s_ease-out]">
        <h2 className="text-lg font-black text-ink mb-1">Procédure</h2>
        <p className="text-sm text-muted mb-4">
          Trois étapes pour intégrer votre tunnel dans systeme.io
        </p>

        <ol className="space-y-3 mb-5">
          {[
            "Ouvrez votre tunnel dans systeme.io et ajoutez un bloc « Code personnalisé »",
            "Copiez le HTML ci-dessous et collez-le dans le bloc",
            "Sauvegardez puis publiez votre page"
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-[#080E1A] text-[#C7A436] flex items-center justify-center text-xs font-black flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-ink/85">{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copié" : `Copier le HTML (${mode === "full" ? "page complète" : "blocs"})`}
          </Button>
          <Button variant="secondary" href="/api/export/systeme">
            <Download className="h-4 w-4" />
            Télécharger ZIP
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
