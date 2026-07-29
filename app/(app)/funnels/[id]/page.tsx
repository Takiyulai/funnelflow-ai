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

      {/* 🆕 En-tête : empilé sous 1024 px, puis titre à gauche / actions à
          droite. Avec cinq boutons, passer en ligne dès `sm` les faisait
          s'entasser contre le titre ; le point de bascule est donc `lg`.
          `lg:shrink-0` empêche le groupe d'être comprimé par un titre long,
          et `justify-end` garde les rangées alignées à droite quand elles
          passent à la ligne — c'était l'origine de l'effet d'escalier. */}
      <div className="mb-6 flex flex-col gap-4 animate-[fadeIn_0.4s_ease-out] lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* `min-w-0` + `truncate` : sans la première classe, un titre long
                pousse le badge hors de l'écran au lieu de se tronquer. */}
            <h1 className="min-w-0 truncate text-2xl font-black text-ink sm:text-3xl">
              {displayName}
            </h1>
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

        <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
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
