"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, List, Loader2, LockKeyhole, Share2, Tag, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type UserSummary = { id: string; email: string; full_name: string | null };
type Share = {
  id: string;
  permission: "read_only";
  createdAt: string;
  owner: UserSummary | null;
  grantee: UserSummary | null;
};
type Label = { id: string; name: string; color: string };
type SharedContact = {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  consent: boolean;
  created_at: string;
  lists: Label[];
  tags: Label[];
};
type Snapshot = {
  owner: UserSummary;
  totalContacts: number;
  contacts: SharedContact[];
  lists: Array<Label & { description?: string | null; origin?: string }>;
  tags: Label[];
  limit: number;
};

function displayName(user: UserSummary | null): string {
  return user?.full_name?.trim() || user?.email || "Compte indisponible";
}

function Badge({ item }: { item: Label }) {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ backgroundColor: `${item.color || "#C7A436"}22`, color: item.color || "#8A6D14" }}
    >
      {item.name}
    </span>
  );
}

export function CrmSharingClient() {
  const [granted, setGranted] = useState<Share[]>([]);
  const [received, setReceived] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/crm/shares", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.message || "Chargement impossible.");
      setGranted(json.granted ?? []);
      setReceived(json.received ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  async function addShare(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/crm/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.message || "Partage impossible.");
      setEmail("");
      setMessage("Accès en lecture activé.");
      await loadShares();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Partage impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeShare(id: string) {
    if (!window.confirm("Révoquer immédiatement cet accès au CRM ?")) return;
    const response = await fetch(`/api/crm/shares?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      setMessage(json?.message || "Révocation impossible.");
      return;
    }
    setMessage("Accès révoqué.");
    await loadShares();
  }

  async function viewSharedCrm(ownerId: string) {
    setSelectedOwnerId(ownerId);
    setSnapshot(null);
    setSnapshotLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/crm/shares/${encodeURIComponent(ownerId)}/snapshot`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.message || "Consultation impossible.");
      setSnapshot(json.snapshot as Snapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Consultation impossible.");
    } finally {
      setSnapshotLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-gold-dark">
          <LockKeyhole className="h-4 w-4" />
          <span className="text-xs font-black uppercase tracking-widest">Lecture seule sécurisée</span>
        </div>
        <h1 className="text-3xl font-black text-ink">Partage du CRM</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Partage uniquement les contacts, leurs listes et leurs tags. Les tunnels complets,
          contenus d’emails, commandes, données techniques et réglages du compte restent privés.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold text-ink">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-gold-dark" />
            <h2 className="text-lg font-black text-ink">Donner un accès</h2>
          </div>
          <form onSubmit={addShare} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@du-partenaire.com"
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-gold"
              required
            />
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Autoriser
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted">
            Le destinataire doit déjà disposer d’un compte AutoFunnel AI actif.
          </p>

          <div className="mt-5 space-y-2">
            {loading && <p className="text-sm text-muted">Chargement…</p>}
            {!loading && granted.length === 0 && (
              <p className="text-sm text-muted">Aucun accès externe actif.</p>
            )}
            {granted.map((share) => (
              <div key={share.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{displayName(share.grantee)}</div>
                  <div className="truncate text-xs text-muted">{share.grantee?.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void revokeShare(share.id)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Révoquer
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-gold-dark" />
            <h2 className="text-lg font-black text-ink">CRM partagés avec moi</h2>
          </div>
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted">Chargement…</p>}
            {!loading && received.length === 0 && (
              <p className="text-sm text-muted">Aucun CRM partagé avec ce compte.</p>
            )}
            {received.map((share) => (
              <div key={share.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{displayName(share.owner)}</div>
                  <div className="truncate text-xs text-muted">{share.owner?.email}</div>
                </div>
                <Button
                  type="button"
                  variant={selectedOwnerId === share.owner?.id ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => share.owner?.id && void viewSharedCrm(share.owner.id)}
                >
                  <Eye className="h-3.5 w-3.5" /> Voir
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {snapshotLoading && (
        <Card className="flex min-h-40 items-center justify-center p-6 text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du CRM partagé…
        </Card>
      )}

      {snapshot && !snapshotLoading && (
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted">Consultation uniquement</div>
                <h2 className="mt-1 text-xl font-black text-ink">CRM de {displayName(snapshot.owner)}</h2>
              </div>
              <div className="flex gap-2 text-xs font-bold text-muted">
                <span className="rounded-full bg-canvas px-3 py-1.5">{snapshot.totalContacts} contacts</span>
                <span className="rounded-full bg-canvas px-3 py-1.5">{snapshot.lists.length} listes</span>
                <span className="rounded-full bg-canvas px-3 py-1.5">{snapshot.tags.length} tags</span>
              </div>
            </div>
            {snapshot.totalContacts > snapshot.contacts.length && (
              <p className="mt-2 text-xs text-muted">
                Les {snapshot.limit} contacts les plus récents sont affichés.
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Le forfait du destinataire ne limite pas cette consultation en lecture seule.
            </p>
          </div>

          <div className="grid gap-4 border-b border-line bg-canvas/40 p-5 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="shared-lists-title">
              <div className="mb-3 flex items-center gap-2">
                <List className="h-4 w-4 text-gold-dark" />
                <h3 id="shared-lists-title" className="text-sm font-black text-ink">
                  Listes partagées ({snapshot.lists.length})
                </h3>
              </div>
              {snapshot.lists.length ? (
                <div className="space-y-2">
                  {snapshot.lists.map((list) => (
                    <div key={list.id} className="rounded-lg border border-line px-3 py-2.5">
                      <Badge item={list} />
                      {list.description && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">{list.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">Aucune liste créée dans ce CRM.</p>
              )}
            </section>

            <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="shared-tags-title">
              <div className="mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gold-dark" />
                <h3 id="shared-tags-title" className="text-sm font-black text-ink">
                  Tags partagés ({snapshot.tags.length})
                </h3>
              </div>
              {snapshot.tags.length ? (
                <div className="flex flex-wrap gap-2">
                  {snapshot.tags.map((tag) => <Badge key={tag.id} item={tag} />)}
                </div>
              ) : (
                <p className="text-xs text-muted">Aucun tag créé dans ce CRM.</p>
              )}
            </section>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-canvas text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Listes</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Consentement</th>
                  <th className="px-4 py-3">Ajouté le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {snapshot.contacts.map((contact) => (
                  <tr key={contact.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">
                        {contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Sans nom"}
                      </div>
                      <div className="text-xs text-muted">{contact.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{contact.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{contact.status}</div>
                      <div className="text-xs text-muted">{contact.source || "Source inconnue"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {contact.lists.length ? contact.lists.map((item) => <Badge key={item.id} item={item} />) : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {contact.tags.length ? contact.tags.map((item) => <Badge key={item.id} item={item} />) : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{contact.consent ? "Oui" : "Non"}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(contact.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
                {snapshot.contacts.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Aucun contact.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
