import { Download, FileText, Globe2, Users } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-ink">Dashboard</h1>
          <p className="mt-2 text-sm text-muted">Vue claire de vos tunnels, exports et prospects.</p>
        </div>
        <div className="flex gap-2">
          <Button href="/create">Créer un tunnel</Button>
          <Button href="/import" variant="secondary">Importer</Button>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <DashboardCard label="Tunnels créés" value="8" icon={<FileText size={22} />} />
        <DashboardCard label="Leads collectés" value="246" icon={<Users size={22} />} />
        <DashboardCard label="Tunnels publiés" value="5" icon={<Globe2 size={22} />} />
        <DashboardCard label="Exports" value="14" icon={<Download size={22} />} />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <Card className="p-5">
          <h2 className="text-xl font-black">Derniers tunnels</h2>
          <div className="mt-4 grid gap-3">
            {["Ebook premium leadership", "Consultation stratégie", "Webinaire acquisition"].map((item) => (
              <a key={item} href="/funnels/demo" className="flex items-center justify-between rounded-lg border border-line p-4 text-sm font-bold hover:border-navy/30">
                {item}<span className="text-green">Publié</span>
              </a>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-black">Actions rapides</h2>
          <div className="mt-4 grid gap-3">
            <Button href="/export-systeme" variant="secondary">Exporter vers Systeme.io</Button>
            <Button href="/leads" variant="secondary">Voir les leads</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
