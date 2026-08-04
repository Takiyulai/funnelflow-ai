import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Eye, Users, Target, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";
import { AbTestsPanel } from "@/components/funnel/AbTestsPanel";
import type { FunnelPage } from "@/lib/funnels/types";

// 🆕 VAGUE 1 / LOT 2 — Dashboard analytics v1 d'un tunnel : visites, visiteurs
// uniques, leads, conversion par page, sources de trafic. Données 100 %
// anonymes (cf. db/funnel-visits-schema.sql). Agrégation via la fonction SQL
// `funnel_stats_v1` (SECURITY INVOKER → RLS propriétaire appliquée).

export const dynamic = "force-dynamic";

type PageStat = { pageSlug: string; views: number; uniques: number };
type LeadStat = { pageSlug: string; leads: number };
type SourceStat = { source: string; views: number };
type Stats = {
  views: number;
  uniques: number;
  leads: number;
  pages: PageStat[];
  leadsByPage: LeadStat[];
  sources: SourceStat[];
};

const DAY_OPTIONS = [7, 30, 90] as const;

/**
 * Taux de conversion = leads / visiteurs uniques.
 *
 * ⚠️ CE RATIO PEUT DÉPASSER 100 % — et ce n'était pas affiché honnêtement.
 * Les deux nombres ne viennent pas de la même source : les visiteurs uniques
 * sont comptés par un signal JavaScript (`funnel_visits`, identifiant en
 * localStorage), les leads sont comptés à l'insertion en base. Trois cas
 * courants font diverger les deux :
 *   • un même visiteur soumet plusieurs fois le formulaire (typiquement toi,
 *     en train de tester ton propre tunnel) → 300 % ;
 *   • un bloqueur de publicité ou un navigateur en mode strict empêche le
 *     signal de visite mais pas la soumission du formulaire ;
 *   • le lead arrive par un autre chemin que la page mesurée.
 *
 * Afficher « 300 % » sans explication laisse croire à un bug de calcul. On
 * plafonne donc l'affichage à 100 % et on signale le dépassement, plutôt que
 * de masquer silencieusement l'écart.
 */
