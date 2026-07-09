// app/(app)/layout.tsx
//
// Garde d'accès de TOUT l'espace applicatif (dashboard, éditeur, CRM, leads…).
// Exige UNIQUEMENT un utilisateur connecté.
//
// 🆕 CHANGEMENT DE COMPORTEMENT DU GATING : un utilisateur connecté SANS
// abonnement peut désormais EXPLORER librement toute l'application (dashboard,
// éditeur, CRM, emails, workflows…). On ne le redirige PLUS vers /abonnement à
// chaque navigation. Le gating s'applique seulement aux ACTIONS DÉCISIVES
// (génération / « Lancer mes agents IA », clonage, campagnes, séquences,
// régénération…), bloquées CÔTÉ SERVEUR par guardApiAccess (402
// subscription_required) et rappelées côté client par handlePlanGate, qui
// affiche l'invite d'abonnement puis renvoie vers /abonnement. Explorer = libre ;
// agir = abonnement requis.

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
