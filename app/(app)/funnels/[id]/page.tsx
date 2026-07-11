"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Download, ExternalLink, Users, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { useFunnel } from "@/lib/store/funnelStore";

export default function FunnelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const funnelId = params?.id ?? "";
  const stored = useFunnel(funnelId);

  if (!stored) {
    return (
      <AppShell>
        <div className="mb-4">
          <Link
            href="/funnels"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux tunnels
          </Link>
        </div>
        <Card className="p-10 text-center">
          <p className="text-sm text-muted">
            Tunnel introuvable ou en cours de chargement…
          </p>
        </Card>
      </AppShell>
    );
  }

  const funnel = stored.funnel;
  const displayName = funnel.funnelName || "Tunnel sans nom";
  const pageCount = funnel.pages?.length ?? 0;
  const sectionCount =
    funnel.pages?.reduce((acc, p) => acc + (p.sections?.length ?? 0), 0) ??
    funnel.sections?.length ??
    0;
  const isPublished = Boolean(stored.publishedAt);

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href="/funnels"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux tunnels
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6 animate-[fadeIn_0.4s_ease-out]">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-ink truncate">{displayName}</h1>
            <Badge tone={isPublished ? "green" : "neutral"}>
              {isPublished ? "Publié" : "Brouillon"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted">
            {pageCount} page{pageCount > 1 ? "s" : ""} ·{" "}
            {sectionCount} section{sectionCount > 1 ? "s" : ""} · Langue :{" "}
            {funnel.language?.toUpperCase() ?? "FR"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push(`/funnels/${funnelId}/stats`)}>
            <BarChart3 className="h-4 w-4" />
            Stats
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/funnels/${funnelId}/leads`)}>
            <Users className="h-4 w-4" />
            Leads
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/editor/${funnelId}`)}>
            <Pencil className="h-4 w-4" />
            Éditer
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/funnels/${funnelId}/export`)}>
            <Download className="h-4 w-4" />
            Exporter
          </Button>
          {isPublished && stored.slug && (
            <Button variant="primary" href={`/tunnel/${stored.slug}`} external>
              <ExternalLink className="h-4 w-4" />
              Voir en ligne
            </Button>
          )}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <FunnelPreview
          funnel={funnel}
          defaultMode="desktop"
          showToolbar={true}
          viewportHeight="calc(100vh - 14rem)"
        />
      </Card>
    </AppShell>
  );
}
