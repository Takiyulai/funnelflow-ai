// lib/billing/orders.ts
//
// Accès serveur aux commandes (table public.orders). Toutes les écritures
// passent par le client admin (service role) car elles ont lieu hors session
// (checkout depuis un tunnel public, webhook Stripe).

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

export type CreateOrderInput = {
  userId: string;
  funnelId: string | null;
  leadId?: string | null;
  amount: number; // centimes
  currency: string; // ex: "eur"
  productName?: string | null;
  customerEmail?: string | null;
  stripeSessionId?: string | null;
  pageSlug?: string | null;
  nextUrl?: string | null;
  metadata?: Record<string, unknown>;
  // 🆕 Stripe Connect
  stripeConnectAccountId?: string | null;
  redirectUrl?: string | null;
  applicationFeeAmount?: number;
  sectionId?: string | null;
  customerName?: string | null;
  // 🆕 Multi-fournisseur
  provider?: "stripe" | "cinetpay";
  cinetpayTransactionId?: string | null;
};

/**
 * Parse un prix libre saisi par l'utilisateur ("49€", "297 €", "$49.99",
 * "1 999,00€"…) en { amount (centimes), currency }. Retourne null si gratuit
 * ou non parsable (→ pas de paiement).
 */
export function parsePriceToAmount(
  price: string | undefined | null,
): { amount: number; currency: string } | null {
  if (!price) return null;
  const raw = String(price).trim().toLowerCase();
  if (!raw) return null;
  // Offres gratuites : aucun paiement.
  if (/gratuit|free|gratis|0\s*€|^0$|^0[.,]00/.test(raw)) return null;

  // Devise par symbole/code.
  let currency = "eur";
  if (/\$|usd/.test(raw)) currency = "usd";
  else if (/£|gbp/.test(raw)) currency = "gbp";
  else if (/€|eur/.test(raw)) currency = "eur";

  // Extraire le nombre : on garde chiffres, points, virgules.
  const numMatch = raw.replace(/[^0-9.,]/g, " ").trim().split(/\s+/)[0] ?? "";
  if (!numMatch) return null;
  // Normaliser le séparateur décimal : si une virgule suit 1-2 chiffres en fin,
  // c'est un décimal FR ; sinon on retire les séparateurs de milliers.
  let normalized = numMatch;
  if (/,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  const value = parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { amount: Math.round(value * 100), currency };
}

type PricingCandidate = { price?: string; name?: string; highlighted?: boolean };

/** Collecte les items pricing d'une liste de sections (offer/pricing). */
function collectPricingItems(sections: unknown): PricingCandidate[] {
  const out: PricingCandidate[] = [];
  if (!Array.isArray(sections)) return out;
  for (const sec of sections as Array<Record<string, unknown>>) {
    const type = sec?.type as string | undefined;
    if (type !== "offer" && type !== "pricing") continue;
    const items = sec?.items as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if ((it?.kind as string) === "pricing") {
        const data = (it?.data ?? {}) as Record<string, unknown>;
        out.push({
          price: data.price as string | undefined,
          name: data.name as string | undefined,
          highlighted: data.highlighted === true,
        });
      }
    }
  }
  return out;
}

const cleanSlug = (s: string) => s.replace(/^\/+/, "").replace(/\/+$/, "");

/**
 * Extrait le prix d'un funnel publié (published_content) pour la PAGE
 * concernée. Quand `pageSlug` est fourni (upsell, downsell…), on lit en
 * priorité le prix de CETTE page — chaque offre OTO a son propre montant,
 * distinct de l'offre principale. À défaut (ou page d'accueil), on retombe sur
 * le prix global (item `highlighted` de tout le tunnel). Retourne montant +
 * devise + nom du produit.
 */
