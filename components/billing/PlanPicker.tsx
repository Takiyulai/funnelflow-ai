"use client";

// Choix de plan + paiement Chariow. Les intégrations historiques restent
// disponibles côté serveur pour la compatibilité, mais ne sont plus proposées
// comme moyens de souscription sur cette page.

import { useEffect, useState } from "react";
import { Check, Loader2, KeyRound, Smartphone, Sparkles } from "lucide-react";
import { FREE_PLAN, PLAN_ORDER, PLANS, type Plan, type PlanId } from "@/lib/billing/plans";

function featureLines(plan: Plan): string[] {
  const l = plan.limits;
  const lines: string[] = [];
  lines.push("4 agents IA spécialisés sur chaque tunnel");
  lines.push(l.funnels === Infinity ? "Tunnels illimités" : `${l.funnels} tunnels`);
  lines.push(
    l.aiFunnelGensPerMonth === Infinity
      ? "Générations IA de tunnel illimitées"
      : `${l.aiFunnelGensPerMonth} générations IA de tunnel / mois`,
  );
  if (l.urlImport) lines.push("Import / clonage par URL");
  if (l.sectionRegeneration) {
    // 🆕 La régénération IA couvre désormais les sections ET les pages entières.
    lines.push(
      l.aiCopyRegensPerMonth === Infinity
        ? "Régénération IA des sections & pages (illimitée)"
        : `Régénération IA des sections & pages (${l.aiCopyRegensPerMonth}/mois)`,
    );
  }
  // Édition avancée des pages (réorganisation par glisser-déposer, redirections
  // auto) : incluse dès qu'un plan est actif.
  lines.push("Gestion des pages : glisser-déposer + redirections auto");
  if (l.crm) lines.push("CRM leads & contacts");
  if (l.leadsExport) lines.push("Export CSV des leads");
  if (l.campaigns)
    lines.push(
      l.monthlyEmailSends === Infinity
        ? "Campagnes email illimitées"
        : `Campagnes email (${l.monthlyEmailSends.toLocaleString("fr-FR")}/mois)`,
    );
  if (l.aiSequenceGensPerMonth > 0) {
    lines.push(
      l.aiSequenceGensPerMonth === Infinity
        ? "Séquences d'emails IA illimitées"
        : `${l.aiSequenceGensPerMonth} séquence${l.aiSequenceGensPerMonth > 1 ? "s" : ""} d'emails IA / mois`,
    );
  }
  if (l.workflows) lines.push("Automatisations (workflows)");
  if (l.multiPlatform) lines.push("Options multi-plateforme");
  if (l.systemeExport) lines.push("Export systeme.io prêt en 1 clic");
  if (l.clientWorkspaces > 0) lines.push(`${l.clientWorkspaces} espaces clients`);
  if (l.customDomains === Infinity) lines.push("Domaines personnalisés illimités");
  else if (l.customDomains > 0) lines.push(`${l.customDomains} domaine personnalisé`);
  if (l.prioritySupport) lines.push("Support prioritaire");
  return lines;
}

