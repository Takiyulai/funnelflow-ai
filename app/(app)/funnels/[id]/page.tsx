import { AppShell } from "@/components/dashboard/AppShell";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { Button } from "@/components/ui/Button";
import { demoFunnel } from "@/lib/funnels/demo";

export default function FunnelResultPage() {
  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-ink">Résultat tunnel</h1>
          <p className="mt-2 text-sm text-muted">Aperçu desktop et mobile, publication et exports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/editor/demo" variant="secondary">Modifier</Button>
          <Button href="/tunnel/demo" variant="secondary">Publier</Button>
          <Button href="/export-systeme" variant="secondary">Export HTML/CSS</Button>
          <Button href="/export-systeme">Export Systeme.io</Button>
        </div>
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_400px]">
        <FunnelPreview funnel={demoFunnel} />
        <FunnelPreview funnel={demoFunnel} mode="mobile" />
      </div>
    </AppShell>
  );
}
