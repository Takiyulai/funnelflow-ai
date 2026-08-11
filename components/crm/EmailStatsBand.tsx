// components/crm/EmailStatsBand.tsx
// 🆕 Bandeau de statistiques email (haut de l'onglet Emails). Purement
// présentationnel : reçoit les stats déjà calculées côté serveur.
import {
  Megaphone,
  Send,
  Rocket,
  MailOpen,
  MousePointerClick,
  Workflow,
} from "lucide-react";
import type { EmailStats } from "@/lib/crm/emailStats";

type Tile = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  fg: string;
  bg: string;
};

export function EmailStatsBand({ stats }: { stats: EmailStats }) {
  const tiles: Tile[] = [
    {
      label: "Campagnes",
      value: String(stats.totalCampaigns),
      sub: `${stats.sentCampaigns} envoyée${stats.sentCampaigns > 1 ? "s" : ""}`,
      icon: <Megaphone size={16} />,
      fg: "text-navy",
      bg: "bg-softBlue",
    },
    {
      label: "Actives",
      value: String(stats.activeCampaigns),
      sub: "programmées / en cours",
      icon: <Rocket size={16} />,
      fg: "text-[#7A6520]",
      bg: "bg-lightGold",
    },
    {
      label: "Emails envoyés",
      value: stats.emailsSent.toLocaleString("fr-FR"),
      icon: <Send size={16} />,
      fg: "text-green",
      bg: "bg-softGreen",
    },
    {
      label: "Taux d'ouverture",
      value: `${stats.openRate}%`,
      sub: `${stats.opens.toLocaleString("fr-FR")} ouverture${stats.opens > 1 ? "s" : ""}`,
      icon: <MailOpen size={16} />,
      fg: "text-navy",
      bg: "bg-softBlue",
    },
    {
      label: "Taux de clic",
      value: `${stats.clickRate}%`,
      sub: `${stats.clicks.toLocaleString("fr-FR")} clic${stats.clicks > 1 ? "s" : ""}`,
      icon: <MousePointerClick size={16} />,
      fg: "text-[#7A6520]",
      bg: "bg-lightGold",
    },
    {
      label: "Séquences actives",
      value: String(stats.activeSequences),
      icon: <Workflow size={16} />,
      fg: "text-green",
      bg: "bg-softGreen",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          // `bg-white` en dur restait blanc en mode sombre — texte `text-ink`
          // clair sur fond blanc, donc illisible. `bg-surface` bascule.
          className="rounded-xl border border-line bg-surface p-3 shadow-sm sm:p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {t.label}
            </p>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${t.bg} ${t.fg}`}>
              {t.icon}
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-black leading-none text-ink">{t.value}</p>
          {t.sub && <p className="mt-1 text-[11px] text-muted">{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}
