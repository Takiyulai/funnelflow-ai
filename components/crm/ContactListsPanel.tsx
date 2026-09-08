"use client";

import Link from "next/link";
import { useState } from "react";
import { ListChecks, Loader2, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import type { ContactListWithCount } from "@/lib/crm/types";
import { Button } from "@/components/ui/Button";

type Props = {
  lists: ContactListWithCount[];
  onChange: (lists: ContactListWithCount[]) => void;
};

type EditDraft = {
  id: string;
  name: string;
  description: string;
};

export function ContactListsPanel({ lists, onChange }: Props) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createList() {
    const cleanName = name.trim();
    if (!cleanName || creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/crm/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data.list) {
        setError(
          data?.error === "list_already_exists"
            ? "Une liste porte déjà ce nom."
            : "La liste n’a pas pu être créée. Réessayez dans un instant.",
        );
        return;
      }
      const created = { ...data.list, contactsCount: 0 } as ContactListWithCount;
      onChange([created, ...lists.filter((list) => list.id !== created.id)]);
      setName("");
    } catch {
      setError("La liste n’a pas pu être créée. Réessayez dans un instant.");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit() {
    if (!editing || busyId) return;
    const cleanName = editing.name.trim();
    if (!cleanName) {
      setError("Le nom de la liste est obligatoire.");
      return;
    }
    setBusyId(editing.id);
    setError(null);
    try {
      const response = await fetch(`/api/crm/lists/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, description: editing.description }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data.list) {
        setError("Les modifications n’ont pas pu être enregistrées.");
        return;
      }
      onChange(
        lists.map((list) =>
          list.id === editing.id
            ? { ...data.list, contactsCount: list.contactsCount }
            : list,
        ),
      );
      setEditing(null);
    } catch {
      setError("Les modifications n’ont pas pu être enregistrées.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeList(list: ContactListWithCount) {
    if (busyId) return;
    const confirmed = window.confirm(
      `Supprimer la liste « ${list.name} » ? Les contacts resteront dans le CRM.`,
    );
    if (!confirmed) return;
    setBusyId(list.id);
    setError(null);
    try {
      const response = await fetch(`/api/crm/lists/${list.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError("La liste n’a pas pu être supprimée.");
        return;
      }
      onChange(lists.filter((item) => item.id !== list.id));
      if (editing?.id === list.id) setEditing(null);
    } catch {
      setError("La liste n’a pas pu être supprimée.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="min-w-0 animate-[fadeIn_0.4s_ease-out]" aria-labelledby="contact-lists-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="contact-lists-title" className="text-2xl font-black text-ink sm:text-3xl">
            Listes de contacts
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Regroupez vos contacts sans modifier leurs tags. Ces listes deviennent
            immédiatement disponibles pour vos campagnes email et vos workflows.
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-4">
        <label className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Nouvelle liste
          </span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createList();
              }
            }}
            placeholder="Ex. Inscrits au webinaire"
            maxLength={120}
            className="mt-1.5 w-full min-w-0 rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus-ring"
          />
        </label>
        <Button
          onClick={() => void createList()}
          disabled={!name.trim() || creating}
          className="w-full self-end sm:w-auto"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Création…" : "Créer la liste"}
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}

      {lists.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <ListChecks className="mx-auto h-7 w-7 text-accent-ink" />
          <p className="mt-3 font-bold text-ink">Aucune liste pour l’instant</p>
          <p className="mt-1 text-sm text-muted">
            Créez une liste ici ou depuis le formulaire d’un tunnel.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => {
            const isEditing = editing?.id === list.id;
            const isBusy = busyId === list.id;
            return (
              <article
                key={list.id}
                className="min-w-0 rounded-xl border border-line bg-surface p-4 shadow-sm"
              >
                {isEditing ? (
                  <div className="grid min-w-0 gap-3">
                    <label className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Nom
                      </span>
                      <input
                        value={editing.name}
                        onChange={(event) =>
                          setEditing({ ...editing, name: event.target.value })
                        }
                        maxLength={120}
                        className="mt-1 w-full min-w-0 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Description (optionnelle)
                      </span>
                      <textarea
                        value={editing.description}
                        onChange={(event) =>
                          setEditing({ ...editing, description: event.target.value })
                        }
                        maxLength={500}
                        rows={3}
                        className="mt-1 w-full min-w-0 resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus-ring"
                      />
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={isBusy}>
                        <X className="h-4 w-4" /> Annuler
                      </Button>
                      <Button size="sm" onClick={() => void saveEdit()} disabled={isBusy || !editing.name.trim()}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: list.color || "#8B5CF6" }}
                        />
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-ink">{list.name}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <Users className="h-3.5 w-3.5" />
                            {list.contactsCount} contact{list.contactsCount > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: list.id,
                              name: list.name,
                              description: list.description ?? "",
                            })
                          }
                          aria-label={`Modifier ${list.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-canvas hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeList(list)}
                          disabled={isBusy}
                          aria-label={`Supprimer ${list.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-red/5 hover:text-red disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {list.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
                        {list.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        {list.origin === "import" ? "Issue d’un import" : "Liste manuelle"}
                      </span>
                      <Link
                        href={`/leads?list=${encodeURIComponent(list.id)}`}
                        className="text-xs font-bold text-accent-ink hover:underline"
                      >
                        Voir les contacts
                      </Link>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
