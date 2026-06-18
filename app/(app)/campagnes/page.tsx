import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/lib/crm/campaigns";
import { resendConfigured } from "@/lib/crm/email";
import { CampaignsClient } from "@/components/crm/CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampagnesPage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [campaigns, { count: contactsCount }] = await Promise.all([
    listCampaigns(sb, user.id),
    sb.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return (
    <AppShell>
      <CampaignsClient
        initialCampaigns={campaigns}
        contactsCount={contactsCount ?? 0}
        resendReady={resendConfigured()}
      />
    </AppShell>
  );
}
