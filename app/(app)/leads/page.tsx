"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Download, Filter, Mail, Search } from "lucide-react";
import { useState } from "react";

const demoLeads = [
  { id: "1", name: "Marie Dubois", email: "marie@exemple.fr", funnel: "Ebook gratuit", status: "nouveau", date: "il y a 2h" },
  { id: "2", name: "Thomas Lefevre", email: "thomas@startup.io", funnel: "Coaching premium", status: "qualifie", date: "il y a 5h" },
  { id: "3", name: "Sophie Martin", email: "sophie.m@gmail.com", funnel: "Formation SEO", status: "client", date: "hier" },
  { id: "4", name: "Lucas Bernard", email: "lucas@agence.fr", funnel: "Ebook gratuit", status: "contacte", date: "hier" },
  { id: "5", name: "Emma Rousseau", email: "emma@pro.com", funnel: "Consulting", status: "nouveau", date: "il y a 2j" }
];

const statusTone: Record<string, "blue" | "gold" | "green" | "neutral"> = {
  nouveau: "blue", contacte: "gold", qualifie: "gold", client: "green", perdu: "neutral"
};

export default function LeadsPage() {
  const [query, setQuery] = useState("");
  const filtered = demoLeads.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 mb-6 animate-[fadeIn_0.4s_ease-out]">
        <div>
          <h1 className="text-3xl font-black text-ink">Leads</h1>
          <p className="mt-2 text-sm text-muted">Suivez et qualifiez les contacts collectés par vos tunnels</p>
        </div>
        <Button variant="secondary">
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[
          { label: "Total", value: "246" },
          { label: "Nouveaux", value: "32" },
          { label: "Qualifiés", value: "84" },
          { label: "Clients", value: "18" }
        ].map((kpi, i) => (
          <Card
            key={kpi.label}
            className="p-5 hover:shadow-md transition-shadow duration-200"
            style={{ animation: `fadeIn 0.4s ease-out ${i * 60}ms both` }}
          >
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted">{kpi.label}</p>
            <p className="text-3xl font-black text-ink mt-1">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden animate-[fadeIn_0.4s_ease-out]">
        <div className="flex items-center gap-3 p-4 border-b border-line bg-[#F8F9FB]">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un lead..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D] transition-colors"
            />
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-white text-sm font-semibold text-ink hover:border-[#08498D] hover:text-[#08498D] transition"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FB] text-[11px] uppercase tracking-wider text-muted font-bold">
              <tr>
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Tunnel</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-t border-line hover:bg-[#F8F9FB] transition-colors">
                  <td className="px-4 py-3 font-semibold text-ink">{lead.name}</td>
                  <td className="px-4 py-3 text-muted">{lead.email}</td>
                  <td className="px-4 py-3 text-ink">{lead.funnel}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[lead.status]}>{lead.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.date}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink hover:border-[#08498D] hover:text-[#08498D] transition"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Contacter
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                    Aucun lead trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
