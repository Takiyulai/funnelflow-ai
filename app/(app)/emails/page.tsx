// app/(app)/emails/page.tsx
// 🆕 Entrée unique « Emails » à deux onglets (Newsletter + Séquences).
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/lib/crm/campaigns";
import { listTags } from "@/lib/crm/tags";
import { resendConfigured } from "@/lib/crm/email";
import { EmailsModule } from "@/components/crm/EmailsModule";
import type { Campaign } from "@/lib/crm/types";

type PublishedFunnelOpt = { id: string; name: string };

export const dynamic = "force-dynamic";

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { tab } = await searchParams;
  const initialTab = tab === "sequences" ? "sequences" : "newsletter";

  // 🆕 Résilience : une coupure réseau ponctuelle vers Supabase (`fetch failed`)
  //    ne doit PAS crasher toute la route. On dégrade en état vide.
  let campaigns: Campaign[] = [];
  let contactsCount = 0;
  let publishedFunnels: PublishedFunnelOpt[] = [];
  // 🆕 Tags CRM, pour le ciblage d'audience par tag dans les campagnes.
  let tags: { id: string; name: string }[] = [];
  // 🆕 LOT 3 — Ouvertures/clics par campagne (best-effort : {} si la migration
  // db/email-events-schema.sql n'est pas encore passée).
  const campaignStats: Record<string, { opens: number; clicks: number }> = {};
  try {
    const [campaignsRes, contactsRes, publishedFunnelsRes, tagsRes] = await Promise.all([
      listCampaigns(sb, user.id),
      sb.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      // Tunnels PUBLIÉS de l'utilisateur, pour rattacher une séquence (Étape 4).
      sb
        .from("funnels")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("status", "published")
        .order("updated_at", { ascending: false }),
      listTags(sb, user.id),
    ]);
    campaigns = campaignsRes;
    contactsCount = contactsRes.count ?? 0;
    publishedFunnels = (publishedFunnelsRes.data ?? []).map(
      (f: { id: string; name: string | null }) => ({ id: f.id, name: f.name || "Tunnel" }),
    );
    tags = tagsRes.map((t) => ({ id: t.id, name: t.name }));

    // 🆕 LOT 3 — Stats open/click des campagnes (RPC SECURITY INVOKER → RLS).
    if (campaigns.length > 0) {
      const { data: statsRows } = await sb.rpc("campaign_email_stats_v1", {
        p_campaign_ids: campaigns.map((c) => c.id),
      });
      for (const row of (statsRows ?? []) as Array<{
        campaign_id: string;
        opens: number;
        clicks: number;
      }>) {
        campaignStats[row.campaign_id] = {
          opens: Number(row.opens) || 0,
          clicks: Number(row.clicks) || 0,
        };
      }
    }
  } catch (e) {
    console.error("[emails] chargement des données échoué (réseau/Supabase):", e);
  }

  return (
    <AppShell>
      <EmailsModule
        initialCampaigns={campaigns}
        contactsCount={contactsCount ?? 0}
        resendReady={resendConfigured()}
        initialTab={initialTab}
        publishedFunnels={publishedFunnels}
        campaignStats={campaignStats}
        tags={tags}
      />
    </AppShell>
  );
}