export function extractFunnelPrice(
  publishedContent: unknown,
  pageSlug?: string | null,
): { amount: number; currency: string; productName: string } | null {
  const funnel = publishedContent as
    | {
        offerName?: string;
        sections?: unknown[];
        pages?: Array<{ slug?: string; isHome?: boolean; sections?: unknown[] }>;
      }
    | null;
  if (!funnel) return null;

  let pricingItems: PricingCandidate[] = [];

  // 1) Page ciblée : on lit SON offre d'abord (l'upsell/downsell a son prix).
  if (pageSlug && Array.isArray(funnel.pages)) {
    const target = cleanSlug(pageSlug);
    const page = funnel.pages.find(
      (p) => typeof p?.slug === "string" && cleanSlug(p.slug) === target,
    );
    if (page) pricingItems = collectPricingItems(page.sections);
  }

  // 2) Repli : offre globale (mono-page funnel.sections + toutes les pages).
  if (pricingItems.length === 0) {
    pricingItems = collectPricingItems(funnel.sections);
    if (Array.isArray(funnel.pages)) {
      for (const p of funnel.pages) {
        pricingItems.push(...collectPricingItems(p?.sections));
      }
    }
  }

  if (pricingItems.length === 0) return null;

  const chosen = pricingItems.find((p) => p.highlighted) ?? pricingItems[0];
  const parsed = parsePriceToAmount(chosen.price);
  if (!parsed) return null;
  return {
    ...parsed,
    productName: chosen.name || funnel.offerName || "Offre",
  };
}

export async function createPendingOrder(input: CreateOrderInput): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: input.userId,
      funnel_id: input.funnelId,
      lead_id: input.leadId ?? null,
      amount: input.amount,
      currency: input.currency,
      product_name: input.productName ?? null,
      customer_email: input.customerEmail ?? null,
      status: "pending",
      provider: input.provider ?? "stripe",
      cinetpay_transaction_id: input.cinetpayTransactionId ?? null,
      stripe_session_id: input.stripeSessionId ?? null,
      page_slug: input.pageSlug ?? null,
      next_url: input.nextUrl ?? null,
      metadata: input.metadata ?? {},
      // 🆕 Connect
      stripe_connect_account_id: input.stripeConnectAccountId ?? null,
      redirect_url: input.redirectUrl ?? null,
      application_fee_amount: input.applicationFeeAmount ?? 0,
      section_id: input.sectionId ?? null,
      customer_name: input.customerName ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[orders] createPendingOrder error", error);
    return null;
  }
  return data.id as string;
}

/** Marque une commande payée à partir de l'ID de session Stripe. Idempotent.
 * 🆕 Écrit aussi l'email client (Stripe Checkout le collecte) pour que les
 * stats « Clients » se peuplent. */
export async function markOrderPaidBySession(
  sessionId: string,
  paymentIntent?: string | null,
  customerEmail?: string | null,
): Promise<{ userId: string; funnelId: string | null; email: string | null; amount: number; currency: string } | null> {
  const admin = getSupabaseAdmin();
  const email = customerEmail?.toLowerCase().trim() || null;
  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
    stripe_payment_intent: paymentIntent ?? null,
  };
  if (email) patch.customer_email = email;
  const { data, error } = await admin
    .from("orders")
    .update(patch)
    .eq("stripe_session_id", sessionId)
    .neq("status", "paid")
    .select("user_id, funnel_id, customer_email, amount, currency")
    .maybeSingle();
  if (error) {
    console.error("[orders] markOrderPaidBySession error", error);
    return null;
  }
  if (!data) return null;
  return {
    userId: data.user_id as string,
    funnelId: (data.funnel_id as string | null) ?? null,
    email: (data.customer_email as string | null) ?? null,
    amount: data.amount as number,
    currency: data.currency as string,
  };
}

/** 🆕 Marque payée une commande CinetPay via son transaction_id. Idempotent. */
export async function markOrderPaidByCinetpayTransaction(
  transactionId: string,
  customerEmail?: string | null,
): Promise<{ userId: string; funnelId: string | null; email: string | null; amount: number; currency: string } | null> {
  const admin = getSupabaseAdmin();
  const email = customerEmail?.toLowerCase().trim() || null;
  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (email) patch.customer_email = email;
  const { data, error } = await admin
    .from("orders")
    .update(patch)
    .eq("cinetpay_transaction_id", transactionId)
    .neq("status", "paid")
    .select("user_id, funnel_id, customer_email, amount, currency")
    .maybeSingle();
  if (error) {
    console.error("[orders] markOrderPaidByCinetpayTransaction error", error);
    return null;
  }
  if (!data) return null;
  return {
    userId: data.user_id as string,
    funnelId: (data.funnel_id as string | null) ?? null,
    email: (data.customer_email as string | null) ?? null,
    amount: data.amount as number,
    currency: data.currency as string,
  };
}

