// app/(dashboard)/dashboard/page.tsx
"use client";

import { useState } from "react";
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

type DemoFunnelRow = {
  id: string;
  name: string;
  status: "published" | "draft";
  date: string;
};

const INITIAL_FUNNELS: DemoFunnelRow[] = [
  { id: "demo", name: "Ebook leadership premium", status: "published", date: "Il y a 2 jours" },
  { id: "consulting", name: "Consultation stratégie", status: "draft", date: "Il y a 4 jours" },
  { id: "webinar", name: "Webinaire acquisition", status: "published", date: "La semaine dernière" },
];

export default function DashboardPage() {
  const [funnels, setFunnels] = useState<DemoFunnelRow[]>(INITIAL_FUNNELS);

  function handleDelete(id: string) {
    setFunnels((list) => list.filter((f) => f.id !== id));
  }

  function handleDuplicate(id: string) {
    setFunnels((list) => {
      const found = list.find((f) => f.id === id);
      if (!found) return list;
      const copy: DemoFunnelRow = {
        ...found,
        id: `${found.id}-copy-${Date.now().toString(36)}`,
        name: `${found.name} (copie)`,
        status: "draft",
        date: "À l'instant",
      };
      return [copy, ...list];
    });
  }

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
          <Button href="/import" variant="secondary">
            <Upload size={15} /> Importer
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Tunnels créés" value={String(funnels.length)} icon={<FileText size={18} />} accent="blue" trend={{ value: 12 }} />
        <DashboardCard label="Leads collectés" value="246" icon={<Users size={18} />} accent="green" trend={{ value: 8 }} />
        <DashboardCard label="Tunnels publiés" value={String(funnels.filter((f) => f.status === "published").length)} icon={<Globe2 size={18} />} accent="gold" />
        <DashboardCard label="Exports réalisés" value="14" icon={<Download size={18} />} accent="blue" />
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
            <Button href="/dashboard" variant="ghost" size="sm">
              Tout voir <ArrowRight size={13} />
            </Button>
          </div>

          <div className="grid gap-2">
            {funnels.map((funnel) => (
              <div
                key={funnel.id}
                className="ff-card-hover flex items-center justify-between gap-4 rounded-lg border border-line bg-white p-3.5"
              >
                <a href={`/funnels/${funnel.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{funnel.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{funnel.date}</p>
                </a>
                <div className="flex items-center gap-2 shrink-0">
                  {funnel.status === "published" ? (
                    <Badge tone="green">Publié</Badge>
                  ) : (
                    <Badge tone="neutral">Brouillon</Badge>
                  )}
                  <FunnelRowMenu
                    funnel={{ id: funnel.id, name: funnel.name }}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                  />
                </div>
              </div>
            ))}

            {funnels.length === 0 && (
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
