"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Eye, X, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { waMeLink } from "@/lib/crm/phone";
import { CountrySelect } from "@/components/crm/CountrySelect";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import type { ContactWithTags, Tag, LeadStatus } from "@/lib/crm/types";

const STATUS_LABEL: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  client: "Client",
  perdu: "Perdu",
};

type Props = {
  initialContacts: ContactWithTags[];
  total: number;
  tags: Tag[];
  filters: { q: string; tag: string; status: string; funnel?: string };
  funnels?: { id: string; name: string }[];
  exportHref?: string;
};

export function ContactsTable({
  initialContacts,
  total,
  tags,
  filters,
  funnels = [],
  exportHref,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState("");
  const [newTag, setNewTag] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [creating, setCreating] = useState(false);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleAll() {
    setSelected((cur) =>
      cur.length === initialContacts.length ? [] : initialContacts.map((c) => c.id),
    );
  }
  async function applyBulkTag() {
    if (!bulkTag || selected.length === 0) return;
    const res = await fetch("/api/crm/tags/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: selected, tagIds: [bulkTag], action: "add" }),
    });
    if (res.ok) {
      setSelected([]);
      setBulkTag("");
      router.refresh();
    } else {
      alert("Tagging en masse impossible.");
    }
  }

  // 🆕 Crée un nouveau tag, puis l'assigne aux contacts sélectionnés.
  async function createAndAssignTag() {
    const name = newTag.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/crm/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        alert(json.error || "Création du tag impossible.");
        return;
      }
      if (selected.length > 0) {
        await fetch("/api/crm/tags/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: selected, tagIds: [json.tag.id], action: "add" }),
        });
        setSelected([]);
      }
      setNewTag("");
      router.refresh();
    } finally {
      setCreatingTag(false);
    }
  }
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    phone_country: "FR",
    status: "nouveau" as LeadStatus,
    funnel_id: "",
  });

  async function createContact() {
    if (!form.email.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setCreating(false);
        setForm({ email: "", name: "", phone: "", phone_country: "FR", status: "nouveau", funnel_id: "" });
        router.refresh();
      } else {
        alert(json.error || "Création impossible.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(id: string) {
    if (!window.confirm("Supprimer ce contact ? Cette action est définitive.")) return;
    const res = await fetch(`/api/crm/contacts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Suppression impossible.");
  }

  return (
    <div className="animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink">Leads &amp; Contacts</h1>
          <p className="mt-2 text-sm text-muted">{total} contact{total > 1 ? "s" : ""} dans votre CRM</p>
        </div>
        <div className="flex items-center gap-2">
          {exportHref && (
            <Button href={exportHref} variant="secondary">
              <Download className="h-4 w-4" />
              Exporter CSV
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nouveau contact
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Filtres (navigation GET native) */}
        <form
          method="GET"
          className="flex flex-wrap items-center gap-3 p-4 border-b border-line bg-[#F8F9FB]"
        >
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              name="q"
              defaultValue={filters.q}
              placeholder="Rechercher (nom, email, téléphone)…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
            />
          </div>
          {funnels.length > 0 && (
            <select
              name="funnel"
              defaultValue={filters.funnel ?? ""}
              className="px-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
            >
              <option value="">Tous tunnels</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          <select
            name="tag"
            defaultValue={filters.tag}
            className="px-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
          >
            <option value="">Tous les tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            className="px-3 py-2 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
          >
            <option value="">Tous statuts</option>
            {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[#08498D] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Filtrer
          </button>
        </form>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-[#FFF8E6] px-4 py-3">
            <span className="text-sm font-semibold text-ink">{selected.length} sélectionné(s)</span>
            <select
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
            >
              <option value="">Choisir un tag…</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulkTag}
              disabled={!bulkTag}
              className="px-3 py-1.5 rounded-lg bg-[#08498D] text-white text-sm font-semibold disabled:opacity-50"
            >
              Ajouter le tag
            </button>

            <span className="text-sm text-muted">ou</span>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createAndAssignTag();
                }
              }}
              placeholder="Nouveau tag…"
              className="w-40 px-3 py-1.5 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-[#08498D]"
            />
            <button
              type="button"
              onClick={createAndAssignTag}
              disabled={!newTag.trim() || creatingTag}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#08498D] text-[#08498D] text-sm font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {creatingTag ? "Création…" : "Créer & ajouter"}
            </button>

            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-sm text-muted hover:text-ink"
            >
              Annuler
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={initialContacts.length > 0 && selected.length === initialContacts.length}
                    onChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </th>
                <th className="px-4 py-3 font-bold">Contact</th>
                <th className="px-4 py-3 font-bold">Téléphone</th>
                <th className="px-4 py-3 font-bold">Tags</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Aucun contact. Créez-en un ou laissez vos tunnels en capturer.
                  </td>
                </tr>
              )}
              {initialContacts.map((c) => {
                const wa = waMeLink(c.phone);
                return (
                  <tr key={c.id} className="border-b border-line/60 hover:bg-[#F8F9FB]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={() => toggle(c.id)}
                        aria-label={`Sélectionner ${c.email}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{c.name || "—"}</div>
                      <div className="text-xs text-muted">{c.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-ink">{c.phone}</span>
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ouvrir WhatsApp"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
                              style={{ background: "#25D366" }}
                            >
                              <WhatsAppIcon className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 && <span className="text-muted">—</span>}
                        {c.tags.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{ background: `${t.color}22`, color: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink">
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/leads/${c.id}`}
                          title="Voir la fiche"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
                        >
                          <Eye className="h-4 w-4 text-muted" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeContact(c.id)}
                          title="Supprimer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:border-red-400/50 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal création */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !saving && setCreating(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">Nouveau contact</h2>
              <button type="button" onClick={() => setCreating(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3">
              <input
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
              />
              <input
                type="text"
                placeholder="Nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
              />
              <div className="flex gap-2">
                <CountrySelect
                  value={form.phone_country}
                  onChange={(iso) => setForm({ ...form, phone_country: iso })}
                />
                <input
                  type="tel"
                  placeholder="Téléphone WhatsApp"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
                />
              </div>
              {funnels.length > 0 && (
                <select
                  value={form.funnel_id}
                  onChange={(e) => setForm({ ...form, funnel_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
                >
                  <option value="">Tunnel associé (aucun)</option>
                  {funnels.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
              >
                {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={createContact} disabled={saving || !form.email.trim()}>
                {saving ? "Création…" : "Créer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
