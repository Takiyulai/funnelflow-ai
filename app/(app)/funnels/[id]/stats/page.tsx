import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { FunnelStatsOverview, type Stats } from "@/components/funnel/FunnelStatsOverview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";
import { AbTestsPanel } from "@/components/funnel/AbTestsPanel";
import type { FunnelPage } from "@/lib/funnels/types";

// 🆕 VAGUE 1 / LOT 2 — Dashboard analytics v1 d'un tunnel : visites, visiteurs
// uniques, leads, conversion par page, sources de trafic. Données 100 %
// anonymes (cf. db/funnel-visits-schema.sql). Agrégation via la fonction SQL
// `funnel_stats_v1` (SECURITY INVOKER → RLS propriétaire appliquée).

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [7, 30, 90] as const;

export default async function FunnelStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // 🆕 `abPage` : id de page transmis par le bouton « Tester » de l'éditeur,
  // pour arriver ici avec la bonne page déjà sélectionnée.
  searchParams: Promise<{ days?: string; abPage?: string }>;
}) {
  const { id: funnelId } = await params;
  const sp = await searchParams;
  const days = DAY_OPTIONS.includes(Number(sp.days) as (typeof DAY_OPTIONS)[number])
    ? Number(sp.days)
    : 30;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: funnel, error: funnelErr } = await supabase
    .from("funnels")
    .select("id, name, status, published_content, brief, published_slug, slug")
    .eq("id", funnelId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (funnelErr || !funnel) notFound();

  // Libellés de pages (slug → nom) depuis le contenu publié.
  const pageNames = new Map<string, string>();
  const content = funnel.published_content as
    | { pages?: Array<{ slug?: string; name?: string; title?: string; isHome?: boolean }> }
    | null;
  const clean = (s: string) => s.replace(/^\/+/, "").replace(/\/+$/, "");
  for (const p of content?.pages ?? []) {
    const label = p?.name || p?.title || (p?.isHome ? "Page d'accueil" : "");
    if (p?.isHome) pageNames.set("", label || "Page d'accueil");
    if (typeof p?.slug === "string") pageNames.set(clean(p.slug), label || clean(p.slug));
  }
  if (!pageNames.has("")) pageNames.set("", "Page d'accueil");

  // 🆕 MODULE 3 — Pages normalisées pour le panneau A/B. On part du contenu
  // PUBLIÉ et non du brouillon : c'est lui que voient les visiteurs, donc la
  // seule référence honnête pour la variante A.
  let abPages: FunnelPage[] = [];
  let abOfferName: string | undefined;
  try {
    if (funnel.published_content) {
      abPages = normalizeFunnel(funnel.published_content).pages ?? [];
    }
    abOfferName = (funnel.brief as { offerName?: string } | null)?.offerName;
  } catch (e) {
    // Un contenu illisible ne doit pas faire tomber toute la page de stats :
    // on renonce au panneau A/B, le reste s'affiche normalement.
    console.error("[stats] normalisation du tunnel échouée :", e);
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: rawStats, error: statsErr } = await supabase.rpc("funnel_stats_v1", {
    p_funnel_id: funnelId,
    p_since: since,
  });

  if (statsErr) console.error("[stats] lecture des agrégats échouée :", statsErr);
  const stats: Stats | null = statsErr || !rawStats
    ? null
    : {
        views: Number((rawStats as Record<string, unknown>)?.views ?? 0),
        uniques: Number((rawStats as Record<string, unknown>)?.uniques ?? 0),
        leads: Number((rawStats as Record<string, unknown>)?.leads ?? 0),
        pages: ((rawStats as Record<string, unknown>)?.pages as Stats["pages"]) ?? [],
        leadsByPage:
          ((rawStats as Record<string, unknown>)?.leadsByPage as Stats["leadsByPage"]) ?? [],
        sources: ((rawStats as Record<string, unknown>)?.sources as Stats["sources"]) ?? [],
      };

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href={`/funnels/${funnelId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au tunnel
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-ink truncate">
            Statistiques — {funnel.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Visites mesurées, leads et conversion — vue globale du tunnel et comparaison A/B.
          </p>
        </div>
      </div>

      <FunnelStatsOverview key={funnelId} funnelId={funnelId} initialStats={stats} initialDays={days} pageNames={Object.fromEntries(pageNames)} />

      {/* 🆕 MODULE 3 — Tests A/B. Placés ici et non dans l'éditeur : on décide
          de tester une accroche en REGARDANT ses chiffres, pas en dessinant sa
          page. Nécessite un tunnel publié — sans trafic, rien à mesurer. */}
      {funnel.status === "published" && abPages.length > 0 && (
        <div className="mt-6">
          <AbTestsPanel
            funnelId={funnelId}
            pages={abPages}
            offerName={abOfferName}
            initialPageId={sp.abPage}
            publicSlug={
              (funnel.published_slug as string | null) ?? (funnel.slug as string | null)
            }
          />
        </div>
      )}
    </AppShell>
  );
}
