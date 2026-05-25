import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeadsTable, type LeadStatus } from "@/components/leads/LeadsTable";

const PAGE_SIZE = 50;

const VALID_STATUSES: LeadStatus[] = [
  "nouveau",
  "contacte",
  "qualifie",
  "client",
  "perdu",
];

function normalizeStatus(s: string | null | undefined): LeadStatus {
  return s && (VALID_STATUSES as string[]).includes(s)
    ? (s as LeadStatus)
    : "nouveau";
}

type SearchParams = Promise<{
  status?: string;
  funnel?: string;
  q?: string;
  p?: string;
}>;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = sp.status || "";
  const funnelFilter = sp.funnel || "";
  const q = (sp.q || "").trim();
  const pageNum = Math.max(1, parseInt(sp.p || "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: funnels } = await supabase
    .from("funnels")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  let query = supabase
    .from("leads")
    .select("id, email, name, status, funnel_id, created_at, funnels(name)", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (funnelFilter) query = query.eq("funnel_id", funnelFilter);
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);

  const { data: leads, count } = await query;

  const kpiQueries = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "nouveau"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "qualifie"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "client"),
  ]);

  const [total, nouveaux, qualifies, clients] = kpiQueries.map(
    (r) => r.count ?? 0,
  );
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6 animate-[fadeIn_0.4s_ease-out]">
        <div>
          <h1 className="text-3xl font-black text-ink">Leads</h1>
          <p className="mt-2 text-sm text-muted">
            Tous les contacts collectés par vos tunnels
          </p>
        </div>
        <Button
          href={`/api/leads/export${funnelFilter ? `?funnelId=${funnelFilter}` : ""}`}
          variant="secondary"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[
          { label: "Total", value: total },
          { label: "Nouveaux", value: nouveaux },
          { label: "Qualifiés", value: qualifies },
          { label: "Clients", value: clients },
        ].map((kpi, i) => (
          <Card
            key={kpi.label}
            className="p-5"
            style={{ animation: `fadeIn 0.4s ease-out ${i * 60}ms both` }}
          >
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted">
              {kpi.label}
            </p>
            <p className="text-3xl font-black text-ink mt-1">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <form
          method="GET"
          className="flex flex-wrap items-center gap-3 p-4 border-b border-line bg-[#F8F9FB]"
        >
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Rechercher un lead…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
            />
          </div>
          <select
            name="funnel"
            defaultValue={funnelFilter}
            className="px-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
          >
            <option value="">Tous tunnels</option>
            {(funnels ?? []).map((f: { id: string; name: string }) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            className="px-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
          >
            <option value="">Tous statuts</option>
            <option value="nouveau">Nouveau</option>
            <option value="contacte">Contacté</option>
            <option value="qualifie">Qualifié</option>
            <option value="client">Client</option>
            <option value="perdu">Perdu</option>
          </select>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[#08498D] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Filtrer
          </button>
        </form>

        <div className="overflow-x-auto">
          <LeadsTable
            initialLeads={(leads ?? []).map((lead: {
              id: string;
              email: string;
              name: string | null;
              status: string;
              funnel_id: string | null;
              created_at: string;
              funnels: { name?: string } | { name?: string }[] | null;
            }) => {
              const funnelName = Array.isArray(lead.funnels)
                ? lead.funnels[0]?.name
                : lead.funnels?.name;
              return {
                id: lead.id,
                email: lead.email,
                name: lead.name,
                status: normalizeStatus(lead.status),
                funnel_id: lead.funnel_id,
                funnel_name: funnelName ?? null,
                created_at: lead.created_at,
              };
            })}
            showFunnelColumn={true}
          />
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-line bg-[#F8F9FB]">
            <span className="text-xs text-muted">
              Page {pageNum} / {totalPages} · {count} leads
            </span>
            <div className="flex gap-2">
              {pageNum > 1 && (
                <Link
                  href={`?${new URLSearchParams({
                    ...(status && { status }),
                    ...(funnelFilter && { funnel: funnelFilter }),
                    ...(q && { q }),
                    p: String(pageNum - 1),
                  })}`}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold"
                >
                  ← Précédent
                </Link>
              )}
              {pageNum < totalPages && (
                <Link
                  href={`?${new URLSearchParams({
                    ...(status && { status }),
                    ...(funnelFilter && { funnel: funnelFilter }),
                    ...(q && { q }),
                    p: String(pageNum + 1),
                  })}`}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold"
                >
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
