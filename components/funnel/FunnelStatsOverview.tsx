"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Users, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";

type PageStat = { pageSlug: string; views: number; uniques: number };
type LeadStat = { pageSlug: string; leads: number };
type SourceStat = { source: string; views: number };
export type Stats = {
  views: number;
  uniques: number;
  leads: number;
  pages: PageStat[];
  leadsByPage: LeadStat[];
  sources: SourceStat[];
};


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


export function FunnelStatsOverview({ funnelId, initialStats, initialDays, pageNames }: {
  funnelId: string; initialStats: Stats | null; initialDays: number; pageNames: Record<string, string>;
}) {
  const [stats, setStats] = useState(initialStats);
  const [selectedDays, setSelectedDays] = useState(initialDays);
  const [displayedDays, setDisplayedDays] = useState(initialDays);
  const [pending, setPending] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  async function changePeriod(days: number) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSelectedDays(days);
    setPending(true);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const url = new URL(window.location.href);
    url.searchParams.set("days", String(days));
    // Update the shareable URL without requesting the full RSC page/funnel JSON.
    window.history.replaceState(null, "", url);
    try {
      const response = await fetch(`/api/funnels/${funnelId}/stats?days=${days}`, {
        cache: "no-store", signal: controller.signal,
      });
      const json = await response.json();
      if (!response.ok || !json.ok || !json.stats) throw new Error("stats_unavailable");
      if (controllerRef.current !== controller || controller.signal.aborted) return;
      setStats(json.stats as Stats);
      setDisplayedDays(days);
    } catch {
      if (controllerRef.current === controller) setStats(null);
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) setPending(false);
    }
  }

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


  return <section aria-label="Statistiques globales">
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {([7, 30, 90] as const).map(days => <button key={days} type="button"
        aria-pressed={selectedDays === days} onClick={() => void changePeriod(days)}
        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${selectedDays === days ? "border-ink bg-ink text-bg" : "border-border text-muted hover:text-ink"}`}>
        {days} j
      </button>)}
      <span role="status" className="text-xs text-muted">
        {pending ? `Chargement des ${selectedDays} derniers jours…` : stats ? `Les ${displayedDays} derniers jours` : "Chargement impossible"}
      </span>
    </div>
    <p className="mb-4 text-xs leading-relaxed text-muted">
      Ensemble du tunnel : toutes les pages et variantes A + B cumulées, y compris les visites antérieures au test si elles sont dans la période.
      La conversion globale correspond au nombre de leads divisé par les visiteurs uniques mesurés.
      Les résultats propres à chaque variante sont affichés séparément dans « Tests A/B ».
    </p>
    <div aria-busy={pending} className={pending ? "opacity-50" : ""}>
      {pending && stats && <p className="mb-2 text-xs text-muted">Résultats précédents ({displayedDays} jours) en attendant l’actualisation.</p>}
      {!stats ? (
        <Card className="p-6">
          <p className="text-sm font-semibold text-ink">
            Statistiques indisponibles
          </p>
          <p className="mt-1 text-sm text-muted">
            Les statistiques n’ont pas pu être chargées. Réessaie dans un instant.
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
              <div className="overflow-x-auto"><table className="w-full text-sm">
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
                          {pageNames[row.pageSlug] || row.pageSlug || "Page d'accueil"}
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
              </table></div>
            )}
          </Card>

          {/* Sources */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-bold text-ink">D’où viennent les visites ?</h2>
              <p className="mt-1 text-xs text-muted">Source UTM du lien, sinon site externe précédent. « Direct ou origine inconnue » inclut les liens copiés, certaines messageries et les pages internes sans source transmise. Ce tableau compte des vues de pages, pas uniquement de nouvelles arrivées.</p>
              <p className="mt-1 text-xs text-muted">Pour identifier une campagne, ajoute par exemple ?utm_source=newsletter à ton lien public.</p>
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
                      {s.source === "direct" ? "Direct ou origine inconnue" : s.source}
                    </span>
                    <span className="text-muted">{s.views} visites</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}


    </div>
  </section>;
}
