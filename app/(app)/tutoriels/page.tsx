import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TutorialsLibrary } from "@/components/tutorials/TutorialsLibrary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  const isAdmin = isAdminEmail(user?.email);
  return (
    <AppShell>
      <PageHeader title="Tutoriels" subtitle="Apprends à créer, publier et automatiser tes tunnels directement dans AutoFunnel AI." />
      <TutorialsLibrary isAdmin={isAdmin} />
    </AppShell>
  );
}