/**
 * Marque payée une commande à partir de l'ID de PaymentIntent. Idempotent.
 * Filet de sécurité pour l'event payment_intent.succeeded (si jamais
 * checkout.session.completed n'a pas transmis le PI). N'agit que sur une
 * commande existante (= achat de tunnel), jamais sur un abonnement.
 */
export async function markOrderPaidByPaymentIntent(
  paymentIntent: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_payment_intent", paymentIntent)
    .neq("status", "paid")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[orders] markOrderPaidByPaymentIntent error", error);
    return false;
  }
  return Boolean(data);
}

/** Marque une commande échouée à partir de l'ID de PaymentIntent. Idempotent. */
export async function markOrderFailedByPaymentIntent(
  paymentIntent: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .update({ status: "failed" })
    .eq("stripe_payment_intent", paymentIntent)
    .eq("status", "pending") // n'écrase jamais une commande déjà payée
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[orders] markOrderFailedByPaymentIntent error", error);
    return false;
  }
  return Boolean(data);
}

/** 🆕 Promeut (ou crée) un contact en « client » payant. Partagé entre le
 * webhook Stripe et la page success (laquelle sert de filet quand le webhook
 * local n'est pas branché). Idempotent côté statut. */
export async function promoteContactToClient(params: {
  userId: string;
  funnelId: string | null;
  email: string;
  amount: number;
  currency: string;
}): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const email = params.email.toLowerCase().trim();
  if (!email) return null;

  const { data: existing } = await admin
    .from("leads")
    .select("id, metadata")
    .eq("user_id", params.userId)
    .eq("email", email)
    .maybeSingle();

  const purchase = {
    last_purchase_amount: params.amount,
    last_purchase_currency: params.currency,
    last_purchase_at: new Date().toISOString(),
  };

  if (existing) {
    const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
    await admin
      .from("leads")
      .update({ status: "client", metadata: { ...meta, ...purchase } })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: inserted } = await admin
    .from("leads")
    .insert({
      user_id: params.userId,
      funnel_id: params.funnelId,
      email,
      status: "client",
      source: "stripe_checkout",
      metadata: purchase,
    })
    .select("id")
    .maybeSingle();
  return (inserted?.id as string | undefined) ?? null;
}

export type FunnelPaymentStats = {
  payments: number; // nb de commandes payées
  revenue: number; // CA en centimes (somme des montants payés)
  currency: string; // devise dominante
  clients: number; // nb de clients distincts (emails payeurs)
  leads: number; // nb de leads collectés (toutes sources)
  conversionRate: number; // clients / leads, en % (0 si pas de leads)
};

/**
 * Agrège les statistiques de paiement d'un utilisateur (toutes ses commandes
 * payées + ses leads). Lecture via service role (appelée depuis une route
 * serveur qui a déjà vérifié l'identité).
 */
export async function getFunnelPaymentStats(userId: string): Promise<FunnelPaymentStats> {
  const admin = getSupabaseAdmin();

  const { data: paidRows, error: paidErr } = await admin
    .from("orders")
    .select("amount, currency, customer_email")
    .eq("user_id", userId)
    .eq("status", "paid");
  if (paidErr) console.error("[orders] getFunnelPaymentStats paid error", paidErr);

  const rows = paidRows ?? [];
  let revenue = 0;
  const currencyCount = new Map<string, number>();
  const emails = new Set<string>();
  for (const r of rows) {
    revenue += (r.amount as number) ?? 0;
    const cur = ((r.currency as string) || "eur").toLowerCase();
    currencyCount.set(cur, (currencyCount.get(cur) ?? 0) + 1);
    const email = (r.customer_email as string | null)?.toLowerCase().trim();
    if (email) emails.add(email);
  }
  let currency = "eur";
  let max = -1;
  for (const [cur, n] of currencyCount) {
    if (n > max) {
      max = n;
      currency = cur;
    }
  }

  const { count: leadsCount } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const leads = leadsCount ?? 0;
  const clients = emails.size;
  const conversionRate = leads > 0 ? Math.round((clients / leads) * 1000) / 10 : 0;

  return { payments: rows.length, revenue, currency, clients, leads, conversionRate };
}
