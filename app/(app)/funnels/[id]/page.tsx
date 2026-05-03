"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { demoFunnel } from "@/lib/funnels/demo";
import { Download, Edit3, ExternalLink } from "lucide-react";

export default function FunnelDetailPage() {
  const funnel = demoFunnel;

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6 animate-[fadeIn_0.4s_ease-out]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="green">Publié</Badge>
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted">
              {funnel.language?.toUpperCase()} · {funnel.sections.length} sections
            </span>
          </div>
          <h1 className="text-3xl font-black text-ink truncate">{funnel.funnelName}</h1>
          <p className="mt-2 text-sm text-muted">
            Aperçu fidèle du tunnel — utilisez le switch pour vérifier le rendu mobile
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/editor/demo" variant="secondary">
            <Edit3 className="h-4 w-4" />
            Modifier
          </Button>
          <Button href="/export-systeme" variant="primary">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
          <Button href="#" variant="ghost">
            <ExternalLink className="h-4 w-4" />
            Voir en ligne
          </Button>
        </div>
      </div>

      <FunnelPreview funnel={funnel} viewportHeight={820} />
    </AppShell>
  );
}
