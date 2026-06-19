// app/(app)/layout.tsx
//
// Garde d'accès de TOUT l'espace applicatif (dashboard, éditeur, CRM, leads…).
// Exige : (1) un utilisateur connecté, (2) un abonnement actif si le gating est
// activé (BILLING_ENFORCED=true). Sinon → redirection.
//
// La page /abonnement vit HORS de ce groupe (app/abonnement) : elle reste donc
// accessible à un utilisateur connecté mais non abonné (pas de boucle de
// redirection).

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(user.id);
  if (!access.hasAccess) redirect("/abonnement");

  return <>{children}</>;
}
