"use client";

// components/admin/AdminTabs.tsx
// 🆕 Deux onglets horizontaux pour le dashboard admin :
//   1. Utilisateurs — l'interface de gestion existante, inchangée.
//   2. Clés API     — consommation et solde de chaque fournisseur.
//
// L'onglet actif est reflété dans l'URL (?tab=) : un rafraîchissement ou un
// lien partagé retombe sur le bon onglet. Le panneau « Clés API » n'est monté
// (et n'interroge donc les fournisseurs) que lorsqu'il est réellement ouvert.

import { useState } from "react";
import { KeyRound, Users2 } from "lucide-react";
import { AdminApiKeysPanel } from "@/components/admin/AdminApiKeysPanel";

type TabId = "users" | "keys";

const TABS: { id: TabId; label: string; icon: typeof Users2 }[] = [
  { id: "users", label: "Utilisateurs", icon: Users2 },
  { id: "keys", label: "Clés API", icon: KeyRound },
];

export function AdminTabs({
  initialTab = "users",
  usersPanel,
}: {
  initialTab?: TabId;
  /** Interface de gestion des utilisateurs, rendue côté serveur puis passée ici. */
  usersPanel: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabId>(initialTab);

  const select = (next: TabId) => {
    setTab(next);
    // Historique sans rechargement : l'onglet survit à un F5.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sections d'administration"
        className="mb-5 flex items-center gap-1 border-b border-line"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => select(t.id)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                active
                  ? "border-[#08498D] text-[#08498D]"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* L'onglet Utilisateurs reste monté : on évite de perdre sa recherche et
          sa pagination en naviguant vers les clés API et retour. */}
      <div hidden={tab !== "users"}>{usersPanel}</div>
      {tab === "keys" && <AdminApiKeysPanel />}
    </div>
  );
}

export default AdminTabs;
