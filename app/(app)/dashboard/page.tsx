// app/(app)/dashboard/page.tsx
"use client";

import {
  Download, FileText, Globe2, Users, ArrowRight,
  Sparkles, Upload, CheckCircle2, BookOpen,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FunnelRowMenu } from "@/components/dashboard/FunnelRowMenu";
import {
  useFunnelList,
  deleteFunnel,
  saveFunnel,
  type StoredFunnel,
} from "@/lib/store/funnelStore";
import { CloneFunnelButton } from "@/components/dashboard/CloneFunnelButton";

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const stored = useFunnelList();

  function handleDelete(id: string) {
    deleteFunnel(id);
  }

  function handleDuplicate(id: string) {
    const found = stored.find((f) => f.id === id);
    if (!found) return;

    const newId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const existingSlugs = new Set(stored.map((f) => f.slug));
    let newSlug = `${found.slug}-copy`;
    let i = 2;
    while (existingSlugs.has(newSlug)) {
      newSlug = `${found.slug}-copy-${i}`;
      i++;
    }

    const now = new Date().toISOString();
    const copy: StoredFunnel = {
      id: newId,
      slug: newSlug,
      funnel: {
        ...found.funnel,
        funnelName: `${found.funnel.funnelName} (copie)`,
      },
      brief: found.brief,
      createdAt: now,
      updatedAt: now,
      // pas de publishedAt : la copie est en brouillon
    };
    saveFunnel(copy);
  }

  // Stats dérivées du store
  const totalFunnels = stored.length;
  const publishedCount = stored.filter((f) => f.publishedAt).length;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black text-ink">Tableau de bord</h1>
          <p className="mt-1.5 text-sm text-muted">
            Vue claire de vos tunnels, exports et leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button href="/create">
            <Sparkles size={15} /> Créer un tunnel
          </Button>
          <CloneFunnelButton />
        </div>

      </div>

      {/* KPI */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Tunnels créés"
          value={String(totalFunnels)}
          icon={<FileText size={18} />}
          accent="blue"
          trend={totalFunnels > 0 ? { value: 12 } : undefined}
        />
        <DashboardCard
          label="Leads collectés"
          value="0"
          icon={<Users size={18} />}
          accent="green"
        />
        <DashboardCard
          label="Tunnels publiés"
          value={String(publishedCount)}
          icon={<Globe2 size={18} />}
          accent="gold"
        />
        <DashboardCard
          label="Exports réalisés"
          value="0"
          icon={<Download size={18} />}
          accent="blue"
        />
      </div>

      {/* Contenu */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Liste tunnels */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-ink">Derniers tunnels</h2>
              <p className="text-xs text-muted">Vos tunnels les plus récents</p>
            </div>
              <CloneFunnelButton className="w-full justify-center" />
          </div>

          <div className="grid gap-2">
            {stored.map((item) => (
              <FunnelRow
                key={item.id}
                stored={item}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}

            {stored.length === 0 && (
              <p className="rounded-lg border border-dashed border-line bg-canvas p-6 text-center text-xs text-muted">
                Aucun tunnel pour le moment. Créez votre premier tunnel pour commencer
              </p>
            )}
          </div>
        </Card>

        {/* Panneau latéral */}
        <div className="grid gap-4">
          <Card className="p-5">
            <h2 className="text-lg font-black text-ink">Actions rapides</h2>
            <div className="mt-3 grid gap-2">
              <Button href="/export-systeme" variant="secondary">
                <Download size={14} /> Exporter vers systeme.io
              </Button>
              <Button href="/leads" variant="secondary">
                <Users size={14} /> Voir les leads
              </Button>
              <Button href="/import" variant="secondary">
                <Upload size={14} /> Importer une URL
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen size={15} className="text-navy" />
              <h2 className="text-sm font-black text-ink">Bien démarrer</h2>
            </div>
            <ul className="grid gap-2 text-xs text-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green" />
                Définissez l'objectif et l'audience de votre tunnel
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green" />
                Configurez le comportement des CTA et les visuels
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green" />
                Ajustez chaque section dans l'éditeur si nécessaire
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green" />
                Exportez vers systeme.io en un clic
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne de tunnel
// ─────────────────────────────────────────────────────────────────────────────

function FunnelRow({
  stored,
  onDelete,
  onDuplicate,
}: {
  stored: StoredFunnel;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { id, slug, funnel, updatedAt, publishedAt } = stored;
  const dateLabel = formatRelativeDate(updatedAt);

  // 🔧 Compat mono-page (ancien modèle) ET multi-pages (nouveau modèle)
  const pages = funnel.pages ?? [];
  const sectionCount =
    pages.length > 0
      ? pages.reduce((acc, p) => acc + (p.sections?.length ?? 0), 0)
      : // fallback ancien modèle
        (funnel as { sections?: unknown[] }).sections?.length ?? 0;

  const language = (funnel.language ?? "fr").toUpperCase();
  const pageLabel =
    pages.length > 1 ? `${pages.length} pages · ` : "";

  return (
    <div className="ff-card-hover flex items-center justify-between gap-4 rounded-lg border border-line bg-white p-3.5">
      <a href={`/editor/${id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{funnel.funnelName}</p>
        <p className="mt-0.5 text-xs text-muted">
          {pageLabel}
          {sectionCount} sections · {language} · {dateLabel}
        </p>
      </a>
      <div className="flex items-center gap-2 shrink-0">
        {publishedAt ? (
          <Badge tone="green">Publié</Badge>
        ) : (
          <Badge tone="neutral">Brouillon</Badge>
        )}
        <FunnelRowMenu
          funnel={{ id, name: funnel.funnelName, slug }}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
  }
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
