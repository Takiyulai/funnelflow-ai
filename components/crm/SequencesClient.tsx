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
import { handlePlanGate } from "@/lib/billing/planGate";
import { Button } from "@/components/ui/Button";
import { EmailRichEditor } from "@/components/crm/EmailRichEditor";
import { useCelebrate } from "@/components/ui/Celebration";
import { hasMilestone } from "@/lib/ux/milestones";
import type { SequenceType, SequenceRole, Sequence } from "@/lib/crm/types";

type PublishedFunnel = { id: string; name: string };
type Lang = "fr" | "en" | "es";
type ContactLite = { id: string; email: string; name: string | null };
/** Email édité : porte l'id quand la séquence est enregistrée (pour l'envoi test).
 *  🆕 sendAt : si non-null (ISO), l'email part à cette date/heure FIXE au lieu du
 *  délai relatif (delayDays/delayHours). */
type EditableEmail = { id?: string; position: number; delayDays: number; delayHours: number; sendAt: string | null; subject: string; body: string };

// 🆕 ISO (UTC) ↔ valeur d'un <input type="datetime-local"> (heure locale).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
// 🆕 Date fixe par défaut proposée quand on bascule en mode "Date fixe" : demain 9h.
function defaultFixedIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// 🆕 LOT 1 : rôles proposés dans le constructeur de séquence (+ "autre" en
// saisie libre). Remplace l'ancien champ "type" unique + "nombre de mails".
const ROLE_OPTIONS: { value: SequenceType; label: string }[] = [
  { value: "bienvenue", label: "Bienvenue" },
  { value: "nurturing", label: "Nurturing / valeur" },
  { value: "relance", label: "Relance" },
  { value: "offre", label: "Offre / conversion" },
  { value: "temoignage", label: "Témoignage / preuve sociale" },
  { value: "reengagement", label: "Réactivation" },
  { value: "autre", label: "Personnalisé…" },
];
const TYPE_OPTIONS = ROLE_OPTIONS; // rétrocompat (affichage de l'ancien champ `type`)

