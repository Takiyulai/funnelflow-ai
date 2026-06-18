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
  metadata?: Record<string, unknown>;
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

/**
 * Extrait le prix « principal » d'un funnel publié (published_content) : on
 * cherche un item pricing (de préférence `highlighted`) dans une section
 * offer/pricing. Retourne montant + devise + nom du produit.
 */
export function extractFunnelPrice(
  publishedContent: unknown,
): { amount: number; currency: string; productName: string } | null {
  const funnel = publishedContent as
    | {
        offerName?: string;
        sections?: unknown[];
        pages?: Array<{ sections?: unknown[] }>;
      }
    | null;
  if (!funnel) return null;

  const allSections: Array<Record<string, unknown>> = [];
  if (Array.isArray(funnel.sections)) {
    allSections.push(...(funnel.sections as Array<Record<string, unknown>>));
  }
  if (Array.isArray(funnel.pages)) {
    for (const p of funnel.pages) {
      if (Array.isArray(p?.sections)) {
        allSections.push(...(p.sections as Array<Record<string, unknown>>));
      }
    }
  }

  const pricingItems: Array<{ price?: string; name?: string; highlighted?: boolean }> = [];
  for (const sec of allSections) {
    const type = sec?.type as string | undefined;
    if (type !== "offer" && type !== "pricing") continue;
    const items = sec?.items as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if ((it?.kind as string) === "pricing") {
        const data = (it?.data ?? {}) as Record<string, unknown>;
        pricingItems.push({
          price: data.price as string | undefined,
          name: data.name as string | undefined,
          highlighted: data.highlighted === true,
        });
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
      provider: "stripe",
      stripe_session_id: input.stripeSessionId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) {
    console.error("[orders] createPendingOrder error", error);
    return null;
  }
  return data.id as string;
}

/** Marque une commande payée à partir de l'ID de session Stripe. Idempotent. */
export async function markOrderPaidBySession(
  sessionId: string,
  paymentIntent?: string | null,
): Promise<{ userId: string; funnelId: string | null; email: string | null; amount: number; currency: string } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: paymentIntent ?? null,
    })
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
