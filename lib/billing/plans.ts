// lib/billing/plans.ts
//
// Source de vérité des plans d'ABONNEMENT à la plateforme AutoFunnel AI.
//
// ⚠️ Ne PAS confondre avec le paiement "one-time" de lib/billing/orders.ts :
//    celui-ci concerne le client FINAL qui achète le produit d'un tunnel.
//    Ici on parle de l'abonnement RÉCURRENT du solopreneur à AutoFunnel.
//
// Ce module est PUR (aucun import du SDK Stripe) → il peut être importé aussi
// bien côté serveur que côté client (Sidebar, page /abonnement, landing).
// Le mapping vers les `price_id` Stripe se fait via variables d'environnement
// (jamais en dur), car les ids diffèrent entre test et live.

export type PlanId = "starter" | "pro" | "agency";

export type PlanLimits = {
  /** Nombre max de tunnels (générés + clonés). Infinity = illimité. */
  funnels: number;
  /** 🆕 Nombre max de tunnels PUBLIÉS simultanément. Infinity = illimité. */
  publishedFunnels: number;
  /** Import / clonage d'un tunnel depuis une URL externe (drapeau d'accès). */
  urlImport: boolean;
  /** 🆕 Quota mensuel d'imports/clonages URL. Infinity = illimité. */
  urlImportsPerMonth: number;
  /** Régénération IA d'une section (drapeau d'accès). */
  sectionRegeneration: boolean;
  /** 🆕 Quota mensuel de générations IA de TUNNEL. Infinity = illimité. */
  aiFunnelGensPerMonth: number;
  /** 🆕 Quota mensuel de générations IA de SÉQUENCE email. Infinity = illimité. */
  aiSequenceGensPerMonth: number;
  /** 🆕 Quota mensuel de régénérations de COPY (section). Infinity = illimité. */
  aiCopyRegensPerMonth: number;
  /** CRM : gestion des contacts / leads. */
  crm: boolean;
  /** 🆕 Nombre max de leads/contacts stockés. Infinity = illimité. */
  maxLeads: number;
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
  /** Domaine d'ENVOI email personnalisé (Resend) — feature premium. */
  customSendingDomain: boolean;
  /** Domaines personnalisés rattachables aux tunnels. Infinity = illimité. */
  customDomains: number;
  /** 🆕 Paiement dans les tunnels (Stripe Connect / CinetPay) activé. */
  paymentsInFunnels: boolean;
  /** 🆕 VAGUE CUSTOM-CODE — Code personnalisé head/body injecté sur les pages
   *  publiées. STRICTEMENT réservé au plan le plus élevé (risque XSS assumé,
   *  cf. components/funnel/CustomCode.tsx). Le contrôle qui compte est fait
   *  côté serveur AU RENDU (lib/funnels/customCode.ts), pas seulement en UI. */
  customCode: boolean;
  /** 🆕 Commission plateforme sur les ventes de tunnels (% — Stripe Connect
   *  application_fee). 0 = aucune. Dégressive selon le plan. Prête mais peut
   *  rester inappliquée tant qu'on ne la branche pas dans le checkout. */
  platformFeePercent: number;
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
      funnels: 5,
      publishedFunnels: 1,
      urlImport: true,
      urlImportsPerMonth: 3,
      sectionRegeneration: true,
      aiFunnelGensPerMonth: 5,
      aiSequenceGensPerMonth: 1,
      aiCopyRegensPerMonth: 20,
      crm: true,
      maxLeads: 500,
      leadsExport: true,
      campaigns: true,
      monthlyEmailSends: 500,
      workflows: false,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: false,
      clientWorkspaces: 0,
      customSendingDomain: false,
      customDomains: 0,
      paymentsInFunnels: true,
      customCode: false,
      platformFeePercent: 2,
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
      publishedFunnels: 5,
      urlImport: true,
      urlImportsPerMonth: 10,
      sectionRegeneration: true,
      aiFunnelGensPerMonth: 30,
      aiSequenceGensPerMonth: 10,
      aiCopyRegensPerMonth: 200,
      crm: true,
      maxLeads: 5000,
      leadsExport: true,
      campaigns: true,
      monthlyEmailSends: 5000,
      workflows: true,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: true,
      clientWorkspaces: 0,
      // 🚧 NON IMPLÉMENTÉ — remis à false/0 tant que la fonctionnalité n'existe
      // pas (audit 2026-07 : aucun flux de vérification ni routage hostname).
      // Valeurs cibles à restaurer à la livraison : customSendingDomain: true,
      // customDomains: 1.
      customSendingDomain: false,
      customDomains: 0,
      paymentsInFunnels: true,
      customCode: false,
      platformFeePercent: 0,
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
      publishedFunnels: Infinity,
      urlImport: true,
      urlImportsPerMonth: Infinity,
      sectionRegeneration: true,
      aiFunnelGensPerMonth: 150,
      aiSequenceGensPerMonth: Infinity,
      aiCopyRegensPerMonth: Infinity,
      crm: true,
      maxLeads: Infinity,
      leadsExport: true,
      campaigns: true,
      monthlyEmailSends: Infinity,
      workflows: true,
      systemeExport: true,
      htmlExport: true,
      multiPlatform: true,
      // 🚧 NON IMPLÉMENTÉ — remis à 0/false tant que ces fonctionnalités
      // n'existent pas (audit 2026-07). Valeurs cibles à restaurer à la
      // livraison : clientWorkspaces: 25, customSendingDomain: true,
      // customDomains: Infinity.
      clientWorkspaces: 0,
      customSendingDomain: false,
      customDomains: 0,
      paymentsInFunnels: true,
      customCode: true,
      platformFeePercent: 0,
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
