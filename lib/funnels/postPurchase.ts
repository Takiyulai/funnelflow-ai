// lib/funnels/postPurchase.ts
//
// Détermine l'étape SUIVANTE du tunnel après un paiement réussi. Réutilise le
// chaînage de pages que l'utilisateur configure déjà dans l'éditeur :
//   1) page.nextPageId de la page de vente (chaînage explicite)
//   2) page suivante dans l'ordre du tunnel (fallback)
//   3) page /merci (fin de parcours)
//
// Exemple de flux configurable : Vente → (paiement) → Confirmation → Bonus →
// Upsell → Merci. Il suffit que ces pages se suivent dans le tunnel.

import type { Funnel, FunnelPage } from "@/lib/funnels/types";

const clean = (s: string) => s.replace(/^\/+/, "").replace(/\/+$/, "");

export function resolvePostPurchaseUrl(
  funnel: Funnel | null | undefined,
  currentPageSlug: string | null,
  funnelSlug: string,
): string {
  const merci = `/tunnel/${funnelSlug}/merci`;
  const pages: FunnelPage[] = funnel?.pages ?? [];
  if (pages.length === 0) return merci;

  const buildUrl = (p: FunnelPage): string =>
    p.isHome ? `/tunnel/${funnelSlug}` : `/tunnel/${funnelSlug}/${clean(p.slug)}`;

  // Localiser la page où l'achat a eu lieu.
  let current: FunnelPage | undefined;
  if (currentPageSlug) {
    const target = clean(currentPageSlug);
    current = pages.find((p) => clean(p.slug) === target);
  }
  if (!current) {
    // Pas de pageSlug (achat depuis la home) → on part de la page d'entrée.
    current = pages.find((p) => p.isHome) ?? pages[0];
  }

  // 1) Chaînage explicite défini par l'utilisateur.
  if (current?.nextPageId) {
    const next = pages.find((p) => p.id === current!.nextPageId);
    if (next) return buildUrl(next);
  }

  // 2) Page suivante dans l'ordre du tunnel.
  if (current) {
    const idx = pages.findIndex((p) => p.id === current!.id);
    if (idx >= 0 && idx < pages.length - 1) return buildUrl(pages[idx + 1]);
  }

  // 3) Fin de parcours.
  return merci;
}
