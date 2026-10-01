import type { PlanId } from "@/lib/billing/plans";

/**
 * Adaptateur minimal du parcours Chariow existant.
 *
 * Il centralise seulement la résolution des liens publics déjà utilisés par
 * PlanPicker. La validation de licence et le webhook restent volontairement
 * dans lib/billing/chariow.ts et /api/webhooks/chariow, sans refactor risqué.
 */
export function getChariowCheckoutUrl(plan: PlanId): string | null {
  const urls: Record<PlanId, string | undefined> = {
    starter: process.env.NEXT_PUBLIC_CHARIOW_URL_STARTER,
    pro: process.env.NEXT_PUBLIC_CHARIOW_URL_PRO,
    agency: process.env.NEXT_PUBLIC_CHARIOW_URL_AGENCY,
  };
  return (
    urls[plan]?.trim() ||
    process.env.NEXT_PUBLIC_CHARIOW_STORE_URL?.trim() ||
    null
  );
}
