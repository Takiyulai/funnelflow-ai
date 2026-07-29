// lib/ab/tests.ts
//
// 🆕 MODULE 3 — Service des tests A/B.
//
// Deux familles d'appels, avec des clients Supabase DIFFÉRENTS et c'est
// volontaire :
//   • Côté PUBLIC (rendu du tunnel, capture de lead) → client ADMIN. Le
//     visiteur est anonyme, la RLS le bloquerait. Aucune policy d'écriture
//     n'existe sur ces tables : c'est le seul chemin d'écriture possible, donc
//     personne ne peut fabriquer de faux résultats depuis son navigateur.
//   • Côté PROPRIÉTAIRE (interface) → client de SESSION, RLS active.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelSection } from "@/lib/funnels/types";
import type { Variant } from "@/lib/ab/assign";

const TEST_COLS =
  "id, user_id, funnel_id, page_id, name, status, traffic_split, variant_b, winner, started_at, ended_at, created_at";

export type AbTestStatus = "running" | "paused" | "finished";

export type AbTest = {
  id: string;
  user_id: string;
  funnel_id: string;
  page_id: string;
  name: string;
  status: AbTestStatus;
  traffic_split: number;
  variant_b: FunnelSection[];
  winner: Variant | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type AbCounts = { views: number; conversions: number };
export type AbTestWithStats = AbTest & { stats: { a: AbCounts; b: AbCounts } };

const EMPTY_STATS = {
  a: { views: 0, conversions: 0 },
  b: { views: 0, conversions: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Côté PUBLIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test EN COURS sur une page donnée, ou null.
 *
 * Appelé à chaque rendu d'une page publique : requête indexée unique, et
 * `null` dès qu'aucun test ne tourne — le cas de très loin le plus fréquent.
 * Ne lève jamais : un incident sur cette table ne doit pas empêcher un tunnel
 * de s'afficher. Un tunnel qui ne s'affiche pas coûte infiniment plus cher
 * qu'un test qui ne se mesure pas.
 */
export async function getRunningTest(
  admin: SupabaseClient,
  funnelId: string,
  pageId: string,
): Promise<AbTest | null> {
  try {
    const { data } = await admin
      .from("funnel_ab_tests")
      .select(TEST_COLS)
      .eq("funnel_id", funnelId)
      .eq("page_id", pageId)
      .eq("status", "running")
      .limit(1);
    return data && data.length > 0 ? (data[0] as AbTest) : null;
  } catch (e) {
    console.error("[ab] lecture du test en cours échouée :", e);
    return null;
  }
}

/**
 * Enregistre une vue ou une conversion. Idempotent : l'index unique
 * (test_id, visitor_key, kind) fait qu'un rechargement de page n'ajoute rien.
 * Le code 23505 est donc un SUCCÈS fonctionnel, pas une erreur.
 */
export async function recordAbEvent(
  admin: SupabaseClient,
  params: {
    testId: string;
    userId: string;
    variant: Variant;
    kind: "view" | "conversion";
    visitorKey: string;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("funnel_ab_events").insert({
      test_id: params.testId,
      user_id: params.userId,
      variant: params.variant,
      kind: params.kind,
      visitor_key: params.visitorKey,
    });
    if (error && error.code !== "23505") {
      console.error("[ab] enregistrement d'événement échoué :", error.message);
    }
  } catch (e) {
    // Best-effort absolu : jamais de plantage du rendu public pour une mesure.
    console.error("[ab] enregistrement d'événement échoué :", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Côté PROPRIÉTAIRE
// ─────────────────────────────────────────────────────────────────────────────

async function statsFor(
  sb: SupabaseClient,
  testId: string,
): Promise<{ a: AbCounts; b: AbCounts }> {
  const { data, error } = await sb.rpc("ab_test_stats_v1", { p_test_id: testId });
  if (error || !data) return EMPTY_STATS;
  return data as { a: AbCounts; b: AbCounts };
}

export async function listAbTests(
  sb: SupabaseClient,
  userId: string,
  funnelId: string,
): Promise<AbTestWithStats[]> {
  const { data, error } = await sb
    .from("funnel_ab_tests")
    .select(TEST_COLS)
    .eq("user_id", userId)
    .eq("funnel_id", funnelId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const tests = (data ?? []) as AbTest[];
  return Promise.all(
    tests.map(async (t) => ({ ...t, stats: await statsFor(sb, t.id) })),
  );
}

export async function getAbTest(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<AbTestWithStats | null> {
  const { data } = await sb
    .from("funnel_ab_tests")
    .select(TEST_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { ...(data as AbTest), stats: await statsFor(sb, id) };
}

/**
 * Crée un test. La variante B démarre comme une COPIE des sections actuelles :
 * l'utilisateur part de l'existant et modifie ce qu'il veut tester, plutôt que
 * d'une page blanche. C'est aussi ce qui garantit qu'un test mal configuré ne
 * sert jamais une page vide.
 */
export async function createAbTest(
  sb: SupabaseClient,
  userId: string,
  input: {
    funnelId: string;
    pageId: string;
    name: string;
    variantB: FunnelSection[];
    trafficSplit?: number;
  },
): Promise<AbTest> {
  const name = input.name.trim();
  if (!name) throw new Error("name_required");
  if (!Array.isArray(input.variantB) || input.variantB.length === 0) {
    throw new Error("variant_b_required");
  }

  const { data, error } = await sb
    .from("funnel_ab_tests")
    .insert({
      user_id: userId,
      funnel_id: input.funnelId,
      page_id: input.pageId,
      name,
      variant_b: input.variantB,
      traffic_split: Math.min(99, Math.max(1, input.trafficSplit ?? 50)),
      status: "running",
    })
    .select(TEST_COLS)
    .single();

  if (error) {
    // 23505 = index partiel « un seul test en cours par page ».
    if (error.code === "23505") throw new Error("test_already_running");
    throw new Error(error.message);
  }
  return data as AbTest;
}

export async function updateAbTest(
  sb: SupabaseClient,
  userId: string,
  id: string,
  patch: {
    name?: string;
    status?: AbTestStatus;
    trafficSplit?: number;
    variantB?: FunnelSection[];
  },
): Promise<AbTest> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.trafficSplit !== undefined) {
    update.traffic_split = Math.min(99, Math.max(1, patch.trafficSplit));
  }
  if (patch.variantB !== undefined) update.variant_b = patch.variantB;
  if (patch.status !== undefined) {
    update.status = patch.status;
    // Un test terminé porte sa date de fin ; le relancer l'efface, sinon
    // l'historique afficherait un test « en cours » déjà daté.
    update.ended_at = patch.status === "finished" ? new Date().toISOString() : null;
  }

  const { data, error } = await sb
    .from("funnel_ab_tests")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select(TEST_COLS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("test_already_running");
    throw new Error(error.message);
  }
  return data as AbTest;
}

export async function deleteAbTest(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await sb
    .from("funnel_ab_tests")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Désigne la variante gagnante et l'INSTALLE dans le tunnel.
 *
 * C'est l'aboutissement du module : sans cette étape, l'utilisateur constate
 * que B gagne… puis doit refaire ses modifications à la main dans l'éditeur,
 * avec le risque d'en oublier une.
 *
 * Choisir A ne réécrit rien (A EST la page actuelle) : on se contente de
 * clôturer le test. Choisir B recopie ses sections dans le brouillon ET dans
 * le contenu publié — les deux, sinon la page en ligne et l'éditeur
 * divergeraient silencieusement.
 */
export async function applyAbWinner(
  sb: SupabaseClient,
  userId: string,
  id: string,
  winner: Variant,
): Promise<void> {
  const test = await getAbTest(sb, userId, id);
  if (!test) throw new Error("not_found");

  if (winner === "b") {
    const { data: funnel } = await sb
      .from("funnels")
      .select("json_content, published_content")
      .eq("user_id", userId)
      .eq("id", test.funnel_id)
      .maybeSingle();
    if (!funnel) throw new Error("funnel_not_found");

    // Remplace les sections de la page testée, dans les deux contenus.
    const swap = (content: unknown): unknown => {
      if (!content || typeof content !== "object") return content;
      const c = content as { pages?: Array<{ id?: string; sections?: unknown }> };
      if (!Array.isArray(c.pages)) return content;
      return {
        ...c,
        pages: c.pages.map((p) =>
          p?.id === test.page_id ? { ...p, sections: test.variant_b } : p,
        ),
      };
    };

    const { error } = await sb
      .from("funnels")
      .update({
        json_content: swap(funnel.json_content),
        published_content: funnel.published_content
          ? swap(funnel.published_content)
          : funnel.published_content,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", test.funnel_id);
    if (error) throw new Error(error.message);
  }

  const { error: closeError } = await sb
    .from("funnel_ab_tests")
    .update({ status: "finished", winner, ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (closeError) throw new Error(closeError.message);
}
