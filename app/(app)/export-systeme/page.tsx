import { Download, FileArchive, FileCode2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { demoFunnel } from "@/lib/funnels/demo";
import { createImportGuide, createSystemeBlocks, renderFunnelHtml } from "@/lib/export/html";

export default function ExportSystemePage() {
  const blocks = createSystemeBlocks(demoFunnel);
  const html = renderFunnelHtml(demoFunnel);
  const guide = createImportGuide();

  return (
    <AppShell>
      <h1 className="text-3xl font-black text-ink">Export Systeme.io</h1>
      <p className="mt-2 text-sm text-muted">Blocs HTML/CSS propres, responsive, faciles à coller dans Systeme.io.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-5"><FileCode2 className="text-green" /><h2 className="mt-4 font-black">HTML complet</h2><p className="mt-2 text-sm text-muted">Page complète prête à héberger.</p></Card>
        <Card className="p-5"><FileArchive className="text-green" /><h2 className="mt-4 font-black">ZIP HTML/CSS</h2><p className="mt-2 text-sm text-muted">Généré via route API pour téléchargement.</p></Card>
        <Card className="p-5"><Download className="text-green" /><h2 className="mt-4 font-black">Blocs Systeme.io</h2><p className="mt-2 text-sm text-muted">Sections séparées pour collage.</p></Card>
      </div>
      <div className="mt-6">
        <Button href="/api/export/systeme">Télécharger le ZIP</Button>
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-xl font-black">Guide d’import</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-canvas p-4 text-sm text-muted">{guide}</pre>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-black">HTML complet</h2>
          <pre className="mt-4 max-h-[460px] overflow-auto rounded-lg bg-deep p-4 text-xs text-white">{html}</pre>
        </Card>
      </div>
      <div className="mt-6 grid gap-4">
        {blocks.map((block) => (
          <Card key={block.label} className="p-5">
            <h3 className="font-black">{block.label}</h3>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-canvas p-4 text-xs text-muted">{block.html}</pre>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
