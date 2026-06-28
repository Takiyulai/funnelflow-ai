import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listWorkflows } from "@/lib/workflows/repository";
import { listSequences } from "@/lib/crm/sequences";
import { WorkflowsClient } from "@/components/workflows/WorkflowsClient";
import type { Workflow } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";

type FunnelOption = { id: string; name: string };
type SequenceOption = { id: string; name: string };
type TagOption = { id: string; name: string };

export default async function WorkflowsPage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  let workflows: Workflow[] = [];
  let funnels: FunnelOption[] = [];
  let sequences: SequenceOption[] = [];
  let tags: TagOption[] = [];

  if (user) {
    workflows = await listWorkflows(sb, user.id).catch(() => [] as Workflow[]);
    const { data } = await sb
      .from("funnels")
      .select("id, name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    funnels = (data ?? []).map((f) => ({
      id: f.id as string,
      name: (f.name as string) ?? "Tunnel",
    }));
    const seqs = await listSequences(sb, user.id).catch(() => []);
    sequences = seqs.map((s) => ({ id: s.id, name: s.name }));
    // 🆕 Tags pour le filtre du déclencheur « tag ajouté ».
    const { data: tagData } = await sb
      .from("crm_tags")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    tags = (tagData ?? []).map((t) => ({
      id: t.id as string,
      name: (t.name as string) ?? "Tag",
    }));
  }

  return (
    <AppShell>
      <WorkflowsClient
        initialWorkflows={workflows}
        funnels={funnels}
        sequences={sequences}
        tags={tags}
      />
    </AppShell>
  );
}