function roleLabel(role: SequenceRole): string {
  if (role.id === "autre" && role.label?.trim()) return role.label.trim();
  return ROLE_OPTIONS.find((o) => o.value === role.id)?.label ?? role.id;
}

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
  const { celebrate } = useCelebrate();
  // 🆕 LOT 1 : liste ORDONNÉE de rôles (remplace "type" unique + "nombre de
  // mails" — 1 rôle ajouté = 1 mail généré, dans l'ordre de la liste).
  const [roles, setRoles] = useState<SequenceRole[]>([{ id: "bienvenue" }]);
  const [pendingRoleType, setPendingRoleType] = useState<SequenceType>("bienvenue");
  const [pendingCustomLabel, setPendingCustomLabel] = useState("");
  const [funnelId, setFunnelId] = useState<string>(publishedFunnels[0]?.id ?? "");
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState<Lang>("fr");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emails, setEmails] = useState<EditableEmail[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replayNow, setReplayNow] = useState<number | null>(null);

  const [sequences, setSequences] = useState<Sequence[]>([]);
  // 🆕 LOT 3 — Stats envoyés/ouverts/cliqués par séquence.
  const [seqStats, setSeqStats] = useState<
    Record<string, { sent: number; opens: number; clicks: number }>
  >({});
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [enrollId, setEnrollId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  // 🆕 Index de l'email en cours de régénération individuelle (null = aucun).
  const [regenIdx, setRegenIdx] = useState<number | null>(null);

  const hasFunnels = publishedFunnels.length > 0;
  const reindex = (list: EditableEmail[]) => list.map((e, i) => ({ ...e, position: i }));
  const replayImmediateEmailIndex = useMemo(() => {
    if (!emails || replayNow === null) return -1;
    const lastDatedIndex = emails.reduce((last, email, index) => {
      const fixedMs = email.sendAt ? new Date(email.sendAt).getTime() : NaN;
      return Number.isFinite(fixedMs) ? index : last;
    }, -1);
    if (lastDatedIndex < 0 || lastDatedIndex >= emails.length - 1) return -1;
    const lastFixedMs = new Date(emails[lastDatedIndex].sendAt as string).getTime();
    return lastFixedMs <= replayNow ? lastDatedIndex + 1 : -1;
  }, [emails, replayNow]);

  // 🆕 LOT 1 : gestion de la liste ordonnée de rôles.
  function addRole() {
    if (roles.length >= 10) return;
    const label = pendingCustomLabel.trim();
    if (pendingRoleType === "autre" && !label) return; // libellé requis pour un type personnalisé
    setRoles((cur) => [...cur, pendingRoleType === "autre" ? { id: "autre", label } : { id: pendingRoleType }]);
    setPendingCustomLabel("");
  }
  function removeRole(i: number) {
    setRoles((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur));
  }
  function moveRole(i: number, dir: -1 | 1) {
    setRoles((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function refreshList() {
    try {
      const res = await fetch("/api/crm/sequences");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setSequences(json.sequences as Sequence[]);
        setSeqStats(
          (json.stats ?? {}) as Record<
            string,
            { sent: number; opens: number; clicks: number }
          >,
        );
      }
    } catch { /* non bloquant */ }
  }
  useEffect(() => {
    setReplayNow(Date.now());
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
    setError(null); setNotice(null); setEnrollId(""); setRoles([{ id: "bienvenue" }]);
  }

  async function generate() {
    if (loading) return;
    if (roles.length === 0) { setError("Ajoute au moins un type de mail à la séquence."); return; }
    setLoading(true); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/crm/sequences/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles, context, language, funnelId: funnelId || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      // 🆕 Invite d'abonnement uniforme (aucun forfait actif / quota atteint).
      if (handlePlanGate(res.status, json, (m) => setError(`${m.title}. ${m.description}`))) return;
      if (!res.ok || !json.ok) { setError(json.message || json.error || "Génération impossible."); return; }
      setEmails((json.emails as Array<{ position: number; delayDays: number; delayHours?: number; subject: string; body: string }>)
        .map((e, i) => ({ position: i, delayDays: e.delayDays, delayHours: e.delayHours ?? 0, sendAt: null, subject: e.subject, body: e.body })));
      if (!name.trim()) {
        const label = roleLabel(roles[0]) || "Séquence";
        const fn = publishedFunnels.find((f) => f.id === funnelId)?.name;
        // 🆕 Nom auto BORNÉ à 160 (limite serveur) : les noms de tunnels IA sont
        // parfois très longs → sans cap, l'enregistrement renvoyait invalid_input.
        const raw = fn ? `${label} — ${fn}` : label;
        setName(raw.length > 160 ? `${raw.slice(0, 159).trimEnd()}…` : raw);
      }
    } catch { setError("Connexion impossible. Réessayez."); }
    finally { setLoading(false); }
  }

  // 🆕 Régénère UN SEUL email (celui qui ne convient pas) sans toucher aux
  // autres. Réutilise la route de génération avec le rôle de cet email ; on ne
  // remplace que l'objet + le corps (délais, position et id conservés).
  async function regenerateEmail(i: number) {
    if (regenIdx !== null || !emails) return;
    const role = roles[i] ?? roles[roles.length - 1] ?? ({ id: "autre" } as SequenceRole);
    setRegenIdx(i); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/crm/sequences/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [role], context, language, funnelId: funnelId || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (handlePlanGate(res.status, json, (m) => setError(`${m.title}. ${m.description}`))) return;
      if (!res.ok || !json.ok || !Array.isArray(json.emails) || json.emails.length === 0) {
        setError(json.message || json.error || "Régénération impossible."); return;
      }
      const fresh = json.emails[0] as { subject: string; body: string };
      updateEmail(i, { subject: fresh.subject, body: fresh.body });
      setNotice(`Email ${i + 1} régénéré.`);
    } catch { setError("Connexion impossible. Réessayez."); }
    finally { setRegenIdx(null); }
  }

  // 🆕 Rédaction MANUELLE : ouvre l'éditeur avec un email vide par type choisi,
  // sans appeler l'IA (pour qui veut écrire ses emails soi-même).
  function startManual() {
    setError(null); setNotice(null);
    setEmails(roles.map((_, i) => ({ position: i, delayDays: i * 2, delayHours: 0, sendAt: null, subject: "", body: "" })));
    if (!name.trim()) {
      const label = roleLabel(roles[0]) || "Séquence";
      const fn = publishedFunnels.find((f) => f.id === funnelId)?.name;
      const raw = fn ? `${label} — ${fn}` : label;
      setName(raw.length > 160 ? `${raw.slice(0, 159).trimEnd()}…` : raw);
    }
  }

  async function save() {
    if (saving || !emails || emails.length === 0) return;
    if (!name.trim()) { setError("Donne un nom à la séquence avant d'enregistrer."); return; }
    setSaving(true); setError(null); setNotice(null);
    const payload = {
      name: name.trim(),
      // Rétrocompat : `type` = rôle du 1er mail. La source de vérité devient `roles`.
      type: roles[0]?.id ?? "autre",
      roles,
      context: context || null, language, funnel_id: funnelId || null,
      emails: emails.map((e, i) => ({ position: i, delay_days: e.delayDays, delay_hours: e.delayHours, send_at: e.sendAt, subject: e.subject, content: e.body })),
    };
    try {
      const res = await fetch(editingId ? `/api/crm/sequences/${editingId}` : "/api/crm/sequences", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        // 🆕 Message plus utile : si la validation échoue, on nomme les champs.
        const fields = json.details && typeof json.details === "object"
          ? Object.keys(json.details).join(", ")
          : "";
        setError(
          json.error === "invalid_input" && fields
            ? `Champs invalides : ${fields}. Corrige puis réessaie.`
            : json.message || json.error || "Enregistrement impossible.",
        );
        return;
      }
      const s = json.sequence;
      setEditingId(s.id);
      // On récupère les ids d'emails (nécessaires pour l'envoi test).
      setEmails((s.emails as Array<{ id: string; delay_days: number; delay_hours?: number; send_at?: string | null; subject: string; content: string }>)
        .map((e, i) => ({ id: e.id, position: i, delayDays: e.delay_days, delayHours: e.delay_hours ?? 0, sendAt: e.send_at ?? null, subject: e.subject, body: e.content })));
      setNotice("Séquence enregistrée.");
      // 🆕 Micro-victoire : 1re séquence créée = jalon (confettis), une seule fois.
      if (!hasMilestone("first_sequence")) {
        celebrate({
          level: "l",
          once: "first_sequence",
          emoji: "✉️",
          title: "Ta première séquence email est prête !",
          message:
            "Tes emails partiront automatiquement, dans l'ordre et au bon moment. Il ne te reste qu'à y inscrire tes contacts.",
        });
      }
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
      setEditingId(s.id); setName(s.name);
      // Rétrocompat : séquences créées avant le Lot 1 → `roles` absent, on
      // retombe sur un rôle unique dérivé de l'ancien champ `type`.
      setRoles(Array.isArray(s.roles) && s.roles.length > 0 ? s.roles : [{ id: s.type }]);
      setContext(s.context ?? "");
      setLanguage(s.language as Lang); setFunnelId(s.funnel_id ?? "");
      setEmails((s.emails as Array<{ id: string; delay_days: number; delay_hours?: number; send_at?: string | null; subject: string; content: string }>)
        .map((e, i) => ({ id: e.id, position: i, delayDays: e.delay_days, delayHours: e.delay_hours ?? 0, sendAt: e.send_at ?? null, subject: e.subject, body: e.content })));
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
      return reindex([...list, { position: list.length, delayDays: lastDelay + 2, delayHours: 0, sendAt: null, subject: "", body: "" }]);
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
              className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)]">
              <FilePlus2 size={14} /> Nouvelle
            </button>
          </div>
          <div className="grid gap-2">
            {sequences.map((s) => (
              <div key={s.id}
                // 🆕 La ligne non sélectionnée n'avait AUCUN survol : rien
                // n'indiquait qu'elle était cliquable. On teinte la bordure à
                // l'or de marque (`--ff-accent`), jamais en blanc — sur le thème
                // sombre, un survol clair « éteint » la ligne au lieu de la
                // désigner. L'état SÉLECTIONNÉ garde le bleu de marque, pour
                // qu'on distingue « je survole » de « c'est ouvert ».
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${editingId === s.id ? "border-[#08498D] bg-[#08498D]/5" : "border-line bg-white hover:border-[color:var(--ff-accent)]"}`}>
                <button type="button" onClick={() => loadSequence(s.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-muted">
                    {TYPE_OPTIONS.find((t) => t.value === s.type)?.label ?? s.type} · {s.status}
                    {/* 🆕 LOT 3 — open/click rate (si la migration stats est en place) */}
                    {seqStats[s.id] && seqStats[s.id].sent > 0 && (
                      <>
                        {" · "}
                        {seqStats[s.id].sent} envoyés · {seqStats[s.id].opens} ouverts (
                        {Math.round((seqStats[s.id].opens / seqStats[s.id].sent) * 100)}
                        %) · {seqStats[s.id].clicks} clics
                      </>
                    )}
                  </div>
                </button>
                <button type="button" onClick={() => removeSequence(s.id)}
                  className="rounded-md border border-line p-1.5 text-red-500 hover:border-red-500/50 hover:bg-red-500/10">
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
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Tunnel rattaché {hasFunnels ? "(recommandé)" : ""}</span>
            <select className={inputCls} value={funnelId} onChange={(e) => setFunnelId(e.target.value)} disabled={!hasFunnels}>
              <option value="">{hasFunnels ? "Aucun (saisie manuelle)" : "Aucun tunnel publié"}</option>
              {publishedFunnels.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Langue {funnelId ? "(reprise du tunnel)" : ""}</span>
            <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value as Lang)} disabled={!!funnelId}>
              {LANG_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </label>
        </div>

        {/* 🆕 LOT 1 — Constructeur de séquence : chaque type ajouté = un mail.
            Le nombre de mails est déduit du nombre de types ajoutés, dans l'ordre. */}
        <div className="mt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Composition de la séquence ({roles.length} mail{roles.length > 1 ? "s" : ""})
          </span>
          <p className="mt-0.5 text-[11px] text-muted">
            Ajoute les types de mails dans l&apos;ordre où ils doivent être envoyés. Un type ajouté = un mail.
          </p>

          <div className="mt-2 grid gap-2">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-[#F8F9FB] p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-bold text-ink">{i + 1}</span>
                  <span className="truncate text-sm font-semibold text-ink">{roleLabel(r)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveRole(i, -1)} disabled={i === 0}
                    className="rounded-md border border-line p-1.5 text-muted hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)] disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => moveRole(i, 1)} disabled={i === roles.length - 1}
                    className="rounded-md border border-line p-1.5 text-muted hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)] disabled:opacity-30"><ChevronDown size={14} /></button>
                  <button type="button" onClick={() => removeRole(i)} disabled={roles.length <= 1}
                    className="rounded-md border border-line p-1.5 text-red-500 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select className={`${inputCls} max-w-[220px]`} value={pendingRoleType}
              onChange={(e) => setPendingRoleType(e.target.value as SequenceType)}>
              {ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
            {pendingRoleType === "autre" && (
              <input className={`${inputCls} max-w-[220px]`} value={pendingCustomLabel}
                onChange={(e) => setPendingCustomLabel(e.target.value)}
                placeholder="Nom du type personnalisé" />
            )}
            <button type="button" onClick={addRole}
              disabled={roles.length >= 10 || (pendingRoleType === "autre" && !pendingCustomLabel.trim())}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)] disabled:opacity-40">
              <Plus size={14} /> Ajouter un type
            </button>
          </div>
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
            {loading ? "Génération…" : emails ? "Tout régénérer" : "Générer avec l'IA"}
          </Button>
          {!emails && (
            <button type="button" onClick={startManual}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)]">
              <FilePlus2 size={15} /> Rédiger moi-même
            </button>
          )}
          {selectedFunnelName && (<span className="text-xs text-muted">Rattaché à : <strong className="text-ink">{selectedFunnelName}</strong></span>)}
        </div>
      </Card>

      {emails && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input className={`${inputCls} max-w-xs font-semibold`} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="Nom de la séquence" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={addEmail}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)]">
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
                    <button type="button" onClick={() => regenerateEmail(i)} disabled={regenIdx !== null}
                      title="Régénérer uniquement cet email avec l'IA"
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-ink hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)] disabled:opacity-40">
                      {regenIdx === i ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {regenIdx === i ? "…" : "Régénérer"}
                    </button>
                    {em.id && (
                      <button type="button" onClick={() => testSend(em.id!)} title="Envoyer un test"
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-ink hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)]">
                        <SendHorizonal size={13} /> Test
                      </button>
                    )}
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                      className="rounded-md border border-line p-1.5 text-muted hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)] disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === emails.length - 1}
                      className="rounded-md border border-line p-1.5 text-muted hover:border-[color:var(--ff-accent)] hover:bg-[color:var(--ff-accent-soft)] disabled:opacity-30"><ChevronDown size={14} /></button>
                    <button type="button" onClick={() => remove(i)}
                      className="rounded-md border border-line p-1.5 text-red-500 hover:border-red-500/50 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Objet</span>
                  <input className={inputCls} value={em.subject} onChange={(e) => updateEmail(i, { subject: e.target.value })} placeholder="Objet de l'email" />
                </label>

                {/* 🆕 Planification : délai relatif à l'inscription OU date/heure fixe */}
                <div className="mt-3 grid gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Quand l&apos;envoyer</span>
                  <div className="inline-flex w-fit rounded-lg border border-line bg-[#F8F9FB] p-0.5 text-xs font-semibold">
                    <button type="button" onClick={() => updateEmail(i, { sendAt: null })}
                      className={`rounded-md px-3 py-1.5 ${em.sendAt === null ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                      Délai relatif
                    </button>
                    <button type="button" onClick={() => updateEmail(i, { sendAt: em.sendAt ?? defaultFixedIso() })}
                      className={`rounded-md px-3 py-1.5 ${em.sendAt !== null ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                      Date fixe
                    </button>
                  </div>

                  {em.sendAt === null && i === replayImmediateEmailIndex ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                      <AlertCircle size={16} className="shrink-0" />
                      Envoyé immédiatement après inscription (mode replay)
                    </div>
                  ) : em.sendAt === null ? (
                    <div className="grid gap-3 sm:grid-cols-[130px_130px]">
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Délai (jours)</span>
                        <input type="number" min={0} max={365} className={inputCls} value={em.delayDays}
                          onChange={(e) => updateEmail(i, { delayDays: Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">+ heures</span>
                        <input type="number" min={0} max={23} className={inputCls} value={em.delayHours}
                          onChange={(e) => updateEmail(i, { delayHours: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })} />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      <input type="datetime-local" className={`${inputCls} w-fit`}
                        value={isoToLocalInput(em.sendAt)}
                        onChange={(e) => updateEmail(i, { sendAt: localInputToIso(e.target.value) })} />
                      <span className="text-[11px] text-muted">
                        Part à cette date/heure précise (ton fuseau), quel que soit le moment d&apos;inscription.
                        {em.sendAt && new Date(em.sendAt).getTime() <= Date.now() && (
                          <span className="text-amber-600"> Cette date est passée : un contact inscrit maintenant ne recevra pas cet email.</span>
                        )}
                      </span>
                    </div>
                  )}
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
