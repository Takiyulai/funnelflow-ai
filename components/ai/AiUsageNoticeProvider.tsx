"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, Sparkles, X } from "lucide-react";

export type AiUsageMetric = "ai_funnel_gen" | "ai_sequence_gen" | "ai_copy_regen";

type NoticeState = {
  metric: AiUsageMetric;
  remaining: number | null;
  limit: number | null;
  period: "monthly" | "lifetime";
};

type ContextValue = {
  confirmAiUsage: (metric: AiUsageMetric) => Promise<boolean>;
};

const Context = createContext<ContextValue | null>(null);

// Les écrans applicatifs sont enveloppés par AiUsageNoticeProvider dans le
// layout connecté. Ce repli garde néanmoins les composants réutilisables et
// leurs tests autonomes : hors layout, l'action reste autorisée et le quota
// est toujours contrôlé par la route serveur métier.
const FALLBACK_CONTEXT: ContextValue = {
  confirmAiUsage: async () => true,
};

const LABELS: Record<AiUsageMetric, string> = {
  ai_funnel_gen: "génération complète de tunnel",
  ai_sequence_gen: "génération de séquence email",
  ai_copy_regen: "régénération par l'IA",
};

export function AiUsageNoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setNotice(null);
  }, []);

  const confirmAiUsage = useCallback(async (metric: AiUsageMetric) => {
    let state: NoticeState = { metric, remaining: null, limit: null, period: "monthly" };
    try {
      const response = await fetch(`/api/ai/usage?metric=${metric}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data?.ok) {
        state = {
          metric,
          remaining: typeof data.remaining === "number" ? data.remaining : null,
          limit: typeof data.limit === "number" ? data.limit : null,
          period: data.period === "lifetime" ? "lifetime" : "monthly",
        };
      }
    } catch {
      // Le contrôle serveur reste la source de vérité. Une panne du pré-affichage
      // n'autorise pas un dépassement : la route métier revérifie le quota.
    }
    setNotice(state);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => ({ confirmAiUsage }), [confirmAiUsage]);

  return (
    <Context.Provider value={value}>
      {children}
      {notice && (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/55 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-usage-title"
            className="w-full max-w-md rounded-2xl border border-[#C7A436]/35 bg-[#0D1628] p-5 text-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#C7A436]/15 text-[#E7C95B]">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p id="ai-usage-title" className="font-black">Utilisation d'un crédit IA</p>
                  <p className="text-xs text-white/55">{LABELS[notice.metric]}</p>
                </div>
              </div>
              <button type="button" onClick={() => close(false)} aria-label="Fermer" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                <X size={17} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              {notice.remaining === null ? (
                <p className="text-sm font-bold text-[#E7C95B]">Ton plan inclut une marge IA très large.</p>
              ) : notice.remaining > 0 ? (
                <p className="text-sm font-bold text-[#E7C95B]">
                  Il te reste {notice.remaining} crédit{notice.remaining > 1 ? "s" : ""} IA
                  {notice.period === "monthly" ? " pour cette période" : " sur ton quota Free"}.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-bold text-red-300"><AlertCircle size={16} /> Ton quota IA est épuisé.</p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-white/65">
                {notice.remaining !== null && notice.remaining > 0
                  ? `Après cette action, il t'en restera ${Math.max(0, notice.remaining - 1)}. `
                  : ""}
                Utilise de préférence l'IA pour les décisions à fort impact : structure d'une offre,
                promesse, titres, CTA, logique de workflow et stratégie de séquence. Pour une petite
                correction de mot, l'édition manuelle économise tes crédits.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => close(false)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75 hover:bg-white/5">
                Annuler
              </button>
              <button type="button" disabled={notice.remaining === 0} onClick={() => close(true)} className="rounded-xl bg-[#C7A436] px-4 py-2.5 text-sm font-black text-[#080E1A] disabled:cursor-not-allowed disabled:opacity-40">
                Continuer avec l'IA
              </button>
            </div>
          </div>
        </div>
      )}
    </Context.Provider>
  );
}

export function useAiUsageNotice(): ContextValue {
  const value = useContext(Context);
  return value ?? FALLBACK_CONTEXT;
}
