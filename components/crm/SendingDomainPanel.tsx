"use client";

// components/crm/SendingDomainPanel.tsx
//
// 🆕 MODULE PREMIUM — Configuration du domaine d'envoi.
//
// PARTI PRIS D'ONBOARDING. L'utilisateur type n'a jamais ouvert une zone DNS
// de sa vie. Lui présenter un tableau « TXT / CNAME / MX » sans contexte
// produit un abandon garanti. L'écran explique donc, dans l'ordre : ce que ça
// change concrètement (ses emails cessent de tomber en spam), où aller (chez
// le fournisseur du nom de domaine, pas chez AutoFunnel), quoi coller, et
// combien de temps attendre.
//
// Le ton reste factuel sur un point important : tant que la vérification n'a
// pas abouti, les emails continuent de partir normalement depuis le domaine
// partagé. Rien ne casse pendant l'attente — c'est ce qui permet de configurer
// sans stress.

import { useCallback, useEffect, useState } from "react";
import {
  AtSign,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Lock,
} from "lucide-react";

type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
};

type State = {
  domain: string | null;
  fromEmail: string | null;
  status: "none" | "pending" | "verified" | "failed";
  records: DnsRecord[];
  checkedAt: string | null;
};

function CopyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copier"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => {},
        );
      }}
      className="group flex w-full items-start gap-1.5 text-left"
    >
      <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-ink">{value}</span>
      {copied ? (
        <Check size={12} className="mt-0.5 shrink-0 text-success-ink" />
      ) : (
        <Copy size={12} className="mt-0.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
      )}
    </button>
  );
}

