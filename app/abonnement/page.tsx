// app/abonnement/page.tsx
//
// Page de choix / gestion d'abonnement. Vit HORS du groupe (app) pour rester
// accessible à un utilisateur connecté mais non encore abonné (la garde
// d'accès de (app) redirige justement ici).

import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/billing/subscription";
import { getActiveChariowLicense } from "@/lib/billing/chariow";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { isPlanId, type PlanId } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  // 🆕 Une licence Chariow active donne aussi accès (abonnement via Chariow).
  const license = await getActiveChariowLicense(user.id);
  const isActive =
    profile?.status === "active" || profile?.status === "trialing" || !!license;
  const sp = await searchParams;
  const rawPlan = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
  const initialPlan: PlanId | null = isPlanId(rawPlan) ? rawPlan : null;
  // 🆕 failed_url de CinetPay (Point 2) : paiement annulé/refusé côté Mobile
  // Money — on l'affiche simplement, l'utilisateur peut retenter directement.
  const cinetpayFailed =
    (Array.isArray(sp.cinetpay) ? sp.cinetpay[0] : sp.cinetpay) === "failed";

  const statusLabel: Record<string, string> = {
    active: "Abonnement actif",
    trialing: "Période d'essai",
    past_due: "Paiement en attente — régularise pour garder l'accès",
    canceled: "Abonnement annulé",
    inactive: "Aucun abonnement actif",
  };
  const status = license ? "active" : (profile?.status ?? "inactive");

  return (
    <AppShell>
      <h1 className="text-3xl font-black text-ink">Abonnement</h1>
      <p className="mt-2 text-sm text-muted">
        {isActive
          ? "Gère ton plan ou change d'offre à tout moment."
          : "Choisis un plan pour débloquer la génération de tunnels et l'ensemble de la plateforme."}
      </p>

      {cinetpayFailed && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Le paiement Mobile Money n&apos;a pas abouti (annulé ou refusé).
          Aucun montant n&apos;a été débité côté abonnement — tu peux
          retenter juste en dessous.
        </div>
      )}

      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink">
        <span
          className={`h-2 w-2 rounded-full ${
            isActive ? "bg-emerald-500" : status === "past_due" ? "bg-amber-500" : "bg-gray-400"
          }`}
        />
        {statusLabel[status] ?? status}
      </div>

      <div className="mt-8 max-w-5xl">
        <PlanPicker
          currentPlan={profile?.plan ?? null}
          isActive={isActive}
          hasCustomer={Boolean(profile?.stripe_customer_id)}
          initialPlan={initialPlan}
        />
      </div>

      {/* 🆕 RGPD — Zone de danger : suppression définitive du compte. */}
      <DeleteAccountSection />
    </AppShell>
  );
}
