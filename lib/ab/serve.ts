// lib/ab/serve.ts
//
// 🆕 MODULE 3 — Point d'entrée unique du rendu public d'une variante.
//
// Les deux pages publiques (`/tunnel/[slug]` et `/tunnel/[slug]/[pageSlug]`)
// l'appellent, ce qui garantit qu'un test créé sur N'IMPORTE QUELLE page est
// réellement servi. Câbler seulement la page d'accueil aurait produit le pire
// des défauts : un test qui tourne, affiche des chiffres, et n'a jamais montré
// la variante B à personne.

import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FunnelPage } from "@/lib/funnels/types";
import { AB_COOKIE } from "@/lib/ab/cookie";
import { pickVariant } from "@/lib/ab/assign";
import { getRunningTest, recordAbEvent } from "@/lib/ab/tests";

export type ServedPage = {
  /** Page à rendre — sections de la variante B si le visiteur y est affecté. */
  page: FunnelPage;
  /** Test en cours sur cette page, ou null. */
  testId: string | null;
  variant: "a" | "b" | null;
};

/**
 * Résout la variante à servir pour ce visiteur et enregistre la vue.
 *
 * Ne lève JAMAIS : un incident de mesure ne doit pas empêcher une page de
 * vente de s'afficher. En cas de problème, on rend la page d'origine — le
 * visiteur ne voit aucune différence, seul le test perd un point de mesure.
 */
export async function serveAbVariant(
  funnelId: string,
  ownerId: string,
  page: FunnelPage,
): Promise<ServedPage> {
  try {
    const cookieStore = await cookies();
    const visitorKey = cookieStore.get(AB_COOKIE)?.value;
    // Pas de cookie (middleware non passé, navigateur qui les refuse) → on
    // sert la version d'origine sans rien compter. Compter une vue sans
    // pouvoir garantir la stabilité de l'affectation fausserait le test.
    if (!visitorKey) return { page, testId: null, variant: null };

    const admin = getSupabaseAdmin();
    const test = await getRunningTest(admin, funnelId, page.id);
    if (!test) return { page, testId: null, variant: null };

    const variant = pickVariant(visitorKey, test.id, test.traffic_split);

    await recordAbEvent(admin, {
      testId: test.id,
      userId: ownerId,
      variant,
      kind: "view",
      visitorKey,
    });

    // La variante B ne remplace les sections que si elle en contient : une
    // variante vide afficherait une page blanche aux visiteurs concernés.
    const useB = variant === "b" && Array.isArray(test.variant_b) && test.variant_b.length > 0;

    return {
      page: useB ? { ...page, sections: test.variant_b } : page,
      testId: test.id,
      variant,
    };
  } catch (e) {
    console.error("[ab] résolution de variante échouée :", e);
    return { page, testId: null, variant: null };
  }
}

/**
 * Enregistre une CONVERSION sur le test en cours de cette page.
 *
 * Appelé à la capture d'un lead. Remarquez qu'on ne stocke NULLE PART la
 * variante que le visiteur avait vue : l'affectation étant déterministe, on la
 * recalcule à l'identique à partir du même cookie et du même identifiant de
 * test. C'est ce qui évite une table d'affectations à maintenir, et surtout
 * toute possibilité de désaccord entre la variante vue et la variante créditée.
 *
 * Best-effort absolu : une conversion non mesurée est regrettable, un lead
 * perdu est inacceptable. Cette fonction ne lève jamais.
 */
export async function recordAbConversion(
  funnelId: string,
  ownerId: string,
  pageId: string,
): Promise<void> {
  try {
    const cookieStore = await cookies();
    const visitorKey = cookieStore.get(AB_COOKIE)?.value;
    if (!visitorKey) return;

    const admin = getSupabaseAdmin();
    const test = await getRunningTest(admin, funnelId, pageId);
    if (!test) return;

    await recordAbEvent(admin, {
      testId: test.id,
      userId: ownerId,
      variant: pickVariant(visitorKey, test.id, test.traffic_split),
      kind: "conversion",
      visitorKey,
    });
  } catch (e) {
    console.error("[ab] enregistrement de conversion échoué :", e);
  }
}
