// lib/billing/stripe.ts
import Stripe from "stripe";

// La matrice de plans (source de vérité, sans dépendance Stripe) vit désormais
// dans lib/billing/plans.ts. On la ré-exporte ici pour compatibilité.
export { PLANS, PLAN_ORDER, getPlan, getStripePriceId, isPlanId } from "./plans";
export type { PlanId, Plan, PlanLimits } from "./plans";

export function createStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required for billing");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
