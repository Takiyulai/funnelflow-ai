"use client";

// components/crm/SequencesClient.tsx
// 🆕 ÉTAPE 4 (génération) + 5 (persistance) + 5b (inscription contact) + 7
// (envoi test). La planification d'envoi réelle est faite par le CRON (étape 6).

import { useEffect, useMemo, useState } from "react";
import {
  Workflow, Sparkles, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle, Loader2,
  Save, FilePlus2, UserPlus, SendHorizonal,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmailRichEditor } from "@/components/crm/EmailRichEditor";
import type { SequenceType, Sequence } from "@/lib/crm/types";

type PublishedFunnel = { id: string; name: string };
type Lang = "fr" | "en" | "es";
type ContactLite = { id: string; email: string; name: string | null };
/** Email édité : porte l'id quand la séquence est enregistrée (pour l'envoi test). */
type EditableEmail = { id?: string; position: number; delayDays: number; subject: string; body: string };

const TYPE_OPTIONS: { value: SequenceType; label: string }[] = [
  { value: "bienvenue", label: "Bienvenue" },
  { value: "nurturing", label: "Nurturing" },
  { value: "relance", label: "Relance" },
  { value: "lancement", label: "Lancement produit" },
  { value: "reengagement", label: "Réengagement" },
  { value: "autre", label: "Autre (sur-mesure)" },
];

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:border-[#08498D]";

function textToHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

export function SequencesClient({ publishedFunnels }: { publishedFunnels: PublishedFunnel[] }) {
  const [type, setType] = useState<SequenceType>("bienvenue");
  const [funnelId, setFunnelId] = useState<string>(publishedFunnels[0]?.id ?? "");
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [emailCount, setEmailCount] = useState(3);
  const [language, setLanguage] = useState<Lang>("fr");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emails, setEmails] = useState<EditableEmail[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [enrollId, setEnrollId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const hasFunnels = publishedFunnels.length > 0;
  const reindex = (list: EditableEmail[]) => list.map((e, i) => ({ ...e, position: i }));

  async function refreshList() {
    try {
      const res = await fetch("/api/crm/sequences");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) setSequences(json.sequences as Sequence[]);
    } catch { /* non bloquant */ }
  }
  useEffect(() => {
    refreshList();
    fetch("/api/crm/contacts?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok && Array.isArray(j.contacts)) {
          setContacts(j.contacts.map((c: ContactLite) => ({ id: c.id, email: c.email, name: c.name })));
        }
      })
      .catch(() => {});
  }, []);

  function resetForm() {
    setEditingId(null); setEmails(null); setName(""); setContext("");
    setError(null); setNotice(null); setEnrollId("");
  }

  async function generate() {
    if (loading) return;
    setLoading(true); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/crm/sequences/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, context, emailCount, language, funnelId: funnelId || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.message || json.error || "Génération impossible."); return; }
      setEmails((json.emails as Array<{ position: number; delayDays: number; subject: string; body: string }>)
        .map((e, i) => ({ position: i, delayDays: e.delayDays, subject: e.subject, body: e.body })));
      if (!name.trim()) {
        const label = TYPE_OPTIONS.find((t) => t.value === type)?.label ?? "Séquence";
        const fn = publishedFunnels.find((f) => f.id === funnelId)?.name;
        setName(fn ? `${label} — ${fn}` : label);
      }
    } catch { setError("Connexion impossible. Réessayez."); }
    finally { setLoading(false); }
  }

  async function save() {
    if (saving || !emails || emails.length === 0) return;
    if (!name.trim()) { setError("Donne un nom à la séquence avant d'enregistrer."); return; }
    setSaving(true); setError(null); setNotice(null);
    const payload = {
      name: name.trim(), type, context: context || null, language, funnel_id: funnelId || null,
      emails: emails.map((e, i) => ({ position: i, delay_days: e.delayDays, subject: e.subject, content: e.body })),
    };
    try {
      const res = await fetch(editingId ? `/api/crm/sequences/${editingId}` : "/api/crm/sequences", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.message || json.error || "Enregistrement impossible."); return; }
      const s = json.sequence;
      setEditingId(s.id);
      // On récupère les ids d'emails (nécessaires pour l'envoi test).
      setEmails((s.emails as Array<{ id: string; delay_days: number; subject: string; content: string }>)
        .map((e, i) => ({ id: e.id, position: i, delayDays: e.delay_days, subject: e.subject, body: e.content })));
      setNotice("Séquence enregistrée.");
      refreshList();
    } catch { setError("Connexion impossible. Réessayez."); }
    finally { setSaving(false); }
  }

  async function loadSequence(id: string) {
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/crm/sequences/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError("Chargement impossible."); return; }
      const s = json.sequence;
      setEditingId(s.id); setName(s.name); setType(s.type); setContext(s.context ?? "");
      setLanguage(s.language as Lang); setFunnelId(s.funnel_id ?? "");
      setEmails((s.emails as Array<{ id: string; delay_days: number; subject: string; content: string }>)
        .map((e, i) => ({ id: e.id, position: i, delayDays: e.delay_days, subject: e.subject, body: e.content })));
    } catch { setError("Connexion impossible."); }
  }

  async function removeSequence(id: string) {
    if (!window.confirm("Supprimer cette séquence ?")) return;
    try {
      const res = await fetch(`/api/crm/sequences/${id}`, { method: "DELETE" });
      if (res.ok) { if (editingId === id) resetForm(); refreshList(); }
    } catch { /* ignore */ }
  }

  async function enroll() {
    if (!editingId || !enrollId || enrolling) return;
    setEnrolling(true); setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/crm/sequences/${editingId}/enroll`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: enrollId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.error || "Inscription impossible."); return; }
      setNotice(`Contact inscrit : ${json.scheduled} email(s) programmé(s).`);
      setEnrollId("");
    } catch { setError("Connexion impossible."); }
    finally { setEnrolling(false); }
  }

  async function testSend(emailId: string) {
    const to = window.prompt("Adresse email pour l'envoi test :", "");
    if (!to) return;
    try {
      const res = await fetch(`/api/crm/sequences/${editingId}/emails/${emailId}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) setNotice(`Email test envoyé à ${to}.`);
      else setError(json.error || "Envoi test impossible.");
    } catch { setError("Connexion impossible."); }
  }

  function updateEmail(i: number, patch: Partial<EditableEmail>) {
    setEmails((cur) => (cur ? cur.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) : cur));
  }
  function move(i: number, dir: -1 | 1) {
    setEmails((cur) => {
      if (!cur) return cur;
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return reindex(next);
    });
  }
  function remove(i: number) { setEmails((cur) => (cur ? reindex(cur.filter((_, idx) => idx !== i)) : cur)); }
  function addEmail() {
    setEmails((cur) => {
      const list = cur ?? [];
      const lastDelay = list.length ? list[list.length - 1].delayDays : -2;
      return reindex([...list, { position: list.length, delayDays: lastDelay + 2, subject: "", body: "" }]);
    });
  }

  const selectedFunnelName = useMemo(
    () => publishedFunnels.find((f) => f.id === funnelId)?.name ?? null,
    [publishedFunnels, funnelId],
  );
  // L'inscription / envoi test ne sont possibles qu'après enregistrement (ids).
  const isSaved = !!editingId && !!emails && emails.every((e) => e.id);

  return (
    <div className="grid gap-5">
      {sequences.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-ink">Mes séquences</h2>
            <button type="button" onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-black/5">
              <FilePlus2 size={14} /> Nouvelle
            </button>
          </div>
          <div className="grid gap-2">
            {sequences.map((s) => (
              <div key={s.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${editingId === s.id ? "border-[#08498D] bg-[#08498D]/5" : "border-line bg-white"}`}>
                <button type="button" onClick={() => loadSequence(s.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-muted">
                    {TYPE_OPTIONS.find((t) => t.value === s.type)?.label ?? s.type} · {s.status}
                  </div>
                </button>
                <button type="button" onClick={() => removeSequence(s.id)}
                  className="rounded-md border border-line p-1.5 text-red-500 hover:border-red-300 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink"><Workflow size={18} /></span>
          <div>
            <h2 className="text-lg font-black text-ink">{editingId ? "Modifier la séquence" : "Créer une séquence"}</h2>
            <p className="text-xs text-muted">Génère une séquence d&apos;emails par IA, alignée sur un de tes tunnels publiés.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Type</span>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as SequenceType)}>
              {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Tunnel rattaché {hasFunnels ? "(recommandé)" : ""}</span>
            <select className={inputCls} value={funnelId} onChange={(e) => setFunnelId(e.target.value)} disabled={!hasFunnels}>
              <option value="">{hasFunnels ? "Aucun (saisie manuelle)" : "Aucun tunnel publié"}</option>
              {publishedFunnels.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Nombre d&apos;emails</span>
            <input type="number" min={1} max={10} className={inputCls} value={emailCount}
              onChange={(e) => setEmailCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Langue {funnelId ? "(reprise du tunnel)" : ""}</span>
            <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value as Lang)} disabled={!!funnelId}>
              {LANG_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </label>
        </div>

        <label className="mt-4 grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Contexte {funnelId ? "(complément)" : "(offre, cible, ton…)"}</span>
          <textarea className={`${inputCls} min-h-[90px] resize-y`}
            placeholder={funnelId ? "Précisions éventuelles. Le contexte du tunnel est injecté automatiquement." : "Décris ton offre, ta cible, ton ton…"}
            value={context} onChange={(e) => setContext(e.target.value)} />
        </label>

        {error && (<div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertCircle size={16} /> {error}</div>)}
        {notice && (<div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>)}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Génération…" : emails ? "Régénérer" : "Générer avec l'IA"}
          </Button>
          {selectedFunnelName && (<span className="text-xs text-muted">Rattaché à : <strong className="text-ink">{selectedFunnelName}</strong></span>)}
        </div>
      </Card>

      {emails && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input className={`${inputCls} max-w-xs font-semibold`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la séquence" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={addEmail}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-black/5">
                <Plus size={14} /> Ajouter un email
              </button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Enregistrer"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {emails.map((em, i) => (
              <div key={i} className="rounded-xl border border-line bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-bold text-ink">Email {i + 1}</span>
                  <div className="flex items-center gap-1">
                    {em.id && (
                      <button type="button" onClick={() => testSend(em.id!)} title="Envoyer un test"
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-ink hover:bg-black/5">
                        <SendHorizonal size={13} /> Test
                      </button>
                    )}
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                      className="rounded-md border border-line p-1.5 text-muted hover:bg-black/5 disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === emails.length - 1}
                      className="rounded-md border border-line p-1.5 text-muted hover:bg-black/5 disabled:opacity-30"><ChevronDown size={14} /></button>
                    <button type="button" onClick={() => remove(i)}
                      className="rounded-md border border-line p-1.5 text-red-500 hover:border-red-300 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Objet</span>
                    <input className={inputCls} value={em.subject} onChange={(e) => updateEmail(i, { subject: e.target.value })} placeholder="Objet de l'email" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Délai (jours)</span>
                    <input type="number" min={0} max={365} className={inputCls} value={em.delayDays}
                      onChange={(e) => updateEmail(i, { delayDays: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                </div>

                <div className="mt-3 grid gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Corps</span>
                  <EmailRichEditor value={textToHtml(em.body)} onChange={(html) => updateEmail(i, { body: html })} placeholder="Contenu de l'email…" />
                </div>
              </div>
            ))}
          </div>

          {/* 5b — Inscrire un contact (uniquement après enregistrement) */}
          <div className="mt-5 rounded-xl border border-line bg-[#F8F9FB] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><UserPlus size={15} /> Inscrire un contact</div>
            {isSaved ? (
              <div className="flex flex-wrap items-center gap-2">
                <select className={`${inputCls} max-w-xs`} value={enrollId} onChange={(e) => setEnrollId(e.target.value)}>
                  <option value="">Choisir un contact…</option>
                  {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                </select>
                <Button onClick={enroll} disabled={!enrollId || enrolling}>
                  {enrolling ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  {enrolling ? "Inscription…" : "Ajouter à la séquence"}
                </Button>
                <span className="text-xs text-muted">Les emails seront programmés selon les délais (J+0, J+2…).</span>
              </div>
            ) : (
              <p className="text-xs text-muted">Enregistre d&apos;abord la séquence pour pouvoir y inscrire des contacts.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
