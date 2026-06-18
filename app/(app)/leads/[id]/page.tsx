import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/crm/contacts";
import { ContactDetail } from "@/components/crm/ContactDetail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const contact = await getContact(sb, user.id, id);
  if (!contact) notFound();

  return (
    <AppShell>
      <ContactDetail contact={contact} />
    </AppShell>
  );
}
