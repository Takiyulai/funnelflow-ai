"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { useFunnel } from "@/lib/store/funnelStore";
import { Download, Edit3, ExternalLink, ArrowLeft } from "lucide-react";

export default function FunnelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  const stored = useFunnel(id);

  // État de chargement (hydratation côté client)
  if (stored === undefined) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted">Chargement de l'aperçu…</p>
        </div>
      </AppShell>
    );
  }

  // Funnel introuvable (id invalide ou supprimé)
  if (stored === null) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-2xl font-black text-ink mb-2">Tunnel introuvable</h1>
          <p className="text-sm text-muted mb-6">
            Ce tunnel n'existe plus ou l'identifiant est invalide.
          </p>
          <Button href="/dashboard" variant="primary">
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Button>
        </div>
      </AppShell>
    );
  }

  const { funnel, slug, publishedAt } = stored;

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6 animate-[fadeIn_0.4s_ease-out]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {publishedAt ? (
              <Badge tone="green">Publié</Badge>
            ) : (
              <Badge tone="neutral">Brouillon</Badge>
            )}
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted">
              {funnel.language?.toUpperCase()} · {funnel.sections.length} sections
            </span>
          </div>
          <h1 className="text-3xl font-black text-ink truncate">
            {funnel.funnelName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Aperçu fidèle du tunnel — utilisez le switch pour vérifier le rendu mobile
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button href={`/editor/${id}`} variant="secondary">
            <Edit3 className="h-4 w-4" />
            Modifier
          </Button>
          <Button href="/export-systeme" variant="primary">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
          {publishedAt && (
            <Button href={`/tunnel/${slug}`} variant="ghost" external>
              <ExternalLink className="h-4 w-4" />
              Voir en ligne
            </Button>
          )}
        </div>
      </div>

      <FunnelPreview funnel={funnel} viewportHeight={820} />
    </AppShell>
  );
}
