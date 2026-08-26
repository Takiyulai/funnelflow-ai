"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, List as ListIcon, X } from "lucide-react";
import type { ContactListWithCount } from "@/lib/crm/types";
import type { FunnelSection } from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

/** Sélectionne les listes CRM alimentées à chaque soumission du formulaire. */
export function CaptureListsEditor({ section, onChange }: Props) {
  const selectedIds = section.formConfig?.captureListIds ?? [];
  const [lists, setLists] = useState<ContactListWithCount[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/crm/lists")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.ok && Array.isArray(data.lists)) {
          setLists(data.lists as ContactListWithCount[]);
          setLoadFailed(false);
        } else {
          setLoadFailed(true);
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedLists = useMemo(
    () =>
      selectedIds.map((id) => ({
        id,
        list: lists.find((item) => item.id === id),
      })),
    [lists, selectedIds],
  );

  const availableLists = useMemo(() => {
    const selected = new Set(selectedIds);
    const normalizedQuery = query.trim().toLowerCase();
    return lists.filter(
      (list) =>
        !selected.has(list.id) &&
        (!normalizedQuery || list.name.toLowerCase().includes(normalizedQuery)),
    );
  }, [lists, query, selectedIds]);

  const commit = (next: string[]) => {
    onChange({
      formConfig: {
        ...(section.formConfig ?? {}),
        provider: section.formConfig?.provider ?? "internal",
        captureListIds: [...new Set(next)],
      },
    });
  };

  const addList = (id: string) => {
    if (!selectedIds.includes(id)) commit([...selectedIds, id]);
    setQuery("");
  };

  const removeList = (id: string) => {
    commit(selectedIds.filter((selectedId) => selectedId !== id));
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-medium text-white/70">
        <ListIcon className="h-3.5 w-3.5 text-violet-300" />
        Listes alimentées
        <span className="ml-1 text-[10px] text-white/40">(CRM, à la soumission)</span>
      </label>

      {selectedLists.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLists.map(({ id, list }) => (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-200"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: list?.color || "#8B5CF6" }}
              />
              {list?.name ?? "Liste indisponible"}
              <button
                type="button"
                onClick={() => removeList(id)}
                className="text-violet-200/60 hover:text-violet-100"
                aria-label={`Retirer ${list?.name ?? "cette liste"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={loading || loadFailed}
          className="flex w-full items-center justify-between rounded-md border border-white/15 bg-zinc-900 px-2.5 py-2 text-left text-sm text-white/80 transition hover:border-violet-300/40 disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={open}
        >
          <span>
            {loading
              ? "Chargement des listes…"
              : loadFailed
                ? "Listes indisponibles"
                : lists.length === 0
                  ? "Aucune liste CRM disponible"
                  : "Ajouter une liste…"}
          </span>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open && !loading && !loadFailed && lists.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-white/15 bg-zinc-900 shadow-xl">
            <div className="border-b border-white/10 p-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une liste…"
                className="w-full rounded-md border border-white/15 bg-black/20 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/40 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {availableLists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => addList(list.id)}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/[0.06]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: list.color || "#8B5CF6" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                  <span className="text-[10px] text-white/40">{list.contactsCount}</span>
                </button>
              ))}
              {availableLists.length === 0 && (
                <p className="px-3 py-3 text-xs text-white/40">
                  {query ? "Aucune liste ne correspond." : "Toutes les listes sont sélectionnées."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/40">
        Chaque lead qui envoie ce formulaire sera ajouté aux listes sélectionnées,
        sans modifier ses tags. Créez les listes depuis le CRM avant de les choisir ici.
      </p>
    </div>
  );
}
