"use client";

// components/billing/CinetpayCard.tsx
//
// Connexion du compte CinetPay (encaissement vendeur pour l'Afrique). Modèle
// « clés propres » : le créateur colle son apikey + site_id (panel CinetPay) et
// choisit sa devise. On valide les clés côté serveur avant de les stocker.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type CinetpayState = {
  provider: "stripe" | "cinetpay";
  status: "none" | "active";
  siteId: string | null;
  currency: string | null;
  connected: boolean;
};

const CURRENCIES = ["XOF", "XAF", "CDF", "GNF", "USD"] as const;

export function CinetpayCard() {
  const [state, setState] = useState<CinetpayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apikey, setApikey] = useState("");
  const [siteId, setSiteId] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("XOF");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cinetpay/status", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setState(json.state as CinetpayState);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = useCallback(async () => {
    if (!apikey.trim() || !siteId.trim()) {
      setError("Renseigne ton apikey ET ton site_id CinetPay.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/cinetpay/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: apikey.trim(), siteId: siteId.trim(), currency }),
      });
      const json = await res.json();
      if (json?.ok) {
        setApikey("");
        if (json.state) setState(json.state as CinetpayState);
        else await refresh();
        return;
      }
      setError(json?.message ?? "Connexion CinetPay impossible.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setActing(false);
    }
  }, [apikey, siteId, currency, refresh]);

  const handleDisconnect = useCallback(async () => {
    const ok = window.confirm(
      "Déconnecter votre compte CinetPay ? Les paiements de vos tunnels seront désactivés jusqu'à une nouvelle connexion.",
    );
    if (!ok) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/cinetpay/disconnect", { method: "POST" });
      const json = await res.json();
      if (json?.ok) {
        if (json.state) setState(json.state as CinetpayState);
        else await refresh();
        return;
      }
      setError(json?.message ?? "Impossible de déconnecter CinetPay.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setActing(false);
    }
  }, [refresh]);

  const isActive = state?.status === "active";

  return (
    <Card className="max-w-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#21c95e]/15 text-[#1aa34a]">
          <CreditCard size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-ink">Encaisser via CinetPay (Afrique)</h2>
          <p className="mt-1 text-sm text-muted">
            Mobile Money (Orange, MTN, Moov, Wave…) et cartes. Colle ton apikey et ton
            site_id CinetPay : l&apos;argent arrive directement sur ton compte.
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
              <CheckCircle2 size={18} /> Compte CinetPay connecté — vous pouvez vendre.
            </div>
            <div className="mt-1.5 pl-6 text-xs text-emerald-700/90">
              site_id {state?.siteId ?? "—"} · devise {state?.currency ?? "—"}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={acting}
              className="mt-3 text-xs font-semibold text-red underline underline-offset-2 disabled:opacity-50"
            >
              {acting ? "…" : "Déconnecter ce compte CinetPay"}
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Apikey CinetPay</span>
              <input
                value={apikey}
                onChange={(e) => setApikey(e.target.value)}
                placeholder="Panel CinetPay → Intégration"
                className="rounded-lg border border-line/70 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Site ID</span>
              <input
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="Créé en ajoutant un « Service » dans CinetPay"
                className="rounded-lg border border-line/70 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Devise du compte</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
                className="rounded-lg border border-line/70 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                CinetPay encaisse dans la devise locale de ton compte. Indique tes prix
                d&apos;offre dans cette devise (ex. 25000 XOF).
              </span>
            </label>
            <Button onClick={handleConnect} disabled={acting}>
              {acting ? "Validation…" : "Connecter mon compte CinetPay"}
            </Button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red">{error}</p>}
      </div>
    </Card>
  );
}
