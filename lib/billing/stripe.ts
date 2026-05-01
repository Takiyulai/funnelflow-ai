import Stripe from "stripe";

export const plans = {
  starter: {
    name: "Starter",
    price: 2900,
    currency: "eur",
    limits: { funnels: 3, systemeExport: false, importUrl: false }
  },
  pro: {
    name: "Pro",
    price: 4900,
    currency: "eur",
    limits: { funnels: 10, systemeExport: true, importUrl: false }
  },
  agency: {
    name: "Agency",
    price: 9700,
    currency: "eur",
    limits: { funnels: Infinity, systemeExport: true, importUrl: true }
  }
} as const;

export function createStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required for billing.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
