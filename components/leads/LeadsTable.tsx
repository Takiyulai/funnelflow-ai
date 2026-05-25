"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, MoreVertical, Trash2, CheckCircle2, XCircle, MailCheck, Star, Trophy, Circle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export type LeadStatus = "nouveau" | "contacte" | "qualifie" | "client" | "perdu";

export type LeadRow = {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  status: LeadStatus;
  funnel_id?: string | null;
  funnel_name?: string | null;
  page_slug?: string | null;
  created_at: string;
};

const statusConfig: Record<
  LeadStatus,
  {
    label: string;
    tone: "blue" | "gold" | "green" | "neutral";
    icon: typeof Circle;
    iconColor: string;
  }
> = {
  nouveau: { label: "Nouveau", tone: "blue", icon: Circle, iconColor: "#08498D" },
  contacte: { label: "Contacté", tone: "gold", icon: MailCheck, iconColor: "#C7A436" },
  qualifie: { label: "Qualifié", tone: "gold", icon: Star, iconColor: "#C7A436" },
  client: { label: "Client", tone: "green", icon: Trophy, iconColor: "#16A34A" },
  perdu: { label: "Perdu", tone: "neutral", icon: XCircle, iconColor: "#94A3B8" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `Il y a ${Math.max(1, Math.floor(diff / 60000))} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
  if (diff < 172800000) return "Hier";
  if (diff < 604800000) return `Il y a ${Math.floor(diff / 86400000)} j`;
  return d.toLocaleDateString("fr-FR");
}

export function LeadsTable({
  initialLeads,
  showFunnelColumn = true,
}: {
  initialLeads: LeadRow[];
  showFunnelColumn?: boolean;
}) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function updateStatus(leadId: string, newStatus: LeadStatus) {
    const prev = leads;
    setLeads((arr) =>
      arr.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)),
    );
    setOpenMenuId(null);

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("update_failed");
    } catch (err) {
      console.error(err);
      setLeads(prev);
      alert("Impossible de mettre à jour le statut. Réessayez.");
    }
  }

  async function deleteLead(leadId: string) {
    if (!confirm("Supprimer définitivement ce lead ?")) return;
    const prev = leads;
    setLeads((arr) => arr.filter((l) => l.id !== leadId));
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
    } catch (err) {
      console.error(err);
      setLeads(prev);
      alert("Suppression impossible.");
    }
  }

  function handleEmailClick(lead: LeadRow) {
    const subject = encodeURIComponent("Suite à votre inscription");
    const body = encodeURIComponent(
      `Bonjour ${lead.name ?? ""},\n\nMerci pour votre intérêt.\n\n`,
    );
    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
    if (lead.status === "nouveau") {
      startTransition(() => {
        updateStatus(lead.id, "contacte");
      });
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F8F9FB] text-[11px] uppercase tracking-wider text-muted font-bold">
          <tr>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Nom</th>
            {showFunnelColumn && <th className="text-left px-4 py-3">Tunnel</th>}
            <th className="text-left px-4 py-3">Statut</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const cfg = statusConfig[lead.status] ?? statusConfig.nouveau;
            const isLost = lead.status === "perdu";
            const isNew = lead.status === "nouveau";
            return (
              <tr
                key={lead.id}
                className={`border-t border-line hover:bg-[#F8F9FB] transition-colors ${
                  isLost ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3 font-semibold text-ink">
                  <span className={isLost ? "line-through" : ""}>{lead.email}</span>
                  {isNew && (
                    <span
                      className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse"
                      title="Nouveau lead"
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{lead.name || "—"}</td>
                {showFunnelColumn && (
                  <td className="px-4 py-3 text-ink">
                    {lead.funnel_id ? (
                      <Link href={`/funnels/${lead.funnel_id}/leads`} className="hover:underline">
                        {lead.funnel_name || "—"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatusDropdown
                    current={lead.status}
                    onChange={(s) => updateStatus(lead.id, s)}
                  />
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(lead.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleEmailClick(lead)}
                      title="Envoyer un email"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink hover:border-[#08498D] transition"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === lead.id ? null : lead.id)}
                        title="Plus d'actions"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink hover:border-[#08498D] transition"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                      {openMenuId === lead.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 mt-1 z-20 w-44 rounded-lg border border-line bg-white shadow-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(lead.email);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-[#F8F9FB] text-ink"
                            >
                              Copier l'email
                            </button>
                            {lead.phone && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(lead.phone!);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-[#F8F9FB] text-ink"
                              >
                                Copier le téléphone
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteLead(lead.id)}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                            >
                              <Trash2 className="h-3 w-3" />
                              Supprimer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
          {leads.length === 0 && (
            <tr>
              <td
                colSpan={showFunnelColumn ? 6 : 5}
                className="px-4 py-10 text-center text-sm text-muted"
              >
                Aucun lead pour ce filtre.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pending && (
        <div className="px-4 py-2 text-[11px] text-muted text-center">Synchronisation…</div>
      )}
    </div>
  );
}

function StatusDropdown({
  current,
  onChange,
}: {
  current: LeadStatus;
  onChange: (s: LeadStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = statusConfig[current];
  const Icon = cfg.icon;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5"
      >
        <Badge tone={cfg.tone}>
          <Icon className="h-3 w-3 inline mr-1" style={{ color: cfg.iconColor }} />
          {cfg.label}
        </Badge>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 w-36 rounded-lg border border-line bg-white shadow-lg overflow-hidden">
            {(Object.keys(statusConfig) as LeadStatus[]).map((s) => {
              const c = statusConfig[s];
              const I = c.icon;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-[#F8F9FB] flex items-center gap-2 ${
                    s === current ? "bg-[#F8F9FB] font-semibold" : ""
                  }`}
                >
                  <I className="h-3.5 w-3.5" style={{ color: c.iconColor }} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
