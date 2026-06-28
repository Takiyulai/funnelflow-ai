// lib/funnels/funnelContext.ts
// 🆕 ÉTAPE 4 — Extraction du contexte d'un tunnel PUBLIÉ pour nourrir la
// génération de séquences email par IA. Source : table `funnels`
// (colonnes `brief` + `published_content`). On NE lit que les tunnels publiés
// appartenant à l'utilisateur (RLS par user_id via le client serveur fourni).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Funnel,
  FunnelSection,
  SectionItem,
  PricingPlanItem,
  BonusItem,
  GuaranteeItem,
} from "@/lib/funnels/types";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";
import type { TunnelContext } from "@/lib/crm/types";

type BriefLike = {
  offerName?: string;
  promise?: string;
  mainPain?: string;
  targetAudience?: string;
  tone?: string;
  price?: string;
  language?: string;
};

/** Aplati toutes les sections du tunnel (pages multiples + legacy). */
function allSections(funnel: Funnel): FunnelSection[] {
  const fromPages = (funnel.pages ?? []).flatMap((p) => p.sections ?? []);
  const legacy = funnel.sections ?? [];
  return fromPages.length > 0 ? fromPages : legacy;
}

// Collecte les `data` des items d'un `kind` donné. Le type des données est
// fourni explicitement à l'appel (T) → évite l'accès indexé générique
// `Extract<SectionItem,{kind:K}>["data"]` que TS n'arrive pas à prouver assignable.
function itemsOfKind<T>(
  sections: FunnelSection[],
  kind: SectionItem["kind"],
): T[] {
  const out: T[] = [];
  for (const s of sections) {
    for (const it of s.items ?? []) {
      if (it.kind === kind) out.push(it.data as T);
    }
  }
  return out;
}

function buildPublicUrl(slug: string | null): string | null {
  if (!slug) return null;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return base ? `${base}/tunnel/${slug}` : `/tunnel/${slug}`;
}

/**
 * Charge le contexte d'un tunnel publié de l'utilisateur. Retourne `null` si le
 * tunnel est introuvable, n'appartient pas à l'utilisateur, ou n'est PAS publié
 * (la génération « rattachée à un tunnel » exige une version publiée).
 */
export async function getPublishedFunnelContext(
  sb: SupabaseClient,
  userId: string,
  funnelId: string,
): Promise<TunnelContext | null> {
  const { data, error } = await sb
    .from("funnels")
    .select("id, name, slug, published_slug, language, brief, published_content, status")
    .eq("id", funnelId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || data.status !== "published" || !data.published_content) {
    return null;
  }

  const funnel = normalizeFunnel(data.published_content);
  const sections = allSections(funnel);
  const brief = (data.brief ?? {}) as BriefLike;

  // Hero : 1ʳᵉ section de type "hero".
  const hero = sections.find((s) => s.type === "hero");

  // Bénéfices : bullets des sections benefits/solution/hero.
  const benefits: string[] = [];
  for (const s of sections) {
    if (["benefits", "solution", "hero"].includes(s.type) && Array.isArray(s.bullets)) {
      benefits.push(...s.bullets.filter(Boolean));
    }
  }

  // Prix : brief.price en priorité, sinon 1er plan pricing/offer.
  const plans = itemsOfKind<PricingPlanItem>(sections, "pricing");
  const price = (brief.price ?? "").trim() || plans[0]?.price || "";

  const bonuses = itemsOfKind<BonusItem>(sections, "bonus")
    .map((b) => b.title)
    .filter(Boolean);

  const guaranteeItem = itemsOfKind<GuaranteeItem>(sections, "guarantee")[0];
  const guarantee = guaranteeItem
    ? [guaranteeItem.title, guaranteeItem.duration].filter(Boolean).join(" — ") || null
    : null;

  const language = (data.language || brief.language || funnel.language || "fr") as TunnelContext["language"];

  return {
    funnelId: data.id,
    name: data.name || funnel.funnelName || "Tunnel",
    offerName: (brief.offerName ?? "").trim() || funnel.funnelName || data.name || "",
    promise: (brief.promise ?? "").trim() || hero?.headline || "",
    mainPain: (brief.mainPain ?? "").trim(),
    targetAudience: (brief.targetAudience ?? "").trim(),
    tone: (brief.tone ?? "").trim(),
    language,
    price,
    benefits: benefits.slice(0, 8),
    bonuses: bonuses.slice(0, 6),
    guarantee,
    heroHeadline: hero?.headline ?? null,
    heroSubheadline: hero?.subheadline ?? null,
    url: buildPublicUrl(data.published_slug || data.slug || null),
  };
}
