// components/admin/AdminUsersTable.tsx
// 🆕 MODULE 4 — Liste des utilisateurs (email, plan, statut de licence, date
// d'expiration, dernière connexion) + accès au détail/CRUD via
// AdminUserDetailModal. La protection d'accès à /admin est déjà faite côté
// serveur (requireAdminPage) — ce composant suppose donc que l'appelant est
// bien admin, mais chaque appel API sous-jacent revérifie quand même côté
// serveur (défense en profondeur, jamais de confiance dans le seul rendu).
"use client";

import { useState } from "react";
import { Search, Eye, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { AdminUserRow } from "@/lib/admin/users";
import { AdminUserDetailModal } from "@/components/admin/AdminUserDetailModal";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function licenseBadgeTone(status: string | null): "green" | "red" | "gold" | "neutral" {
  if (status === "active") return "green";
  if (status === "expired" || status === "revoked" || status === "invalid") return "red";
  return "neutral";
}

const LICENSE_LABEL: Record<string, string> = {
  active: "Active",
  expired: "Expirée",
  revoked: "Révoquée",
  invalid: "Invalide",
};

export function AdminUsersTable({
  initialUsers,
  initialTotal,
}: {
  initialUsers: AdminUserRow[];
  initialTotal: number;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function search(query: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&limit=50`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setUsers(json.users);
        setTotal(json.total);
      }
    } finally {
      setLoading(false);
    }
  }

  function refreshAfterChange() {
    search(q);
  }

  return (
    <>
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line bg-[#F8F9FB] p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search(q);
              }}
              placeholder="Rechercher (email, nom)…"
              className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-[#08498D] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => search(q)}
            className="rounded-lg bg-[#08498D] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Rechercher
          </button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-bold">Compte</th>
                <th className="px-4 py-3 font-bold">Plan</th>
                <th className="px-4 py-3 font-bold">Licence</th>
                <th className="px-4 py-3 font-bold">Expiration</th>
                <th className="px-4 py-3 font-bold">Dernière connexion</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line/60 hover:bg-[#F8F9FB]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink">
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={licenseBadgeTone(u.license_status)}>
                      {u.license_status ? LICENSE_LABEL[u.license_status] ?? u.license_status : "Aucune"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink">{formatDate(u.license_expires_at)}</td>
                  <td className="px-4 py-3 text-ink">{formatDate(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_active ? "green" : "red"}>
                      {u.is_active ? "Actif" : "Désactivé"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedId(u.id)}
                        title="Voir la fiche"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
                      >
                        <Eye className="h-4 w-4 text-muted" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length > 0 && (
          <p className="border-t border-line px-4 py-3 text-xs text-muted">
            {users.length} affiché{users.length > 1 ? "s" : ""} sur {total} au total.
          </p>
        )}
      </Card>

      {selectedId && (
        <AdminUserDetailModal
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={refreshAfterChange}
        />
      )}
    </>
  );
}
