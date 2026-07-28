"use client";

// components/admin/AdminApiKeysPanel.tsx
// 🆕 Onglet « Clés API » du dashboard admin : consommation et solde par
// fournisseur. Les données viennent de /api/admin/api-credits (admin-only).
//
// Parti pris d'affichage : on distingue VISUELLEMENT un solde réel renvoyé par
// le fournisseur d'un comptage effectué par AutoFunnel. Confondre les deux
// donnerait une fausse impression de précision sur la facturation.

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, KeyRound, Loader2, RefreshCw } from "lucide-react";

type CreditSourceKind = "balance" | "counted" | "unknown";

type ApiKeyStatus = {
  id: string;
  label: string;
  role: string;
  envKey: string;
  configured: boolean;
  keyPreview: string | null;
  sourceKind: CreditSourceKind;
  used: number | null;
  remaining: number | null;
  total: number | null;
  totalLabel?: string;
  unit: string;
  error: string | null;
  note: string;
};

function formatAmount(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "$") {
    return `$${value.toFixed(2)}`;
  }
  return value.toLocaleString("fr-FR");
}

/** Part consommée, uniquement quand un total est réellement connu. */
function usageRatio(s: ApiKeyStatus): number | null {
  if (s.total === null || s.total <= 0 || s.used === null) return null;
  return Math.min(1, Math.max(0, s.used / s.total));
}

function SourceBadge({ kind }: { kind: CreditSourceKind }) {
  const map: Record<CreditSourceKind, { text: string; cls: string; title: string }> = {
    balance: {
      text: "Solde fournisseur",
      cls: "bg-[#31845C]/10 text-[#31845C]",
      title: "Chiffre renvoyé en direct par l'API du fournisseur.",
    },
    counted: {
      text: "Compté par AutoFunnel",
      cls: "bg-[#C7A436]/15 text-[#8A6F1F]",
      title:
        "Le fournisseur n'expose pas de quota : ce chiffre est mesuré depuis nos propres données.",
    },
    unknown: {
      text: "Indisponible",
      cls: "bg-canvas text-muted",
      title: "Aucune donnée de consommation exploitable.",
    },
  };
  const v = map[kind];
  return (
    <span
      title={v.title}
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${v.cls}`}
    >
      {v.text}
    </span>
  );
}

function ProviderCard({ s }: { s: ApiKeyStatus }) {
  const ratio = usageRatio(s);
  // 🆕 Solde à zéro ou négatif : ce n'est plus un « avertissement », c'est une
  // panne de service en cours. Un simple chiffre rouge se remarque trop peu.
  const depleted = s.remaining !== null && s.remaining <= 0;
  const low = !depleted && ratio !== null && ratio >= 0.85;

  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        depleted ? "border-danger" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-ink">{s.label}</h3>
            <SourceBadge kind={s.sourceKind} />
            {!s.configured && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                Clé absente
              </span>
            )}
          </div>
          {s.role && <p className="mt-1 text-xs text-muted">{s.role}</p>}
        </div>
        <div className="shrink-0 text-right">
          <code className="rounded bg-canvas px-2 py-1 font-mono text-[11px] text-muted">
            {s.envKey}
          </code>
          {s.keyPreview && (
            <div className="mt-1 font-mono text-[11px] text-muted">{s.keyPreview}</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Consommé
          </div>
          <div className="mt-0.5 text-lg font-black text-ink">
            {formatAmount(s.used, s.unit)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Restant
          </div>
          <div
            className={`mt-0.5 text-lg font-black ${
              depleted || low ? "text-danger-ink" : "text-ink"
            }`}
          >
            {formatAmount(s.remaining, s.unit)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {s.totalLabel ?? "Total"}
          </div>
          <div className="mt-0.5 text-lg font-black text-ink">
            {formatAmount(s.total, s.unit)}
          </div>
        </div>
      </div>

      {depleted && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger bg-danger-soft p-2.5 text-[11px] font-semibold text-danger-ink">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            Solde épuisé — ce fournisseur refuse tous les appels. Recharger pour
            rétablir le service.
          </span>
        </div>
      )}

      {ratio !== null && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className={`h-full rounded-full ${
                depleted || low ? "bg-danger" : "bg-success"
              }`}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {depleted
              ? "Solde épuisé"
              : `${Math.round(ratio * 100)} % consommé`}
          </div>
        </div>
      )}

      {s.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{s.error}</span>
        </div>
      )}

      {s.note && <p className="mt-3 text-[11px] leading-relaxed text-muted">{s.note}</p>}
    </div>
  );
}

export function AdminApiKeysPanel() {
  const [providers, setProviders] = useState<ApiKeyStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-credits", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || `Erreur ${res.status}`);
        setProviders(null);
        return;
      }
      setProviders(json.providers as ApiKeyStatus[]);
      setFetchedAt(json.fetchedAt as string);
    } catch {
      setError("Connexion impossible.");
      setProviders(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#08498D]/10 text-[#08498D]">
            <KeyRound size={15} />
          </span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-ink">
              Clés API et crédits
            </h2>
            {fetchedAt && (
              <p className="text-[11px] text-muted">
                Relevé du{" "}
                {new Date(fetchedAt).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-canvas disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !providers && (
        <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-muted">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Interrogation des fournisseurs…
        </div>
      )}

      {providers && (
        <div className="grid gap-3 lg:grid-cols-2">
          {providers.map((p) => (
            <ProviderCard key={p.id} s={p} />
          ))}
        </div>
      )}

      <p className="mt-4 rounded-lg bg-canvas p-3 text-[11px] leading-relaxed text-muted">
        Les clés ne sont jamais transmises au navigateur : seuls les 4 derniers
        caractères sont affichés, pour identifier une clé sans l&apos;exposer. Un
        badge « Solde fournisseur » signale un chiffre renvoyé en direct par
        l&apos;API ; « Compté par AutoFunnel » signale une mesure faite depuis nos
        propres données, faute de quota exposé par le fournisseur.
      </p>
    </div>
  );
}

export default AdminApiKeysPanel;
