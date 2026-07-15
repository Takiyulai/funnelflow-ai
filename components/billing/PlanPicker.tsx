"use client";

// 🆕 Choix de plan + MÉTHODE DE PAIEMENT :
//   - Chariow (ACTIF) : paiement Mobile Money / carte, adapté à l'Afrique.
//     L'achat se fait sur la boutique Chariow (produit de type Licence) →
//     l'utilisateur reçoit une clé de licence → il l'active ici (ou le
//     webhook Pulse l'active automatiquement via son email d'achat).
//   - Stripe (MUET) : affiché grisé avec badge « Bientôt disponible ».
// Les abonnés Stripe historiques gardent leur portail de gestion.

import { useEffect, useState } from "react";
import { Check, Loader2, KeyRound, Smartphone, CreditCard } from "lucide-react";
import { PLAN_ORDER, PLANS, type Plan, type PlanId } from "@/lib/billing/plans";

function featureLines(plan: Plan): string[] {
  const l = plan.limits;
  const lines: string[] = [];
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
  if (l.workflows) lines.push("Automatisations (workflows)");
  if (l.multiPlatform) lines.push("Options multi-plateforme");
  if (l.systemeExport) lines.push("Export systeme.io");
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

  // ── 🆕 Paiement Mobile Money via CinetPay (Bénin, XOF) ─────────────────
  // Abonnement "manuel" : le paiement active une licence de 30 jours (pas de
  // prélèvement récurrent automatique côté CinetPay) — l'utilisateur repaie
  // lui-même à l'échéance, comme pour la licence Chariow.
  const [cinetpayError, setCinetpayError] = useState<string | null>(null);

  async function payWithCinetpay() {
    setBusy("cinetpay");
    setCinetpayError(null);
    try {
      const res = await fetch("/api/billing/cinetpay/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planForPayment }),
      });
      const data = await res.json();
      if (data?.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }
      setCinetpayError(
        data?.error === "cinetpay_not_configured"
          ? "Le paiement Mobile Money n'est pas encore configuré. Réessaie plus tard."
          : "Impossible d'initier le paiement. Réessaie.",
      );
    } catch {
      setCinetpayError("Erreur réseau. Réessaie.");
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
      <div className="grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = isActive && currentPlan === id;
          const highlighted = selectedPlan ? selectedPlan === id : id === "pro";
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
                    onClick={() => {
                      setSelectedPlan(id);
                      document
                        .getElementById("payment-methods")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${
                      selectedPlan === id
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {selectedPlan === id ? "✓ Plan sélectionné" : `Choisir ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 2. Méthode de paiement ─── */}
      <div id="payment-methods" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-black text-ink">
          Méthode de paiement
          {selectedPlan ? (
            <span className="ml-2 text-sm font-semibold text-emerald-600">
              — plan {PLANS[planForPayment].name} (
              {PLANS[planForPayment].priceEur}€/mois par carte, ou{" "}
              {PLANS[planForPayment].priceXof.toLocaleString("fr-FR")} FCFA via
              Mobile Money)
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Choisis comment régler ton abonnement — le prix affiché dépend du
          moyen de paiement choisi (€ par carte, FCFA en Mobile Money).
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {/* Chariow — ACTIF */}
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

          {/* 🆕 CinetPay — Mobile Money direct (Bénin, XOF) */}
          <div className="rounded-2xl border-2 border-emerald-500 bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-ink">
                <Smartphone size={17} className="text-emerald-600" />
                Mobile Money (CinetPay)
              </div>
            </div>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-2xl font-black text-ink">
                {PLANS[planForPayment].priceXof.toLocaleString("fr-FR")}
              </span>
              <span className="mb-0.5 text-xs text-muted">FCFA</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Orange Money, MTN, Moov… au Bénin. Réglage unique qui débloque{" "}
              <b className="text-ink">30 jours d&apos;accès</b> — pas de
              prélèvement automatique : reviens ici renouveler à l&apos;échéance.
            </p>
            <button
              type="button"
              onClick={payWithCinetpay}
              disabled={busy !== null}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "cinetpay" ? (
                <Loader2 className="mx-auto animate-spin" size={16} />
              ) : (
                "Payer avec Mobile Money →"
              )}
            </button>
            {cinetpayError && (
              <p className="mt-2 text-xs font-semibold text-red-600">{cinetpayError}</p>
            )}
          </div>

          {/* Stripe — MUET (bientôt) */}
          <div className="relative rounded-2xl border border-line bg-surface p-5 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-ink">
                <CreditCard size={17} className="text-muted" />
                Stripe
              </div>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                Bientôt disponible
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Paiement par carte bancaire internationale (Visa, Mastercard) avec
              renouvellement automatique. Cette option arrive très bientôt.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl border border-line bg-canvas py-3 text-sm font-bold text-muted"
            >
              Bientôt
            </button>
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
