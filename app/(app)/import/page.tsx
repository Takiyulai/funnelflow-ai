"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Link as LinkIcon, Loader2, Copy } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFunnelFromAi } from "@/lib/store/funnelStore";
import type { Funnel, FunnelBrief, Language } from "@/lib/funnels/types";

/** Brief synthétique minimal exigé par createFunnelFromAi pour un clone. */
function buildCloneBrief(
  funnel: Funnel,
  sourceUrl: string,
  language: Language,
): FunnelBrief {
  return {
    brandName: funnel.funnelName || "Tunnel importé",
    offerName: funnel.funnelName || "Tunnel importé",
    price: "",
    targetAudience: "",
    mainPain: "",
    promise: funnel.seo?.description ?? "",
    tone: "neutre",
    funnelType: "custom",
    designStyle: funnel.design?.style ?? "modern",
    language,
    creationMode: "free",
    mainColor: funnel.design?.primaryColor,
    secondaryColor: funnel.design?.secondaryColor,
    aboutText: `Importé depuis : ${sourceUrl}`,
  };
}

const STEP_LABELS: Record<string, string> = {
  fetching: "Récupération de la page…",
  parsing: "Analyse de la structure…",
  uploading: "Import des médias…",
  saving: "Création du tunnel…",
};

export default function ImportPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string>("fetching");
  const [error, setError] = useState("");

  async function handleClone() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+\..+/.test(trimmed)) {
      setError("L'URL doit être au format https://exemple.com/...");
      return;
    }
    setLoading(true);
    setError("");
    setStep("fetching");

    const tempFunnelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const t1 = setTimeout(() => setStep("parsing"), 5000);
    const t2 = setTimeout(() => setStep("uploading"), 12000);

    try {
      const res = await fetch("/api/clone-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, language, funnelId: tempFunnelId }),
      });
      clearTimeout(t1);
      clearTimeout(t2);

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error || `Erreur ${res.status} : impossible d'importer ce tunnel.`);
        setLoading(false);
        return;
      }

      setStep("saving");
      const funnel = data.funnel as Funnel;
      const brief = buildCloneBrief(funnel, trimmed, language);
      const stored = createFunnelFromAi(funnel, brief);
      router.push(`/editor/${stored.id}`);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      setError((err as Error)?.message || "Une erreur inattendue est survenue. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 animate-[fadeIn_0.4s_ease-out]">
        <h1 className="text-3xl font-black text-ink">Importer un tunnel par URL</h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Collez l&apos;URL d&apos;une page existante. Nous la clonons fidèlement
          (structure, textes, visuels) et vous redirigeons directement dans
          l&apos;éditeur pour la personnaliser.
        </p>
      </div>

      <Card className="p-6 max-w-3xl animate-[fadeIn_0.4s_ease-out]">
        <label className="block text-[11px] uppercase tracking-wider font-bold text-muted mb-2">
          URL de la page à cloner
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              placeholder="https://exemple.com/page-de-vente"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-surface text-ink text-sm focus:outline-none focus:border-[#08498D] transition-colors disabled:opacity-60"
            />
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            disabled={loading}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink disabled:opacity-60"
            aria-label="Langue du tunnel"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <Button variant="primary" onClick={handleClone} disabled={loading || !url}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            {loading ? "Clonage…" : "Cloner et éditer"}
          </Button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {STEP_LABELS[step] ?? "Traitement…"}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#B42318]/10 border border-[#B42318]/30 animate-[fadeIn_0.2s_ease-out]">
            <AlertCircle className="h-4 w-4 text-[#B42318] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#B42318]">{error}</p>
          </div>
        )}

        <p className="mt-4 text-[11px] text-muted">
          Astuce : vous pourrez ensuite tout modifier (textes, images, CTA,
          couleurs) et publier le tunnel depuis l&apos;éditeur.
        </p>
      </Card>
    </AppShell>
  );
}
