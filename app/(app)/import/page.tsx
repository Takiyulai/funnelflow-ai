"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Link as LinkIcon, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { sections: string[]; warning: string }>(null);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    if (!url) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/import-inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data.analysis);
    } catch {
      setError("Erreur lors de l'analyse, vérifiez l'URL et réessayez");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 animate-[fadeIn_0.4s_ease-out]">
        <h1 className="text-3xl font-black text-ink">Import par URL</h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Indiquez une page d'inspiration. Nous analysons sa structure pour vous proposer un tunnel équivalent — aucun texte, image ou branding tiers n'est copié
        </p>
      </div>

      <Card className="p-6 max-w-3xl animate-[fadeIn_0.4s_ease-out]">
        <label className="block text-[11px] uppercase tracking-wider font-bold text-muted mb-2">
          URL de la page à analyser
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.com/page-de-vente"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D] transition-colors"
            />
          </div>
          <Button variant="primary" onClick={handleAnalyze} disabled={loading || !url}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyse..." : "Analyser"}
          </Button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#B42318]/10 border border-[#B42318]/30 animate-[fadeIn_0.2s_ease-out]">
            <AlertCircle className="h-4 w-4 text-[#B42318] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#B42318]">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#C7A436]/10 border border-[#C7A436]/30 mb-4">
              <AlertCircle className="h-4 w-4 text-[#C7A436] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-ink/80">{result.warning}</p>
            </div>

            <p className="text-[11px] uppercase tracking-wider font-bold text-muted mb-2">
              Structure détectée
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {result.sections.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1.5 rounded-lg bg-[#08498D]/10 text-[#08498D] text-xs font-semibold capitalize"
                >
                  {s}
                </span>
              ))}
            </div>

            <Button variant="primary" href="/create" className="w-full">
              <Sparkles className="h-4 w-4" />
              Générer un tunnel équivalent
            </Button>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
