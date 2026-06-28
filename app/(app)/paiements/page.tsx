// app/(app)/paiements/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { ConnectCard } from "@/components/billing/ConnectCard";
import { CinetpayCard } from "@/components/billing/CinetpayCard";

type Provider = "stripe" | "cinetpay";

export default function PaiementsPage() {
  const [provider, setProvider] = useState<Provider>("stripe");
  const [ready, setReady] = useState(false);

  // Pré-sélectionne le fournisseur déjà choisi par le créateur.
  useEffect(() => {
    fetch("/api/cinetpay/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.state?.provider) setProvider(j.state.provider as Provider);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const tab = (value: Provider, label: string) => (
    <button
      type="button"
      onClick={() => setProvider(value)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        provider === value
          ? "bg-ink text-white"
          : "bg-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-black text-ink">Paiements</h1>
          <p className="mt-1 text-sm text-muted">
            Choisissez votre solution d&apos;encaissement et connectez votre compte pour
            recevoir les ventes de vos tunnels.
          </p>
        </div>

        <div className="inline-flex w-fit gap-1 rounded-xl border border-line/60 bg-white/50 p-1">
          {tab("stripe", "Stripe (international)")}
          {tab("cinetpay", "CinetPay (Afrique)")}
        </div>

        {ready && (provider === "cinetpay" ? <CinetpayCard /> : <ConnectCard />)}
      </div>
    </AppShell>
  );
}