export function SendingDomainPanel() {
  const [state, setState] = useState<State | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [localPart, setLocalPart] = useState("contact");
  const [detaching, setDetaching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/email/sending-domain", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (json.ok) {
        setState(json.state as State);
        setAllowed(Boolean(json.allowed));
        const from = (json.state as State).fromEmail;
        if (from) setLocalPart(from.split("@")[0]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitDomain() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email/sending-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, localPart }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Enregistrement impossible.");
        return;
      }
      setState(json.state as State);
      setDomain("");
      setNotice("Domaine déclaré. Publiez les enregistrements ci-dessous chez votre fournisseur de nom de domaine.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email/sending-domain/verify", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Vérification impossible.");
        return;
      }
      const next = json.state as State;
      setState(next);
      setNotice(
        next.status === "verified"
          ? "Domaine vérifié. Vos emails partent désormais de votre adresse."
          : "Pas encore propagé. La mise à jour DNS peut prendre plusieurs heures — réessayez plus tard.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveLocalPart() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email/sending-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPart }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Enregistrement impossible.");
        return;
      }
      setState(json.state as State);
      setNotice("Adresse d'expédition mise à jour.");
    } finally {
      setBusy(false);
    }
  }

  async function detach() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email/sending-domain", { method: "DELETE" });
      if (!res.ok) {
        setError("Retrait impossible.");
        return;
      }
      await load();
      setDetaching(false);
      setNotice("Domaine retiré. Vos emails repartent du domaine partagé AutoFunnel.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-white p-10 text-center text-sm text-muted">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  const hasDomain = !!state?.domain;
  const verified = state?.status === "verified";

  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info-ink">
            <AtSign size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-ink">Envoyer depuis votre propre domaine</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Par défaut, vos emails partent d&apos;une adresse AutoFunnel avec
              votre nom en expéditeur. En rattachant votre domaine, ils partent
              de <strong className="text-ink">vous</strong> — ce qui améliore
              nettement la délivrabilité et la confiance de vos destinataires.
            </p>
          </div>
        </div>

        {/* Réservé aux forfaits supérieurs — annoncé sans bloquer la lecture. */}
        {!allowed && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent bg-accent-soft p-3 text-xs leading-relaxed text-ink">
            <Lock size={14} className="mt-0.5 shrink-0 text-accent-ink" />
            <span>
              Cette fonctionnalité est incluse à partir du plan{" "}
              <strong>Pro</strong>.{" "}
              <a href="/abonnement" className="font-semibold text-accent-ink underline underline-offset-2">
                Voir les forfaits
              </a>
            </span>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger-ink">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-lg border border-success bg-success-soft px-3 py-2 text-xs text-success-ink">
            {notice}
          </p>
        )}

        {/* ── Aucun domaine : formulaire de déclaration ──────────────────── */}
        {!hasDomain && (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Avant le @</span>
                <input
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                  placeholder="contact"
                  disabled={!allowed}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Votre domaine</span>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="ma-marque.com"
                  disabled={!allowed}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent disabled:opacity-50"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Vos emails partiront de{" "}
              <span className="font-mono text-ink">
                {localPart || "contact"}@{domain || "ma-marque.com"}
              </span>
              . Il faut être propriétaire du domaine pour pouvoir y publier les
              enregistrements de vérification.
            </p>
            <button
              type="button"
              onClick={submitDomain}
              disabled={busy || !allowed || !domain.trim()}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-accent-contrast transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Déclarer ce domaine
            </button>
          </div>
        )}

        {/* ── Domaine déclaré ────────────────────────────────────────────── */}
        {hasDomain && state && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">{state.fromEmail}</span>
              {verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-success-ink">
                  <ShieldCheck size={12} /> Vérifié
                </span>
              ) : state.status === "failed" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-danger-ink">
                  <TriangleAlert size={12} /> Échec
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-warning-ink">
                  En attente de vérification
                </span>
              )}
              {state.checkedAt && (
                <span className="text-[11px] text-muted">
                  Vérifié le {new Date(state.checkedAt).toLocaleString("fr-FR")}
                </span>
              )}
            </div>

            {!verified && (
              <>
                <div className="mt-4 rounded-lg bg-canvas p-3 text-xs leading-relaxed text-muted">
                  <strong className="text-ink">Ce qu&apos;il reste à faire :</strong>{" "}
                  connectez-vous chez le fournisseur où vous avez acheté{" "}
                  <span className="font-mono text-ink">{state.domain}</span> (OVH,
                  Namecheap, GoDaddy, Cloudflare…), ouvrez la zone DNS, et créez
                  les enregistrements ci-dessous. Puis revenez cliquer sur
                  « Vérifier maintenant ».
                  <br />
                  <strong className="text-ink">Pendant ce temps, rien ne casse :</strong>{" "}
                  vos emails continuent de partir normalement depuis le domaine
                  partagé AutoFunnel.
                </div>

                {state.records.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-canvas text-[10px] uppercase tracking-wider text-muted">
                          <th className="px-3 py-2 font-bold">Type</th>
                          <th className="px-3 py-2 font-bold">Nom</th>
                          <th className="px-3 py-2 font-bold">Valeur</th>
                          <th className="px-3 py-2 font-bold">État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.records.map((r, i) => (
                          <tr key={i} className="border-b border-line last:border-b-0 align-top">
                            <td className="px-3 py-2 font-mono font-bold text-ink">{r.type}</td>
                            <td className="max-w-[180px] px-3 py-2">
                              <CopyCell value={r.name} />
                            </td>
                            <td className="max-w-[280px] px-3 py-2">
                              <CopyCell value={r.value} />
                              {r.priority !== undefined && (
                                <span className="mt-0.5 block text-[10px] text-muted">
                                  Priorité {r.priority}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {r.status === "verified" ? (
                                <span className="text-success-ink">✓</span>
                              ) : (
                                <span className="text-muted">…</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  type="button"
                  onClick={verify}
                  disabled={busy || !allowed}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-accent-contrast transition hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  Vérifier maintenant
                </button>
              </>
            )}

            {verified && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block sm:max-w-[220px]">
                  <span className="text-xs font-bold uppercase text-muted">Adresse d&apos;envoi</span>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      value={localPart}
                      onChange={(e) => setLocalPart(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent"
                    />
                    <span className="shrink-0 font-mono text-xs text-muted">@{state.domain}</span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={saveLocalPart}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            )}

            <div className="mt-5 border-t border-line pt-4">
              {!detaching ? (
                <button
                  type="button"
                  onClick={() => setDetaching(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger-ink underline-offset-2 hover:underline disabled:opacity-50"
                >
                  <Trash2 size={13} /> Retirer ce domaine
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink">
                    Vos emails repartiront du domaine partagé AutoFunnel. Confirmer&nbsp;?
                  </span>
                  <button
                    type="button"
                    onClick={detach}
                    disabled={busy}
                    className="rounded-lg bg-danger px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Retirer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetaching(false)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SendingDomainPanel;