function pct(leads: number, uniques: number): { label: string; capped: boolean } {
  if (!uniques || uniques <= 0) return { label: "—", capped: false };
  const raw = (leads / uniques) * 100;
  if (raw > 100) return { label: "100 %", capped: true };
  return { label: `${raw.toFixed(1).replace(".", ",")} %`, capped: false };
}

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

  const stats: Stats | null = statsErr
    ? null
    : {
        views: Number((rawStats as Record<string, unknown>)?.views ?? 0),
        uniques: Number((rawStats as Record<string, unknown>)?.uniques ?? 0),
        leads: Number((rawStats as Record<string, unknown>)?.leads ?? 0),
        pages: ((rawStats as Record<string, unknown>)?.pages as PageStat[]) ?? [],
        leadsByPage:
          ((rawStats as Record<string, unknown>)?.leadsByPage as LeadStat[]) ?? [],
        sources: ((rawStats as Record<string, unknown>)?.sources as SourceStat[]) ?? [],
      };

  const leadsBySlug = new Map<string, number>(
    (stats?.leadsByPage ?? []).map((l) => [l.pageSlug, l.leads]),
  );
  // Pages vues + pages ayant capté des leads sans visite comptée (rare).
  const pageRows = [...(stats?.pages ?? [])];
  for (const [slug, n] of leadsBySlug) {
    if (n > 0 && !pageRows.some((p) => p.pageSlug === slug)) {
      pageRows.push({ pageSlug: slug, views: 0, uniques: 0 });
    }
  }

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
            Visites anonymes, leads et conversion. Aucune donnée personnelle
            collectée sur vos visiteurs.
          </p>
        </div>
        <div className="flex gap-2">
          {DAY_OPTIONS.map((d) => (
            <Link
              key={d}
              href={`/funnels/${funnelId}/stats?days=${d}`}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition ${
                d === days
                  ? "border-ink bg-ink text-bg"
                  : "border-border text-muted hover:text-ink"
              }`}
            >
              {d} j
            </Link>
          ))}
        </div>
      </div>

      {!stats ? (
        <Card className="p-6">
          <p className="text-sm font-semibold text-ink">
            Statistiques indisponibles
          </p>
          <p className="mt-1 text-sm text-muted">
            La table d&apos;analytics n&apos;est pas encore installée. Exécutez le
            script <code className="font-mono text-xs">db/funnel-visits-schema.sql</code>{" "}
            dans Supabase → SQL Editor, puis rechargez cette page.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted font-semibold uppercase">
                <Eye className="h-3.5 w-3.5" /> Visites
              </div>
              <div className="text-2xl font-black mt-1">{stats.views}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted font-semibold uppercase">
                <Users className="h-3.5 w-3.5" /> Visiteurs uniques
              </div>
              <div className="text-2xl font-black mt-1">{stats.uniques}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted font-semibold uppercase">
                <Target className="h-3.5 w-3.5" /> Leads
              </div>
              <div className="text-2xl font-black mt-1">{stats.leads}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted font-semibold uppercase">
                <TrendingUp className="h-3.5 w-3.5" /> Conversion
              </div>
              <div className="text-2xl font-black mt-1">
                {pct(stats.leads, stats.uniques).label}
              </div>
              {pct(stats.leads, stats.uniques).capped && (
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  Plus de leads que de visiteurs comptés ({stats.leads} pour{" "}
                  {stats.uniques}) — soumissions répétées depuis un même
                  navigateur, ou signal de visite bloqué.
                </p>
              )}
            </Card>
          </div>

          {/* Par page */}
          <Card className="p-0 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-bold text-ink">Performance par page</h2>
            </div>
            {pageRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                Aucune visite enregistrée sur cette période. Les visites sont
                comptées automatiquement dès qu&apos;un visiteur ouvre votre
                tunnel publié — rien à configurer.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted uppercase">
                    <th className="px-4 py-2 font-semibold">Page</th>
                    <th className="px-4 py-2 font-semibold text-right">Vues</th>
                    <th className="px-4 py-2 font-semibold text-right">Uniques</th>
                    <th className="px-4 py-2 font-semibold text-right">Leads</th>
                    <th className="px-4 py-2 font-semibold text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const leads = leadsBySlug.get(row.pageSlug) ?? 0;
                    return (
                      <tr key={row.pageSlug || "__home"} className="border-t border-border">
                        <td className="px-4 py-2.5 font-semibold text-ink">
                          {pageNames.get(row.pageSlug) || row.pageSlug || "Page d'accueil"}
                          {row.pageSlug ? (
                            <span className="ml-2 text-xs text-muted font-normal">
                              /{row.pageSlug}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right">{row.views}</td>
                        <td className="px-4 py-2.5 text-right">{row.uniques}</td>
                        <td className="px-4 py-2.5 text-right">{leads}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {pct(leads, row.uniques).label}
                          {pct(leads, row.uniques).capped && (
                            <span
                              className="ml-1 text-muted"
                              title={`${leads} leads pour ${row.uniques} visiteurs comptés`}
                            >
                              *
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {/* Sources */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-bold text-ink">Sources de trafic</h2>
            </div>
            {stats.sources.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                Aucune source détectée sur cette période. Les sources
                proviennent du référent externe et des paramètres UTM
                (utm_source) de vos liens.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.sources.map((s) => (
                  <li
                    key={s.source}
                    className="px-4 py-2.5 flex items-center justify-between text-sm"
                  >
                    <span className="font-semibold text-ink">
                      {s.source === "direct" ? "Accès direct" : s.source}
                    </span>
                    <span className="text-muted">{s.views} visites</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

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
