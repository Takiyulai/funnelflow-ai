import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listContacts } from "@/lib/crm/contacts";
import { listTags } from "@/lib/crm/tags";
import { listContactLists } from "@/lib/crm/lists";
import { ContactsTable } from "@/components/crm/ContactsTable";
import type { LeadStatus } from "@/lib/crm/types";
import { guardApiAccess } from "@/lib/billing/apiGuard";
import {
  buildPublishedPageRoleLookup,
  getPublishedPageRole,
  isPostConversionPageRole,
} from "@/lib/funnels/publishedPageRoles";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  funnel?: string;
  q?: string;
  tag?: string;
  /** 🆕 Filtre par liste de contacts (provenance d'un lot importé). */
  list?: string;
}>;

type PageTimeSessionRow = {
  contact_id: string | null;
  funnel_id: string;
  page_slug: string | null;
  active_ms: number | string;
};

type FunnelPublishedPagesRow = {
  id: string;
  pages: unknown;
};

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

  const [{ contacts, total }, tags, lists, funnelsRes, kpiQueries, pageTimeGuard] = await Promise.all([
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
    guardApiAccess(),
  ]);

  const funnels = (funnelsRes.data ?? []) as { id: string; name: string }[];
  const [totalAll, nouveaux, qualifies, clients] = kpiQueries.map((r) => r.count ?? 0);
  const pageTimeTrackingEnabled =
    pageTimeGuard.ok &&
    pageTimeGuard.userId === user.id &&
    pageTimeGuard.access.limits.pageTimeTracking;
  const pageTimeByContact: Record<string, number> = {};

  if (pageTimeTrackingEnabled && contacts.length > 0) {
    // Une seule lecture légère pour tous les contacts affichés. L'agrégation
    // reste côté serveur et la RLS vérifie en plus la propriété des lignes.
    const { data: sessionRows, error: sessionError } = await sb
      .from("funnel_page_sessions")
      .select("contact_id, funnel_id, page_slug, active_ms")
      .eq("user_id", user.id)
      .in(
        "contact_id",
        contacts.map((contact) => contact.id),
      );

    if (sessionError) {
      console.error("[leads] agrégation du temps par contact impossible", sessionError);
    } else {
      const rows = (sessionRows ?? []) as PageTimeSessionRow[];
      const funnelIds = [...new Set(rows.map((row) => row.funnel_id))];
      const { data: funnelPageRows, error: funnelPagesError } = funnelIds.length
        ? await sb
            .from("funnels")
            // Ne charge que le tableau de pages nécessaire au classement par rôle,
            // jamais l'intégralité du snapshot publié.
            .select("id, pages:published_content->pages")
            .eq("user_id", user.id)
            .in("id", funnelIds)
        : { data: [], error: null };

      if (funnelPagesError) {
        console.error("[leads] résolution des rôles de page impossible", funnelPagesError);
      } else {
        const pageRoles = buildPublishedPageRoleLookup(
          (funnelPageRows ?? []) as FunnelPublishedPagesRow[],
        );

        for (const row of rows) {
          const activeMs = Number(row.active_ms);
          if (!row.contact_id || !Number.isFinite(activeMs) || activeMs <= 0) continue;
          const role = getPublishedPageRole(pageRoles, row.funnel_id, row.page_slug);
          if (isPostConversionPageRole(role)) continue;
          pageTimeByContact[row.contact_id] =
            (pageTimeByContact[row.contact_id] ?? 0) + Math.floor(activeMs);
        }
      }
    }
  }

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
        pageTimeTrackingEnabled={pageTimeTrackingEnabled}
        pageTimeByContact={pageTimeByContact}
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
