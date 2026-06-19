// lib/billing/plans.ts
//
// Source de vérité des plans d'ABONNEMENT à la plateforme FunnelFlow AI.
//
// ⚠️ Ne PAS confondre avec le paiement "one-time" de lib/billing/orders.ts :
//    celui-ci concerne le client FINAL qui achète le produit d'un tunnel.
//    Ici on parle de l'abonnement RÉCURRENT du solopreneur à FunnelFlow.
//
// Ce module est PUR (aucun import du SDK Stripe) → il peut être importé aussi
// bien côté serveur que côté client (Sidebar, page /abonnement, landing).
// Le mapping vers les `price_id` Stripe se fait via variables d'environnement
// (jamais en dur), car les ids diffèrent entre test et live.

export type PlanId = "starter" | "pro" | "agency";

export type PlanLimits = {
  /** Nombre max de tunnels (générés + clonés). Infinity = illimité. */
  funnels: number;
  /** Import / clonage d'un tunnel depuis une URL externe. */
  urlImport: boolean;
  /** Régénération IA d'une section. */
  sectionRegeneration: boolean;
  /** CRM : gestion des contacts / leads. */
  crm: boolean;
  /** Export CSV des leads. */
  leadsExport: boolean;
  /** Campagnes email (broadcast). */
  campaigns: boolean;
  /** Plafond d'emails envoyés par mois (campagnes). Infinity = illimité. */
  monthlyEmailSends: number;
  /** Automatisations / workflows. */
  workflows: boolean;
  /** Export systeme.io (bonus de sortie). */
  systemeExport: boolean;
  /** Export HTML/CSS brut. */
  htmlExport: boolean;
  /** Options multi-plateforme étendues. */
  multiPlatform: boolean;
  /** Espaces de travail clients (mode agence). */
  clientWorkspaces: number;
  /** Domaines personnalisés rattachables (feature à venir). Infinity = illimité. */
  customDomains: number;
  /** Support prioritaire. */
  prioritySupport: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  /** Prix mensuel en euros (affichage). */
  priceEur: number;
  /** Nom de la variable d'env contenant le price_id Stripe récurrent. */
  envPriceKey: string;
  limits: PlanLimits;
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceEur: 29,
    envPriceKey: "STRIPE_PRICE_STARTER",
    limits: {
      funnels: 3,
      urlImport: false,
      sectionRegeneration: false,
      crm: true,
      leadsExport: true,
      campaigns: true,
      monthlyEmailSends: 500,
      workflows: false,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: false,
      clientWorkspaces: 0,
      customDomains: 0,
      prioritySupport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceEur: 59,
    envPriceKey: "STRIPE_PRICE_PRO",
    limits: {
      funnels: 15,
      urlImport: true,
      sectionRegeneration: true,
      crm: true,
      leadsExport: true,
      campaigns: true,
      monthlyEmailSends: 5000,
      workflows: true,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: true,
      clientWorkspaces: 0,
      customDomains: 1,
      prioritySupport: true,
    },
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceEur: 97,
    envPriceKey: "STRIPE_PRICE_AGENCY",
    limits: {
      funnels: Infinity,
      urlImport: true,
      sectionRegeneration: true,
      crm: true,
      leadsExport: true,
      campaigns: true,
      monthlyEmailSends: Infinity,
      workflows: true,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: true,
      clientWorkspaces: 25,
      customDomains: Infinity,
      prioritySupport: true,
    },
  },
};

/** Ordre croissant des plans (utile pour comparer / afficher). */
export const PLAN_ORDER: PlanId[] = ["starter", "pro", "agency"];

/** Clés de fonctionnalités booléennes activables par plan. */
export type BooleanFeature = {
  [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never;
}[keyof PlanLimits];

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "agency";
}

export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

/**
 * Récupère le price_id Stripe d'un plan depuis l'environnement.
 * Serveur uniquement (process.env). Retourne null si non configuré.
 */
export function getStripePriceId(id: PlanId): string | null {
  const key = PLANS[id].envPriceKey;
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

/** True si la fonctionnalité booléenne est incluse dans le plan. */
export function planHasFeature(id: PlanId, feature: BooleanFeature): boolean {
  return PLANS[id].limits[feature] === true;
}
