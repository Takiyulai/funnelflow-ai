import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/leads/LeadsTable";
import type { LeadStatus } from "@/components/leads/LeadsTable";

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

type LeadRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: string;
  page_slug: string | null;
  created_at: string;
};

export default async function FunnelLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    q?: string;
    p?: string;
    page_slug?: string;
  }>;
}) {
  const { id: funnelId } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Funnel info
  const { data: funnel, error: funnelErr } = await supabase
    .from("funnels")
    .select("id, name, slug, status")
    .eq("id", funnelId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (funnelErr || !funnel) notFound();

  // Pagination
  const page = Math.max(1, parseInt(sp.p ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Leads query
  let leadsQuery = supabase
    .from("leads")
    .select("id, email, name, phone, status, page_slug, created_at", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .eq("funnel_id", funnelId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (sp.status) leadsQuery = leadsQuery.eq("status", sp.status);
  if (sp.page_slug) leadsQuery = leadsQuery.eq("page_slug", sp.page_slug);
  if (sp.q) {
    const q = sp.q.trim();
    leadsQuery = leadsQuery.or(
      `email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  const { data: leads, count: totalCount } = await leadsQuery;

  // KPIs
  const [
    { count: kpiTotal },
    { count: kpiNouveau },
    { count: kpiQualifie },
    { count: kpiClient },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("funnel_id", funnelId),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("funnel_id", funnelId)
      .eq("status", "nouveau"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("funnel_id", funnelId)
      .eq("status", "qualifie"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("funnel_id", funnelId)
      .eq("status", "client"),
  ]);

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  // Distinct page slugs
  const { data: pageSlugsData } = await supabase
    .from("leads")
    .select("page_slug")
    .eq("user_id", user.id)
    .eq("funnel_id", funnelId)
    .not("page_slug", "is", null);

  const pageSlugs = Array.from(
    new Set(
      ((pageSlugsData ?? []) as { page_slug: string | null }[])
        .map((r) => r.page_slug)
        .filter(Boolean) as string[]
    )
  );

  const leadsTyped = (leads ?? []) as LeadRow[];

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

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-ink truncate">
            Leads — {funnel.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {totalCount ?? 0} lead{(totalCount ?? 0) > 1 ? "s" : ""} collecté
            {(totalCount ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="secondary"
          href={`/api/leads/export?funnel=${funnelId}`}
          external
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs text-muted font-semibold uppercase">Total</div>
          <div className="text-2xl font-black mt-1">{kpiTotal ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted font-semibold uppercase">Nouveaux</div>
          <div className="text-2xl font-black mt-1">{kpiNouveau ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted font-semibold uppercase">Qualifiés</div>
          <div className="text-2xl font-black mt-1">{kpiQualifie ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted font-semibold uppercase">Clients</div>
          <div className="text-2xl font-black mt-1">{kpiClient ?? 0}</div>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="p-4 mb-6">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-muted mb-1">
              Recherche
            </label>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Email, nom, téléphone…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-ink text-sm"
            />
          </div>
          {pageSlugs.length > 0 && (
            <div className="min-w-[160px]">
              <label className="block text-xs font-semibold text-muted mb-1">
                Page
              </label>
              <select
                name="page_slug"
                defaultValue={sp.page_slug ?? ""}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-ink text-sm"
              >
                <option value="">Toutes</option>
                {pageSlugs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold text-muted mb-1">
              Statut
            </label>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-ink text-sm"
            >
              <option value="">Tous</option>
              <option value="nouveau">Nouveau</option>
              <option value="contacte">Contacté</option>
              <option value="qualifie">Qualifié</option>
              <option value="client">Client</option>
              <option value="perdu">Perdu</option>
            </select>
          </div>
          <Button variant="primary" type="submit">
            Filtrer
          </Button>
        </form>
      </Card>

      {/* Table */}
      <LeadsTable
        initialLeads={leadsTyped.map((lead) => ({
          id: lead.id,
          email: lead.email,
          name: lead.name,
          phone: lead.phone,
          status: normalizeStatus(lead.status),
          page_slug: lead.page_slug,
          created_at: lead.created_at,
        }))}
        showFunnelColumn={false}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-muted">
            Page {page} / {totalPages} · {totalCount} leads
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/funnels/${funnelId}/leads?p=${page - 1}`}
                className="px-3 py-1.5 text-sm font-semibold border border-border rounded-lg hover:bg-surface"
              >
                Précédent
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/funnels/${funnelId}/leads?p=${page + 1}`}
                className="px-3 py-1.5 text-sm font-semibold border border-border rounded-lg hover:bg-surface"
              >
                Suivant
              </Link>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
