"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, History, Trash2, Save, Plus, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { waMeLink } from "@/lib/crm/phone";
import { CountrySelect } from "@/components/crm/CountrySelect";
import type { ContactWithTags, LeadStatus, Tag } from "@/lib/crm/types";

const STATUS_LABEL: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  client: "Client",
  perdu: "Perdu",
};

type PageTimeSummary = {
  engagementActiveMs: number;
  postConversionActiveMs: number;
  sessionCount: number;
  lastSeenAt: string | null;
  pages: Array<{
    pageSlug: string;
    activeMs: number;
    sessionCount: number;
    lastSeenAt: string | null;
  }>;
};

function formatActiveTime(milliseconds: number): string {
  if (milliseconds <= 0) return "—";
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function formatVisitDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ContactDetail({ contact }: { contact: ContactWithTags }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [form, setForm] = useState({
    email: contact.email,
    name: contact.name ?? "",
    phone: contact.phone ?? "",
    phone_country: contact.phone_country ?? "FR",
    status: contact.status,
  });

  const wa = waMeLink(form.phone || contact.phone);

  // ── Tags ──────────────────────────────────────────────────────────────
  const [tags, setTags] = useState<Tag[]>(contact.tags);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [pageTime, setPageTime] = useState<PageTimeSummary | null>(null);
  const [pageTimeState, setPageTimeState] = useState<
    "loading" | "ready" | "blocked" | "error"
  >("loading");

  useEffect(() => {
    fetch("/api/crm/tags")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setAllTags(j.tags);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/crm/contacts/${contact.id}/page-time`)
      .then(async (response) => ({ response, json: await response.json().catch(() => null) }))
      .then(({ response, json }) => {
        if (!active) return;
        if (response.ok && json?.ok && json.summary) {
          setPageTime(json.summary as PageTimeSummary);
          setPageTimeState("ready");
        } else if (response.status === 402 || response.status === 403) {
          setPageTimeState("blocked");
        } else {
          setPageTimeState("error");
        }
      })
      .catch(() => {
        if (active) setPageTimeState("error");
      });
    return () => {
      active = false;
    };
  }, [contact.id]);

  async function addTag(tagId: string) {
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag || tags.some((t) => t.id === tagId)) return;
    setTags((cur) => [...cur, tag]);
    await fetch("/api/crm/tags/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [contact.id], tagIds: [tagId], action: "add" }),
    });
  }

  async function removeTag(tagId: string) {
    setTags((cur) => cur.filter((t) => t.id !== tagId));
    await fetch("/api/crm/tags/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [contact.id], tagIds: [tagId], action: "remove" }),
    });
  }

  async function createAndAddTag() {
    const name = newTag.trim();
    if (!name) return;
    setNewTag("");
    const res = await fetch("/api/crm/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) {
      setAllTags((cur) => [...cur, j.tag]);
      setTags((cur) => [...cur, j.tag]);
      await fetch("/api/crm/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contact.id], tagIds: [j.tag.id], action: "add" }),
      });
    } else {
      alert(j.error || "Création du tag impossible.");
    }
  }

  const available = allTags.filter((t) => !tags.some((x) => x.id === t.id));

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } else {
        alert(json.error || "Enregistrement impossible.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Supprimer ce contact ? Cette action est définitive.")) return;
    const res = await fetch(`/api/crm/contacts/${contact.id}`, { method: "DELETE" });
    if (res.ok) router.push("/leads");
    else alert("Suppression impossible.");
  }

  return (
    <div className="max-w-2xl animate-[fadeIn_0.4s_ease-out]">
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Leads &amp; Contacts
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">{form.name || form.email}</h1>
          <p className="mt-1 text-sm text-muted">
            Ajouté le {new Date(contact.created_at).toLocaleDateString()} · source : {contact.source || "—"}
          </p>
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: "#25D366" }}
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp
          </a>
        )}
      </div>

      <Card className="mb-5 p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Tags</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.length === 0 && <span className="text-sm text-muted">Aucun tag.</span>}
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: `${t.color}22`, color: t.color }}
            >
              {t.name}
              <button type="button" onClick={() => removeTag(t.id)} title="Retirer" className="opacity-70 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {available.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && addTag(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
            >
              <option value="">+ Ajouter un tag…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createAndAddTag(); } }}
              placeholder="Nouveau tag"
              className="w-36 px-2 py-1.5 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
            />
            <button
              type="button"
              onClick={createAndAddTag}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
              title="Créer et ajouter"
            >
              <Plus className="h-4 w-4 text-muted" />
            </button>
          </div>
        </div>
      </Card>

      <Card className="mb-5 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
          <Clock className="h-4 w-4" /> Temps passé dans le tunnel
        </div>

        {pageTimeState === "loading" && (
          <p className="text-sm text-muted">Chargement des visites identifiées…</p>
        )}
        {pageTimeState === "blocked" && (
          <p className="text-sm text-muted">
            Le suivi du temps par page n’est pas inclus dans votre plan actuel.
          </p>
        )}
        {pageTimeState === "error" && (
          <p className="text-sm text-muted">
            Les données de temps sont momentanément indisponibles.
          </p>
        )}
        {pageTimeState === "ready" && pageTime && pageTime.pages.length === 0 && (
          <p className="text-sm text-muted">
            Aucune durée enregistrée après la capture de ce prospect.
          </p>
        )}
        {pageTimeState === "ready" && pageTime && pageTime.pages.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-canvas px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Temps d&apos;engagement
                </div>
                <div className="mt-1 text-lg font-black text-ink">
                  {formatActiveTime(pageTime.engagementActiveMs)}
                </div>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Temps après conversion
                </div>
                <div className="mt-1 text-lg font-black text-ink">
                  {formatActiveTime(pageTime.postConversionActiveMs)}
                </div>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Sessions
                </div>
                <div className="mt-1 text-lg font-black text-ink">
                  {pageTime.sessionCount}
                </div>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Dernière visite
                </div>
                <div className="mt-1 text-sm font-bold text-ink">
                  {formatVisitDate(pageTime.lastSeenAt)}
                </div>
              </div>
            </div>

            <div className="divide-y divide-line rounded-lg border border-line">
              {pageTime.pages.map((page) => (
                <div
                  key={page.pageSlug || "home"}
                  className="flex items-center justify-between gap-4 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">
                      {page.pageSlug || "Page d’accueil"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                      <History className="h-3 w-3" /> {page.sessionCount} session
                      {page.sessionCount > 1 ? "s" : ""} · dernière visite {formatVisitDate(page.lastSeenAt)}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-black text-ink">
                    {formatActiveTime(page.activeMs)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Nom</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Téléphone WhatsApp</span>
            <div className="flex gap-2">
              <CountrySelect
                value={form.phone_country}
                onChange={(iso) => setForm({ ...form, phone_country: iso })}
              />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
              />
            </div>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Statut</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
            >
              {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-red-500 hover:border-red-400/50 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-muted">Enregistré à {savedAt}</span>}
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
