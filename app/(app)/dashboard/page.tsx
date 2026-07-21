// app/(app)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Download, FileText, Globe2, Users,
  Sparkles,
  CreditCard, Wallet, UserCheck, Percent,
  Megaphone, Send, MailOpen, Workflow, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { EmailStats } from "@/lib/crm/emailStats";
import { useCelebrate } from "@/components/ui/Celebration";
import { reachedThreshold, LEAD_THRESHOLDS, SALE_THRESHOLDS } from "@/lib/ux/milestones";
import { getExportCount, EXPORTS_CHANGED_EVENT } from "@/lib/store/statsStore";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const stored = useFunnelList();
  const { celebrate } = useCelebrate();

  // 🆕 Liste tunnels : on n'affiche que les 3 plus récents par défaut, le reste
  // se déplie via « Voir plus ».
  const [showAllFunnels, setShowAllFunnels] = useState(false);
  const RECENT_LIMIT = 3;

  // 🆕 Total de leads réel (CRM) + compteur d'exports.
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const [exportsCount, setExportsCount] = useState(0);

  // 🆕 Nom + email du créateur du compte (affichés dans l'en-tête).
  const [account, setAccount] = useState<{ name: string | null; email: string | null }>({
    name: null,
    email: null,
  });

  useEffect(() => {
    let active = true;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!active) return;
        const md = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
        const name =
          (typeof md.full_name === "string" && md.full_name.trim()) ||
          (typeof md.name === "string" && md.name.trim()) ||
          (typeof md.display_name === "string" && md.display_name.trim()) ||
          null;
        setAccount({ name: name || null, email: session?.user?.email ?? null });
      });
    } catch {
      /* Supabase indisponible : en-tête générique */
    }
    return () => {
      active = false;
    };
  }, []);

  // 🆕 Stats de paiement (commandes payées).
  const [payStats, setPayStats] = useState<{
    payments: number;
    revenue: number;
    currency: string;
    clients: number;
    conversionRate: number;
  } | null>(null);

  // 🆕 Stats email agrégées (carte KPI + lien vers /emails).
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/crm/email-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.ok && d.stats) setEmailStats(d.stats as EmailStats);
      })
      .catch(() => {});
    fetch("/api/crm/contacts?limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.ok && typeof d.total === "number") {
          setLeadsCount(d.total);
          // 🆕 Micro-victoire : 1er lead (jalon) + paliers (étape).
          const t = reachedThreshold("leads", d.total, LEAD_THRESHOLDS);
          if (t === 1) {
            celebrate({
              level: "l",
              emoji: "🎯",
              title: "Ton tout premier lead !",
              message:
                "Quelqu'un vient d'entrer dans ton tunnel. La machine est lancée — garde le cap.",
              cta: { label: "Voir mes leads", href: "/leads" },
            });
          } else if (t) {
            celebrate({
              level: "m",
              title: `${t} leads collectés 🚀`,
              message: "Ta base grandit. Pense à les relancer par email.",
            });
          }
        }
      })
      .catch(() => {});
    fetch("/api/stats/payments")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.ok) {
          setPayStats({
            payments: d.payments ?? 0,
            revenue: d.revenue ?? 0,
            currency: d.currency ?? "eur",
            clients: d.clients ?? 0,
            conversionRate: d.conversionRate ?? 0,
          });
          // 🆕 Micro-victoire : 1re vente (jalon) + paliers de ventes (étape).
          const t = reachedThreshold("sales", d.payments ?? 0, SALE_THRESHOLDS);
          if (t === 1) {
            celebrate({
              level: "l",
              emoji: "💰",
              title: "Ta première vente !",
              message:
                "Un client vient de payer. C'est LA preuve que ton tunnel convertit. Bravo — maintenant, envoie plus de trafic.",
              cta: { label: "Voir mes paiements", href: "/paiements" },
            });
          } else if (t) {
            celebrate({
              level: "m",
              title: `${t} ventes 🔥`,
              message: "Ton tunnel tourne. Continue sur ta lancée.",
            });
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const formatMoney = (cents: number, currency: string) => {
    try {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: (currency || "eur").toUpperCase(),
        maximumFractionDigits: 0,
      }).format((cents ?? 0) / 100);
    } catch {
      return `${((cents ?? 0) / 100).toFixed(0)} €`;
    }
  };

  useEffect(() => {
    const sync = () => setExportsCount(getExportCount());
    sync();
    window.addEventListener(EXPORTS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EXPORTS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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
          <h1 className="text-2xl font-black text-ink sm:text-3xl">
            {account.name ? `Bonjour, ${account.name}` : "Tableau de bord"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Vue claire de vos tunnels, exports et leads
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button href="/create" className="w-full justify-center sm:w-auto">
            <Sparkles size={15} /> Créer un tunnel
          </Button>
          <CloneFunnelButton className="w-full justify-center sm:w-auto" />
        </div>
      </div>

      {/* KPI */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Tunnels créés"
          value={String(totalFunnels)}
          icon={<FileText size={18} />}
          accent="blue"
          trend={totalFunnels > 0 ? { value: 12 } : undefined}
        />
        <DashboardCard
          label="Leads collectés"
          value={leadsCount === null ? "…" : String(leadsCount)}
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
          value={String(exportsCount)}
          icon={<Download size={18} />}
          accent="blue"
        />
      </div>

      {/* KPI Paiements */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Chiffre d'affaires"
          value={payStats === null ? "…" : formatMoney(payStats.revenue, payStats.currency)}
          icon={<Wallet size={18} />}
          accent="green"
        />
        <DashboardCard
          label="Paiements"
          value={payStats === null ? "…" : String(payStats.payments)}
          icon={<CreditCard size={18} />}
          accent="gold"
        />
        <DashboardCard
          label="Clients"
          value={payStats === null ? "…" : String(payStats.clients)}
          icon={<UserCheck size={18} />}
          accent="blue"
        />
        <DashboardCard
          label="Taux de conversion"
          value={payStats === null ? "…" : `${payStats.conversionRate}%`}
          icon={<Percent size={18} />}
          accent="green"
        />
      </div>

      {/* 🆕 KPI Emails — calculés automatiquement ; détail complet dans /emails. */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-black text-ink">Emails</h2>
        <Link
          href="/emails"
          className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline"
        >
          Voir les emails <ArrowRight size={13} />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Campagnes"
          value={emailStats === null ? "…" : String(emailStats.totalCampaigns)}
          icon={<Megaphone size={18} />}
          accent="blue"
        />
        <DashboardCard
          label="Emails envoyés"
          value={emailStats === null ? "…" : emailStats.emailsSent.toLocaleString("fr-FR")}
          icon={<Send size={18} />}
          accent="green"
        />
        <DashboardCard
          label="Taux d'ouverture"
          value={emailStats === null ? "…" : `${emailStats.openRate}%`}
          icon={<MailOpen size={18} />}
          accent="gold"
        />
        <DashboardCard
          label="Séquences actives"
          value={emailStats === null ? "…" : String(emailStats.activeSequences)}
          icon={<Workflow size={18} />}
          accent="blue"
        />
      </div>

      {/* Contenu */}
      <div className="mt-6">
        {/* Liste tunnels */}
        <Card className="p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-lg font-black text-ink">Derniers tunnels</h2>
            <p className="text-xs text-muted">Vos tunnels les plus récents</p>
          </div>

          <div className="grid gap-2">
            {(showAllFunnels ? stored : stored.slice(0, RECENT_LIMIT)).map((item) => (
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

          {stored.length > RECENT_LIMIT && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllFunnels((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-canvas"
              >
                {showAllFunnels
                  ? "Voir moins"
                  : `Voir plus (${stored.length - RECENT_LIMIT})`}
              </button>
            </div>
          )}
        </Card>
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
  const pageLabel = pages.length > 1 ? `${pages.length} pages · ` : "";

  return (
    <div className="ff-card-hover flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-white p-3 sm:p-3.5">
      <a href={`/editor/${id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{funnel.funnelName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {pageLabel}
          {sectionCount} sections · {language} · {dateLabel}
        </p>
      </a>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
