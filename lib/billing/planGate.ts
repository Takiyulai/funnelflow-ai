// lib/billing/planGate.ts
//
// 🆕 Helper CLIENT partagé pour uniformiser l'invite d'abonnement sur TOUTES les
// actions importantes gatées côté serveur (génération, clonage, régénération de
// section, campagnes email, workflows…). Chaque appelant, après un fetch en
// échec, fait : `if (handlePlanGate(res.status, data, notify)) return;`.

export type PlanGate = "subscription-required" | "plan-limit";

/** Détecte si une réponse d'API correspond à un blocage lié au forfait. */
export function detectPlanGate(status: number, body: unknown): PlanGate | null {
  const b = (body ?? {}) as { error?: string };
  if (status === 402 || b.error === "subscription_required") {
    return "subscription-required";
  }
  if (
    b.error === "funnel_quota_reached" ||
    b.error === "quota_exceeded" ||
    b.error === "feature_not_in_plan"
  ) {
    return "plan-limit";
  }
  return null;
}

/** Titre + message d'invite selon le type de blocage. */
export function planGateMessage(
  gate: PlanGate,
  serverMessage?: string,
): { title: string; description: string } {
  if (gate === "plan-limit") {
    return {
      title: "Limite de ton forfait atteinte",
      description:
        serverMessage ||
        "Passe à un forfait supérieur pour continuer, ou attends le renouvellement.",
    };
  }
  return {
    title: "Aucun forfait actif",
    description:
      serverMessage || "Passe à un forfait pour utiliser cette fonctionnalité.",
  };
}

type Notify = (m: { title: string; description: string }) => void;

/**
 * Traite un éventuel blocage de forfait : notifie l'utilisateur (via `notify`,
 * ex. un toast) puis redirige vers la page des forfaits. Retourne `true` si le
 * blocage a été géré (l'appelant doit alors `return`), `false` sinon.
 */
export function handlePlanGate(
  status: number,
  body: unknown,
  notify: Notify,
): boolean {
  const gate = detectPlanGate(status, body);
  if (!gate) return false;
  const serverMessage = (body as { message?: string } | undefined)?.message;
  notify(planGateMessage(gate, serverMessage));
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      window.location.href = "/abonnement";
    }, 1300);
  }
  return true;
}