/** URL d'achat Chariow par plan (produits de type Licence sur la boutique). */
function chariowPlanUrl(plan: PlanId): string | null {
  const map: Record<PlanId, string | undefined> = {
    starter: process.env.NEXT_PUBLIC_CHARIOW_URL_STARTER,
    pro: process.env.NEXT_PUBLIC_CHARIOW_URL_PRO,
    agency: process.env.NEXT_PUBLIC_CHARIOW_URL_AGENCY,
  };
  const url = map[plan]?.trim() || process.env.NEXT_PUBLIC_CHARIOW_STORE_URL?.trim();
  return url || null;
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
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(initialPlan ?? null);

  // ── Activation par clé de licence Chariow ──────────────────────────────
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseMsg, setLicenseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<{
    active: boolean;
    plan: string | null;
    expiresAt: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/license/validate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.ok) {
          setLicenseStatus({ active: d.active, plan: d.plan, expiresAt: d.expiresAt });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function activateLicense() {
    const key = licenseKey.trim();
    if (!key) return;
    setBusy("license");
    setLicenseMsg(null);
    try {
      const res = await fetch("/api/license/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key }),
      });
      const d = await res.json();
      if (d?.ok) {
        setLicenseMsg({ ok: true, text: "✓ Licence activée ! Ton accès est débloqué." });
        setLicenseStatus({ active: true, plan: d.plan, expiresAt: d.expiresAt });
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1200);
      } else {
        const reasons: Record<string, string> = {
          expired: "Cette licence a expiré. Renouvelle ton abonnement sur la boutique.",
          revoked: "Cette licence a été révoquée. Contacte le support.",
          invalid: "Clé de licence introuvable. Vérifie la clé reçue par email après ton achat.",
        };
        setLicenseMsg({
          ok: false,
          text:
            d?.error === "limit_reached"
              ? "Cette licence a atteint son nombre maximum d'activations. Contacte le support."
              : reasons[d?.status as string] ??
                (d?.error === "chariow_not_configured"
                  ? "Le paiement Chariow n'est pas encore configuré. Réessaie plus tard."
                  : "Activation impossible. Vérifie ta clé."),
        });
      }
    } catch {
      setLicenseMsg({ ok: false, text: "Erreur réseau. Réessaie." });
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

  const planForPayment = selectedPlan ?? "pro";
  const chariowUrl = chariowPlanUrl(planForPayment);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {licenseStatus?.active && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Licence Chariow active
          {licenseStatus.plan ? ` — plan ${licenseStatus.plan}` : ""}
          {licenseStatus.expiresAt
            ? ` (jusqu'au ${new Date(licenseStatus.expiresAt).toLocaleDateString("fr-FR")})`
            : ""}
        </div>
      )}

      {/* ─── 1. Choix du plan ─── */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{FREE_PLAN.name}</p>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-black text-ink">0€</span>
            <span className="mb-1.5 text-sm text-muted">sans limite de durée</span>
          </div>
          <ul className="mt-5 flex-1 space-y-2.5">
            {["4 agents IA spécialisés", "1 tunnel en édition", "3 générations IA au total", "10 régénérations IA au total", "50 contacts en lecture CRM", "Aucune publication incluse"].map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-ink">
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-line bg-canvas py-3 text-center text-sm font-bold text-muted">
            Inclus avec ton compte
          </div>
        </div>
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = isActive && currentPlan === id;
          const isRecommended = id === "pro";
          const isSelected = selectedPlan === id;
          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                isRecommended
                  ? "border-[#C7A436] bg-[#C7A436]/[0.06] shadow-[0_16px_40px_rgba(199,164,54,0.16)] ring-2 ring-[#C7A436]/20"
                  : isSelected
                    ? "border-emerald-500 shadow-lg"
                    : "border-line bg-surface"
              }`}
            >
              {isRecommended && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-[#C7A436] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#080E1A] shadow-sm">
                  <Sparkles size={12} /> Recommandé pour débuter
                </span>
              )}
              <p
                className={`text-xs font-bold uppercase tracking-wider ${
                  isRecommended ? "text-[#9A7919]" : "text-emerald-600"
                }`}
              >
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
                    onClick={() => {
                      setSelectedPlan(id);
                      document
                        .getElementById("payment-methods")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${
                      isSelected
                        ? isRecommended
                          ? "bg-[#C7A436] text-[#080E1A] hover:bg-[#D6B94F]"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                        : isRecommended
                          ? "border border-[#C7A436] text-[#9A7919] hover:bg-[#C7A436]/10"
                          : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {isSelected ? "✓ Plan sélectionné" : `Choisir ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 2. Paiement Chariow ─── */}
      <div id="payment-methods" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-black text-ink">
          Paiement avec Chariow
          {selectedPlan ? (
            <span className="ml-2 text-sm font-semibold text-emerald-600">
              — plan {PLANS[planForPayment].name} · {PLANS[planForPayment].priceEur}€/mois
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Règle par Mobile Money ou carte bancaire depuis la page de paiement sécurisée Chariow.
        </p>

        <div className="mt-4 max-w-2xl">
          <div className="rounded-2xl border-2 border-emerald-500 bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-ink">
                <Smartphone size={17} className="text-emerald-600" />
                Chariow
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Recommandé
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Mobile Money (Orange, MTN, Wave, Moov…), cartes bancaires et
              moyens de paiement africains. Après l'achat, tu reçois une{" "}
              <b className="text-ink">clé de licence par email</b> — ton accès
              s'active automatiquement (ou saisis la clé ci-dessous).
            </p>
            {chariowUrl ? (
              <a
                href={chariowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full rounded-xl bg-emerald-600 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Payer avec Chariow →
              </a>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-center text-xs font-semibold text-amber-800">
                Boutique en cours de configuration — réessaie bientôt.
              </div>
            )}

            {/* Activation par clé de licence */}
            <div className="mt-4 rounded-xl border border-line bg-canvas p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <KeyRound size={13} className="text-emerald-600" />
                J'ai déjà une clé de licence
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="ABCD-1234-EFGH-5678"
                  className="focus-ring min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70"
                />
                <button
                  type="button"
                  onClick={activateLicense}
                  disabled={busy !== null || !licenseKey.trim()}
                  className="shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === "license" ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : (
                    "Activer"
                  )}
                </button>
              </div>
              {licenseMsg && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    licenseMsg.ok ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {licenseMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
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
