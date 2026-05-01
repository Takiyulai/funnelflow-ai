import { AppShell } from "@/components/dashboard/AppShell";
import { CRMTable } from "@/components/crm/CRMTable";
import { Button } from "@/components/ui/Button";

export default function LeadsPage() {
  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-ink">Leads / CRM</h1>
          <p className="mt-2 text-sm text-muted">Suivez les prospects par tunnel, statut et source.</p>
        </div>
        <Button variant="secondary">Exporter CSV</Button>
      </div>
      <div className="mt-8">
        <CRMTable />
      </div>
    </AppShell>
  );
}
