import { notFound, redirect } from "next/navigation";
import { EmailEditorShell } from "@/components/crm/email-editor/EmailEditorShell";
import { getCampaign } from "@/lib/crm/campaigns";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CampaignEmailEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const campaign = await getCampaign(sb, user.id, id);
  if (!campaign) notFound();
  const query = await searchParams;
  return (
    <EmailEditorShell
      kind="campaign"
      record={campaign}
      saveEndpoint={`/api/crm/campaigns/${id}`}
      testEndpoint={`/api/crm/campaigns/${id}/test`}
      backHref="/emails?tab=newsletter"
      doneHref={`/emails?tab=newsletter&campaign=${id}`}
      startWithAI={query.start === "ai"}
    />
  );
}
