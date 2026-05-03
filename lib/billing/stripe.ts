// lib/stripe/client.ts
import Stripe from "stripe";

export const plans = {
  starter: {
    name: "Starter",
    price: 2900,
    currency: "eur",
    limits: {
      funnels: 3,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: false,
      urlImport: false,
      sectionRegeneration: false,
      clientWorkspaces: 0,
      prioritySupport: false,
    },
  },
  pro: {
    name: "Pro",
    price: 5900,
    currency: "eur",
    limits: {
      funnels: 15,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: true,
      urlImport: false,
      sectionRegeneration: true,
      clientWorkspaces: 0,
      prioritySupport: true,
    },
  },
  agency: {
    name: "Agency",
    price: 9700,
    currency: "eur",
    limits: {
      funnels: Infinity,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: true,
      urlImport: true,
      sectionRegeneration: true,
      clientWorkspaces: 25,
      prioritySupport: true,
    },
  },
} as const;

export type PlanId = keyof typeof plans;

export function createStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required for billing");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
