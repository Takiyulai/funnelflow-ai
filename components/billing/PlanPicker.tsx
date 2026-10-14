"use client";

// Choix de plan + deux parcours de paiement présentés sans exposer les noms
// des prestataires. SasPay reste prioritaire pour l'Afrique ; Chariow sert de
// solution secondaire pour les cartes internationales.

import { useState } from "react";
import { Check, CreditCard, Globe2, KeyRound, Loader2, Smartphone, Sparkles } from "lucide-react";
import { FREE_PLAN, PLAN_ORDER, PLANS, type Plan, type PlanId } from "@/lib/billing/plans";
import type { PaymentRegion } from "@/lib/geo/paymentRegion";
import { getChariowCheckoutUrl } from "@/lib/payments/providers/chariow";

function featureLines(plan: Plan): string[] {
  const l = plan.limits;
  const lines: string[] = [];
  lines.push("4 agents IA spécialisés sur chaque tunnel");
  lines.push(
    l.funnels === Infinity
      ? "Tunnels et publications illimités"
      : `${l.funnels} tunnels · ${l.publishedFunnels} publié${l.publishedFunnels > 1 ? "s" : ""}`,
  );
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
  lines.push("Parcours multi-pages et redirections automatiques");
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

const PLAN_DESCRIPTIONS: Record<PlanId, string> = {
  starter: "Pour lancer, publier et commencer à vendre sans empiler les outils.",
  pro: "Le meilleur équilibre pour automatiser tes ventes et accélérer.",
  agency: "Pour produire en volume et piloter plusieurs activités sans plafond.",
};

export function PlanPicker({
  currentPlan,
  isActive,
  hasCustomer,
  initialPlan,
  initialPaymentRegion,
}: {
  currentPlan: PlanId | null;
  isActive: boolean;
  hasCustomer: boolean;
  initialPlan?: PlanId | null;
  initialPaymentRegion?: PaymentRegion | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(initialPlan ?? null);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseMsg, setLicenseMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function activateInternationalPurchase() {
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setLicenseMsg({ ok: true, text: "Accès activé. Redirection en cours…" });
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 900);
        return;
      }
      const reasons: Record<string, string> = {
        expired: "Ce code d'activation a expiré.",
        revoked: "Ce code d'activation a été révoqué. Contacte le support.",
        invalid: "Code introuvable. Vérifie le message reçu après ton paiement.",
      };
      setLicenseMsg({
        ok: false,
        text:
          data?.error === "limit_reached"
            ? "Ce code a atteint sa limite d'activation. Contacte le support."
            : reasons[data?.status as string] ?? "Activation impossible pour le moment.",
      });
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

  async function startSasPayCheckout() {
    setBusy("saspay");
    setError(null);
    try {
      const res = await fetch("/api/payments/saspay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planForPayment }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      const messages: Record<string, string> = {
        saspay_not_configured: "Le paiement mobile n'est pas encore disponible sur cet environnement.",
        checkout_creation_in_progress:
          "Une session est déjà en cours de création. Réessaie dans quelques secondes.",
        invalid_plan: "Le plan sélectionné n'est pas valide.",
      };
      setError(messages[data?.error as string] ?? "Le paiement est momentanément indisponible.");
    } catch {
      setError("Erreur réseau pendant l'ouverture du paiement. Réessaie.");
    }
    setBusy(null);
  }

  const planForPayment = selectedPlan ?? "pro";
  const internationalCheckoutUrl = getChariowCheckoutUrl(planForPayment);
  const recommendedRegion = initialPaymentRegion ?? "africa";
  const africaRecommended = recommendedRegion === "africa";

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Pour tester toute la méthode et construire ton premier tunnel.
          </p>
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
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {PLAN_DESCRIPTIONS[id]}
              </p>

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

      {/* ─── 2. Paiement ─── */}
      <div id="payment-methods" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-black text-ink">
          Choisis ton moyen de paiement
          {selectedPlan ? (
            <span className="ml-2 text-sm font-semibold text-emerald-600">
              — plan {PLANS[planForPayment].name} · {PLANS[planForPayment].priceEur}€/mois
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Choisis simplement la zone depuis laquelle tu souhaites payer.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className={`rounded-2xl bg-surface p-5 ${
            africaRecommended
              ? "border-2 border-[#C7A436] shadow-[0_14px_36px_rgba(199,164,54,0.12)]"
              : "border border-line"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-ink">
                <Smartphone size={17} className="text-[#C7A436]" />
                Paiement depuis l'Afrique
              </div>
              {africaRecommended && (
                <span className="rounded-full bg-[#C7A436]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#806512]">
                  Recommandé pour toi
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Mobile Money et carte bancaire. Paiement sécurisé en F CFA avec
              activation automatique du plan après confirmation.
            </p>
            <div className="mt-4 rounded-xl border border-line bg-canvas px-3 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Montant contrôlé par AutoFunnel AI</span>
                <span className="font-black text-ink">
                  {PLANS[planForPayment].priceXof.toLocaleString("fr-FR")} F CFA
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={startSasPayCheckout}
              disabled={busy !== null}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#C7A436] py-3 text-sm font-bold text-[#080E1A] transition hover:bg-[#D6B94F] disabled:opacity-50"
            >
              {busy === "saspay" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Payer depuis l'Afrique →"
              )}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Ton accès est activé uniquement après confirmation sécurisée du paiement.
            </p>
          </div>

          <div className={`rounded-2xl bg-surface p-5 ${
            !africaRecommended
              ? "border-2 border-[#C7A436] shadow-[0_14px_36px_rgba(199,164,54,0.12)]"
              : "border border-line"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-ink">
                <Globe2 size={17} className="text-[#C7A436]" />
                Paiement international
              </div>
              {!africaRecommended && (
                <span className="rounded-full bg-[#C7A436]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#806512]">
                  Recommandé pour toi
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Idéal pour payer par carte bancaire depuis l'Europe, l'Amérique
              ou une autre région hors d'Afrique.
            </p>
            <div className="mt-4 rounded-xl border border-line bg-canvas px-3 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Montant du plan {PLANS[planForPayment].name}</span>
                <span className="font-black text-ink">
                  {PLANS[planForPayment].priceEur} € / mois
                </span>
              </div>
            </div>
            {internationalCheckoutUrl ? (
              <a
                href={internationalCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#C7A436] py-3 text-sm font-bold text-ink transition hover:bg-[#C7A436]/10"
              >
                <CreditCard size={16} className="mr-2" />
                Payer depuis l'international →
              </a>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-center text-xs font-semibold text-amber-800">
                Le paiement international est temporairement indisponible.
              </div>
            )}

            <details className="mt-4 rounded-xl border border-line bg-canvas p-3">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-ink">
                <KeyRound size={13} className="text-[#C7A436]" />
                J'ai déjà payé et reçu un code d'activation
              </summary>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(event) => setLicenseKey(event.target.value)}
                  placeholder="Code reçu après le paiement"
                  aria-label="Code d'activation"
                  className="focus-ring min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70"
                />
                <button
                  type="button"
                  onClick={activateInternationalPurchase}
                  disabled={busy !== null || !licenseKey.trim()}
                  className="min-h-10 shrink-0 rounded-lg bg-[#C7A436] px-4 text-sm font-bold text-[#080E1A] transition hover:bg-[#D6B94F] disabled:opacity-50"
                >
                  {busy === "license" ? <Loader2 className="mx-auto animate-spin" size={15} /> : "Activer"}
                </button>
              </div>
              {licenseMsg && (
                <p className={`mt-2 text-xs font-semibold ${licenseMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {licenseMsg.text}
                </p>
              )}
            </details>
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
