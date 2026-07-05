"use client";

// components/billing/ConnectCard.tsx
//
// Carte « Paiements » de l'espace créateur : connexion du compte Stripe Connect.
// - Synchronise le statut au montage (et au retour d'onboarding ?connect=return).
// - Bouton « Connecter mon compte Stripe » → /api/connect/onboard → redirection.
// - Affiche clairement : connecté / configuration à terminer / non connecté.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type ConnectState = {
  accountId: string | null;
  status: "none" | "pending" | "active" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  email: string | null;
  displayName: string | null;
};

export function ConnectCard() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/connect/status", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setState(json.state as ConnectState);
    } catch {
      /* l'API retombe déjà sur l'état stocké ; on ignore ici */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Retour d'onboarding ou erreur : on lit le paramètre puis on synchronise.
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "error") {
      setError("La connexion Stripe a échoué. Réessayez.");
    }
    void refresh();
  }, [refresh]);

  const handleConnect = useCallback(async () => {
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const json = await res.json();
      if (json?.ok && json.url) {
        window.location.href = json.url as string;
        return;
      }
      setError(json?.message ?? "Impossible de démarrer la connexion Stripe.");
    } catch {
      setError("Erreur réseau. Réessayez dans un instant.");
    } finally {
      setActing(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    const ok = window.confirm(
      "Déconnecter votre compte Stripe ? Les paiements de vos tunnels seront désactivés jusqu'à une nouvelle connexion.",
    );
    if (!ok) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/connect/disconnect", { method: "POST" });
      const json = await res.json();
      if (json?.ok) {
        if (json.state) setState(json.state as ConnectState);
        else await refresh();
        return;
      }
      setError(json?.message ?? "Impossible de déconnecter le compte Stripe.");
    } catch {
      setError("Erreur réseau. Réessayez dans un instant.");
    } finally {
      setActing(false);
    }
  }, [refresh]);

  const status = state?.status ?? "none";
  const isActive = status === "active" && Boolean(state?.chargesEnabled);
  const hasAccount = Boolean(state?.accountId);

  return (
    <Card className="max-w-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#635BFF]/15 text-[#635BFF]">
          <CreditCard size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-ink">Encaisser les ventes de vos tunnels</h2>
          <p className="mt-1 text-sm text-muted">
            Connectez votre compte Stripe pour recevoir directement l&apos;argent de vos
            offres. AutoFunnel gère toute la configuration : vous n&apos;avez rien à
            paramétrer chez Stripe.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Vérification du statut…
          </p>
        ) : isActive ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 size={18} /> Compte connecté — vous pouvez vendre vos offres.
            </div>
            {(state?.displayName || state?.email || state?.country) && (
              <div className="mt-1.5 pl-6 text-xs text-emerald-700/90">
                {state?.displayName && (
                  <span className="font-semibold">{state.displayName}</span>
                )}
                {state?.email && (
                  <span>{state?.displayName ? " · " : ""}{state.email}</span>
                )}
                {state?.country && (
                  <span> · {state.country}</span>
                )}
                <span className="block opacity-70">
                  Compte Stripe {state?.accountId ? `…${state.accountId.slice(-6)}` : ""}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={acting}
              className="mt-3 text-xs font-semibold text-red underline underline-offset-2 disabled:opacity-50"
            >
              {acting ? "…" : "Déconnecter ce compte Stripe"}
            </button>
          </div>
        ) : hasAccount ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-600">
              <AlertTriangle size={18} />
              {status === "restricted"
                ? "Configuration incomplète : Stripe demande des informations supplémentaires."
                : "Configuration à terminer pour activer les paiements."}
            </div>
            <Button onClick={handleConnect} disabled={acting}>
              {acting ? "Redirection…" : "Terminer la configuration"}
            </Button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={acting}
              className="text-xs font-semibold text-red underline underline-offset-2 disabled:opacity-50"
            >
              {acting ? "…" : "Déconnecter ce compte Stripe"}
            </button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={acting}>
            {acting ? "Redirection…" : "Connecter mon compte Stripe"}
          </Button>
        )}

        {error && <p className="mt-3 text-sm text-red">{error}</p>}
      </div>

      <p className="mt-5 text-xs text-muted">
        Propulsé par Stripe. Les fonds vont directement sur votre compte ; AutoFunnel ne
        stocke jamais vos coordonnées bancaires.
      </p>
    </Card>
  );
}
