import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { CrmSharingClient } from "@/components/crm/CrmSharingClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CrmSharingPage() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <CrmSharingClient />
    </AppShell>
  );
}
