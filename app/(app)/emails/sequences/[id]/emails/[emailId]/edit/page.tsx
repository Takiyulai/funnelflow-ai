import { notFound, redirect } from "next/navigation";
import { EmailEditorShell } from "@/components/crm/email-editor/EmailEditorShell";
import { getFunnelBrandName } from "@/lib/crm/emailRender";
import { getSequenceWithEmails } from "@/lib/crm/sequences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SequenceEmailEditorPage({
  params,
}: {
  params: Promise<{ id: string; emailId: string }>;
}) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { id, emailId } = await params;
  const sequence = await getSequenceWithEmails(sb, user.id, id);
  if (!sequence) notFound();
  const email = sequence.emails.find((item) => item.id === emailId);
  if (!email) notFound();
  const brandName = await getFunnelBrandName(sb, sequence.funnel_id);
  return (
    <EmailEditorShell
      kind="sequence"
      label={`${sequence.name} · Email ${email.position + 1}`}
      record={{ ...email, name: sequence.name }}
      saveEndpoint={`/api/crm/sequences/${id}/emails/${emailId}`}
      testEndpoint={`/api/crm/sequences/${id}/emails/${emailId}/send`}
      backHref={`/emails?tab=sequences&sequence=${id}`}
      doneHref={`/emails?tab=sequences&sequence=${id}`}
      funnelId={sequence.funnel_id}
      brandName={brandName}
    />
  );
}
