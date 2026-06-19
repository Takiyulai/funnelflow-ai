"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { PLAN_ORDER, PLANS, type Plan, type PlanId } from "@/lib/billing/plans";

function featureLines(plan: Plan): string[] {
  const l = plan.limits;
  const lines: string[] = [];
  lines.push(l.funnels === Infinity ? "Tunnels illimités" : `${l.funnels} tunnels`);
  if (l.urlImport) lines.push("Import / clonage par URL");
  if (l.sectionRegeneration) lines.push("Régénération IA des sections");
  if (l.crm) lines.push("CRM leads & contacts");
  if (l.leadsExport) lines.push("Export CSV des leads");
  if (l.campaigns)
    lines.push(
      l.monthlyEmailSends === Infinity
        ? "Campagnes email illimitées"
        : `Campagnes email (${l.monthlyEmailSends.toLocaleString("fr-FR")}/mois)`,
    );
  if (l.workflows) lines.push("Automatisations (workflows)");
  if (l.multiPlatform) lines.push("Options multi-plateforme");
  if (l.systemeExport) lines.push("Export systeme.io");
  if (l.clientWorkspaces > 0) lines.push(`${l.clientWorkspaces} espaces clients`);
  if (l.customDomains === Infinity) lines.push("Domaines personnalisés illimités");
  else if (l.customDomains > 0) lines.push(`${l.customDomains} domaine personnalisé`);
  if (l.prioritySupport) lines.push("Support prioritaire");
  return lines;
}

export function PlanPicker({
  currentPlan,
  isActive,
  hasCustomer,
  initialPlan,
}: {
  currentPlan: PlanId | null;
  isActive: boolean;
  hasCustomer: boolean;
  initialPlan?: PlanId | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data?.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError(data?.message || "Impossible de démarrer l'abonnement. Réessaie.");
    } catch {
      setError("Erreur réseau. Réessaie.");
    }
    setBusy(null);
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data?.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError(data?.message || "Portail indisponible.");
    } catch {
      setError("Erreur réseau. Réessaie.");
    }
    setBusy(null);
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = isActive && currentPlan === id;
          const highlighted = initialPlan ? initialPlan === id : id === "pro";
          return (
            <div
              key={id}
              className={`flex flex-col rounded-2xl border p-6 ${
                highlighted ? "border-emerald-500 shadow-lg" : "border-line"
              } bg-surface`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                {plan.name}
              </p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-black text-ink">{plan.priceEur}€</span>
                <span className="mb-1.5 text-sm text-muted">/ mois</span>
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {featureLines(plan).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={openPortal}
                    className="w-full rounded-xl border border-line bg-canvas py-3 text-sm font-bold text-ink transition hover:bg-surface disabled:opacity-50"
                  >
                    {busy === "portal" ? (
                      <Loader2 className="mx-auto animate-spin" size={16} />
                    ) : (
                      "Gérer mon abonnement"
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => subscribe(id)}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy === id ? (
                      <Loader2 className="mx-auto animate-spin" size={16} />
                    ) : isActive ? (
                      "Passer à ce plan"
                    ) : (
                      `Choisir ${plan.name}`
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasCustomer && !isActive && (
        <button
          type="button"
          onClick={openPortal}
          disabled={busy !== null}
          className="mt-5 text-sm text-muted underline hover:text-ink"
        >
          Gérer mes informations de facturation
        </button>
      )}
    </div>
  );
}
