"use client";

// app/abonnement/success/page.tsx
//
// 🆕 CinetPay — success_url (Point 2/8). L'utilisateur atterrit ici juste
// après avoir payé sur l'interface CinetPay. L'ACTIVATION réelle de la
// licence se fait de façon asynchrone via le webhook /api/webhooks/cinetpay
// (re-check canonique côté serveur, cf. lib/billing/cinetpayLicense.ts) —
// cette page ne fait donc AUCUNE activation elle-même : elle patiente
// quelques secondes en sondant /api/billing/me, le temps que le webhook
// (généralement quasi instantané) ait pu passer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";

type Phase = "checking" | "active" | "pending";

export default function CinetpaySuccessPage() {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 8; // ~24s au total (poll toutes les 3s)

    async function poll() {
      try {
        const res = await fetch("/api/billing/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok && data?.hasAccess) {
          setPhase("active");
          return;
        }
      } catch {
        /* on retente */
      }
      if (!alive) return;
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        setPhase("pending");
      } else {
        setTimeout(poll, 3000);
      }
    }

    poll();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <div className="mx-auto mt-16 max-w-md text-center">
        {phase === "checking" && (
          <>
            <Loader2 className="mx-auto animate-spin text-emerald-600" size={40} />
            <h1 className="mt-4 text-2xl font-black text-ink">
              Vérification du paiement…
            </h1>
            <p className="mt-2 text-sm text-muted">
              Ton paiement Mobile Money a bien été reçu par CinetPay. On
              active ton accès — ça prend généralement quelques secondes.
            </p>
          </>
        )}

        {phase === "active" && (
          <>
            <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
            <h1 className="mt-4 text-2xl font-black text-ink">
              Abonnement activé !
            </h1>
            <p className="mt-2 text-sm text-muted">
              Ton accès à AutoFunnel AI est débloqué pour 30 jours. Passé ce
              délai, reviens sur cette page pour renouveler ton paiement.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Aller au tableau de bord →
            </Link>
          </>
        )}

        {phase === "pending" && (
          <>
            <Clock className="mx-auto text-amber-500" size={40} />
            <h1 className="mt-4 text-2xl font-black text-ink">
              Activation en cours
            </h1>
            <p className="mt-2 text-sm text-muted">
              Le paiement met un peu plus de temps que d&apos;habitude à être
              confirmé. Ton accès s&apos;activera automatiquement dès que ce
              sera fait — pas besoin de repayer.
            </p>
            <Link
              href="/abonnement"
              className="mt-6 inline-block rounded-xl border border-line bg-canvas px-6 py-3 text-sm font-bold text-ink transition hover:bg-surface"
            >
              Retour à l&apos;abonnement
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
