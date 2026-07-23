import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listWorkflows } from "@/lib/workflows/repository";
import { listSequences } from "@/lib/crm/sequences";
import { WorkflowsClient } from "@/components/workflows/WorkflowsClient";
import type { Workflow } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";

type FunnelOption = { id: string; name: string };
// 🆕 emails[] : nécessaire pour que l'éditeur de condition workflow puisse
// proposer "quel email de cette séquence" (has_opened_email/has_clicked_email
// + sequenceEmailId), pas juste "quelle séquence".
type SequenceOption = {
  id: string;
  name: string;
  emails: { id: string; subject: string; position: number; content: string }[];
};
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
    // 🆕 Emails de TOUTES les séquences en une seule requête (plutôt que N+1),
    // groupés par sequence_id — alimente le sélecteur "quel email de cette
    // séquence" dans l'éditeur de condition workflow.
    const { data: seqEmailRows } = await sb
      .from("crm_sequence_emails")
      .select("id, sequence_id, subject, position, content")
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    const emailsBySequence = new Map<
      string,
      { id: string; subject: string; position: number; content: string }[]
    >();
    for (const row of seqEmailRows ?? []) {
      const list = emailsBySequence.get(row.sequence_id as string) ?? [];
      list.push({
        id: row.id as string,
        subject: (row.subject as string) || "(sans objet)",
        position: row.position as number,
        content: (row.content as string) ?? "",
      });
      emailsBySequence.set(row.sequence_id as string, list);
    }
    sequences = seqs.map((s) => ({
      id: s.id,
      name: s.name,
      emails: emailsBySequence.get(s.id) ?? [],
    }));
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
