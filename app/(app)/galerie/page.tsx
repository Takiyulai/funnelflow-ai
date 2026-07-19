"use client";

// app/(app)/galerie/page.tsx
// 🆕 GALERIE COMMUNAUTAIRE — modèles partagés par les créateurs. Tout le monde
// peut parcourir ; « Utiliser » clone le modèle dans un nouveau tunnel (nécessite
// un abonnement, géré par le gating d'action).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Users2, Flag, Loader2, ArrowRight } from "lucide-react";
import { handlePlanGate } from "@/lib/billing/planGate";

type Template = {
  id: string;
  owner_name: string;
  name: string;
  description: string | null;
  funnel_kind: string | null;
  language: string | null;
  usage_count: number;
  featured: boolean;
};

const KIND_LABELS: Record<string, string> = {
  "lead-magnet": "Lead magnet",
  webinar: "Webinaire",
  "digital-product": "Produit digital",
  booking: "Réservation",
  "coaching-high-ticket": "Coaching",
  challenge: "Challenge",
};

export default function GaleriePage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates/gallery")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTemplates((d?.templates as Template[]) ?? []))
      .catch(() => setTemplates([]));
  }, []);

  async function useTemplate(id: string) {
    if (busyId) return;
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/templates/${id}/use`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (handlePlanGate(res.status, json, (m) => setNotice(`${m.title}. ${m.description}`))) return;
      if (!res.ok || !json.ok) {
        setNotice(json.message || json.error || "Impossible d'utiliser ce modèle.");
        return;
      }
      router.push(`/editor/${json.funnelId}`);
    } catch {
      setNotice("Connexion impossible. Réessaie.");
    } finally {
      setBusyId(null);
    }
  }

  async function report(id: string) {
    setReported((s) => new Set(s).add(id));
    try {
      await fetch(`/api/templates/${id}/report`, { method: "POST" });
    } catch {
      /* non bloquant */
    }
    setNotice("Merci, ce modèle a été signalé à la modération.");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
          <Sparkles size={12} /> Galerie communautaire
        </div>
        <h1 className="mt-3 text-2xl font-black text-white">Modèles partagés par la communauté</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-white/50">
          Choisis un modèle créé par un autre utilisateur et génère ton tunnel à partir de sa
          structure. Tu pourras tout modifier ensuite.
        </p>
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {notice}
        </div>
      )}

      {templates === null ? (
        <div className="flex items-center gap-2 py-16 text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des modèles…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-10 text-center text-white/50">
          Aucun modèle partagé pour l&apos;instant. Sois le premier à en partager un depuis
          l&apos;éditeur d&apos;un de tes tunnels !
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex flex-col rounded-2xl border border-white/10 bg-zinc-900/60 p-5 transition-all hover:-translate-y-1 hover:border-amber-300/40"
            >
              <div className="mb-2 flex items-center gap-2">
                {t.funnel_kind && (
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/60">
                    {KIND_LABELS[t.funnel_kind] ?? t.funnel_kind}
                  </span>
                )}
                {t.featured && (
                  <span className="rounded-full bg-amber-300/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    À la une
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white">{t.name}</h3>
              {t.description && (
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-white/50">{t.description}</p>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
                <Users2 size={12} /> Partagé par{" "}
                <span className="font-semibold text-white/60">{t.owner_name || "un créateur"}</span>
                <span className="mx-1">·</span>
                {t.usage_count} utilisation{t.usage_count > 1 ? "s" : ""}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => useTemplate(t.id)}
                  disabled={busyId === t.id}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
                >
                  {busyId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Utiliser ce modèle <ArrowRight size={14} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => report(t.id)}
                  disabled={reported.has(t.id)}
                  title="Signaler ce modèle"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-red-300/40 hover:text-red-300 disabled:opacity-40"
                >
                  <Flag size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
