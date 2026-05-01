import { AppShell } from "@/components/dashboard/AppShell";
import { CreateFunnelWizard } from "@/components/funnel/CreateFunnelWizard";

export default function CreatePage() {
  return (
    <AppShell>
      <h1 className="text-3xl font-black text-ink">Création tunnel IA</h1>
      <p className="mt-2 text-sm text-muted">Répondez aux étapes, puis générez un tunnel complet prêt à modifier.</p>
      <div className="mt-8">
        <CreateFunnelWizard />
      </div>
    </AppShell>
  );
}
