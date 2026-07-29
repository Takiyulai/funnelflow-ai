import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listContacts } from "@/lib/crm/contacts";
import { listTags } from "@/lib/crm/tags";
import { listContactLists } from "@/lib/crm/lists";
import { ContactsTable } from "@/components/crm/ContactsTable";
import type { LeadStatus } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  funnel?: string;
  q?: string;
  tag?: string;
  /** 🆕 Filtre par liste de contacts (provenance d'un lot importé). */
  list?: string;
}>;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const status = (sp.status as LeadStatus | undefined) || undefined;
  const funnelFilter = sp.funnel || undefined;

  const [{ contacts, total }, tags, lists, funnelsRes, kpiQueries] = await Promise.all([
    listContacts(sb, user.id, {
      search: sp.q || undefined,
      tagId: sp.tag || undefined,
      listId: sp.list || undefined,
      status,
      funnelId: funnelFilter,
      limit: 200,
    }),
    listTags(sb, user.id),
    listContactLists(sb, user.id),
    sb.from("funnels").select("id, name").eq("user_id", user.id).order("name"),
    Promise.all([
      sb.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      sb.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "nouveau"),
      sb.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "qualifie"),
      sb.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "client"),
    ]),
  ]);

  const funnels = (funnelsRes.data ?? []) as { id: string; name: string }[];
  const [totalAll, nouveaux, qualifies, clients] = kpiQueries.map((r) => r.count ?? 0);

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[
          { label: "Total", value: totalAll },
          { label: "Nouveaux", value: nouveaux },
          { label: "Qualifiés", value: qualifies },
          { label: "Clients", value: clients },
        ].map((kpi, i) => (
          <Card
            key={kpi.label}
            className="p-5"
            style={{ animation: `fadeIn 0.4s ease-out ${i * 60}ms both` }}
          >
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted">{kpi.label}</p>
            <p className="text-3xl font-black text-ink mt-1">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <ContactsTable
        initialContacts={contacts}
        total={total}
        tags={tags}
        lists={lists}
        funnels={funnels}
        exportHref={`/api/leads/export${funnelFilter ? `?funnelId=${funnelFilter}` : ""}`}
        filters={{
          q: sp.q ?? "",
          tag: sp.tag ?? "",
          list: sp.list ?? "",
          status: sp.status ?? "",
          funnel: sp.funnel ?? "",
        }}
      />
    </AppShell>
  );
}
