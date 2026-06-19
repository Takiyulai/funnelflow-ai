// app/abonnement/page.tsx
//
// Page de choix / gestion d'abonnement. Vit HORS du groupe (app) pour rester
// accessible à un utilisateur connecté mais non encore abonné (la garde
// d'accès de (app) redirige justement ici).

import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/billing/subscription";
import { PlanPicker } from "@/components/billing/PlanPicker";
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
  const isActive = profile?.status === "active" || profile?.status === "trialing";
  const sp = await searchParams;
  const rawPlan = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
  const initialPlan: PlanId | null = isPlanId(rawPlan) ? rawPlan : null;

  const statusLabel: Record<string, string> = {
    active: "Abonnement actif",
    trialing: "Période d'essai",
    past_due: "Paiement en attente — régularise pour garder l'accès",
    canceled: "Abonnement annulé",
    inactive: "Aucun abonnement actif",
  };
  const status = profile?.status ?? "inactive";

  return (
    <AppShell>
      <h1 className="text-3xl font-black text-ink">Abonnement</h1>
      <p className="mt-2 text-sm text-muted">
        {isActive
          ? "Gère ton plan ou change d'offre à tout moment."
          : "Choisis un plan pour débloquer la génération de tunnels et l'ensemble de la plateforme."}
      </p>

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
    </AppShell>
  );
}
