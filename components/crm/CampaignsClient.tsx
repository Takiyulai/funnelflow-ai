"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Send, Save, AlertCircle, Eye, Pencil, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmailRichEditor } from "@/components/crm/EmailRichEditor";
import type { Campaign, CampaignStatus, LeadStatus } from "@/lib/crm/types";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="text-[11px] uppercase tracking-wider font-bold text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  sending: "Envoi…",
  sent: "Envoyée",
  failed: "Échec",
};

const STATUS_COLOR: Record<CampaignStatus, string> = {
  draft: "#6B7280",
  scheduled: "#08498D",
  sending: "#C7A436",
  sent: "#31845C",
  failed: "#DC2626",
};

/** Formate une Date en valeur `datetime-local` (heure LOCALE, sans fuseau). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Valeur par défaut du picker : maintenant + 15 min (format local). */
function defaultScheduleValue(): string {
  return toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000));
}

/** Borne MIN du picker : maintenant (permet de programmer dans l'heure). */
function minScheduleValue(): string {
  return toLocalInputValue(new Date());
}

const AUDIENCES: { value: string; label: string }[] = [
  { value: "all", label: "Tous les contacts" },
  { value: "nouveau", label: "Statut : Nouveau" },
  { value: "contacte", label: "Statut : Contacté" },
  { value: "qualifie", label: "Statut : Qualifié" },
  { value: "client", label: "Statut : Client" },
  { value: "perdu", label: "Statut : Perdu" },
];

type Props = {
  initialCampaigns: Campaign[];
  contactsCount: number;
  resendReady: boolean;
  /** 🆕 LOT 3 — Ouvertures/clics par campagne (messages distincts). */
  campaignStats?: Record<string, { opens: number; clicks: number }>;
};

export function CampaignsClient({
  initialCampaigns,
  contactsCount,
  resendReady,
  campaignStats = {},
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [viewing, setViewing] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ subject: "", content: "" });
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);
  // 🆕 Mode d'envoi : maintenant ou programmé (date/heure).
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  async function createCampaign() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/crm/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setCreating(false);
        setNewName("");
        openEditor(json.campaign);
        router.refresh();
      } else {
        alert(json.error || "Création impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  function openEditor(c: Campaign) {
    setEditing(c);
    setForm({ subject: c.subject, content: c.content });
    setAudience("all");
    setSendMode("now");
    setScheduledAt(defaultScheduleValue());
  }

  function audiencePayload() {
    return audience === "all"
      ? { type: "all" as const }
      : { type: "status" as const, status: audience as LeadStatus };
  }

  // 🆕 Programme la campagne à la date choisie (file scheduled_emails + cron).
  async function scheduleCampaign() {
    if (!editing || busy) return;
    if (!form.subject.trim()) {
      alert("Renseigne un objet avant de programmer.");
      return;
    }
    if (!scheduledAt) {
      alert("Choisis une date et une heure d'envoi.");
      return;
    }
    // datetime-local est en heure LOCALE → on convertit en ISO (UTC) pour l'API.
    const iso = new Date(scheduledAt).toISOString();
    if (new Date(iso).getTime() < Date.now() - 60_000) {
      alert("La date d'envoi doit être dans le futur.");
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/crm/campaigns/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const res = await fetch(`/api/crm/campaigns/${editing.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: audiencePayload(), scheduledAt: iso }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        alert(
          `Campagne programmée pour ${fmtDate(json.scheduledAt)} · ${json.scheduled} email(s) en file. 📅`,
        );
        setEditing(null);
        router.refresh();
      } else {
        const map: Record<string, string> = {
          no_recipients: "Aucun destinataire pour ce ciblage.",
          subject_required: "Objet requis.",
          date_in_past: "La date d'envoi doit être dans le futur.",
          invalid_date: "Date invalide.",
          scheduledAt_required: "Choisis une date d'envoi.",
        };
        alert(map[json.error] || json.error || "Programmation impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/campaigns/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setEditing(json.campaign);
        router.refresh();
      } else {
        alert(json.error || "Enregistrement impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!editing || busy) return;
    if (!form.subject.trim()) {
      alert("Renseigne un objet avant d'envoyer.");
      return;
    }
    if (!window.confirm("Envoyer cette campagne maintenant ?")) return;
    setBusy(true);
    try {
      // On enregistre d'abord les dernières modifications.
      await fetch(`/api/crm/campaigns/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const aud =
        audience === "all"
          ? { type: "all" }
          : { type: "status", status: audience as LeadStatus };
      const res = await fetch(`/api/crm/campaigns/${editing.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: aud }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        if (json.failed > 0) {
          alert(
            `Envoyé : ${json.sent}/${json.total} · Échecs : ${json.failed}.\n\n` +
              `Raison Resend : ${json.error || "inconnue"}\n\n` +
              `Astuce : un expéditeur @gmail.com n'est PAS accepté par Resend. ` +
              `Configure RESEND_FROM_EMAIL (ex. noreply@tondomaine.com) et RESEND_FROM_NAME, ` +
              `avec un domaine vérifié dans Resend (ou onboarding@resend.dev en test, qui ne livre qu'à l'email de ton compte Resend).`,
          );
        } else {
          alert(`Campagne envoyée : ${json.sent} réussi(s) sur ${json.total}. ✅`);
        }
        setEditing(null);
        router.refresh();
      } else {
        const map: Record<string, string> = {
          resend_not_configured: "Resend non configuré (RESEND_API_KEY manquante).",
          no_recipients: "Aucun destinataire pour ce ciblage.",
          subject_required: "Objet requis.",
        };
        alert(map[json.error] || json.error || "Envoi impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink">Campagnes</h1>
          <p className="mt-2 text-sm text-muted">
            Envoyez des emails à vos {contactsCount} contact{contactsCount > 1 ? "s" : ""} via Resend.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </Button>
      </div>

      {!resendReady && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Resend n&apos;est pas configuré : ajoute <code className="mx-1 font-mono">RESEND_API_KEY</code> (et <code className="mx-1 font-mono">RESEND_FROM_EMAIL</code> / <code className="mx-1 font-mono">RESEND_FROM_NAME</code> avec un domaine vérifié) dans <code className="ml-1 font-mono">.env.local</code>.
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
              <th className="px-4 py-3 font-bold">Campagne</th>
              <th className="px-4 py-3 font-bold">Objet</th>
              <th className="px-4 py-3 font-bold">Statut</th>
              <th className="px-4 py-3 font-bold">Dest.</th>
              <th className="px-4 py-3 font-bold">Résultat</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialCampaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Aucune campagne. Crée ta première campagne email.
                </td>
              </tr>
            )}
            {initialCampaigns.map((c) => (
              <tr key={c.id} className="border-b border-line/60 hover:bg-[#F8F9FB]">
                <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                <td className="px-4 py-3 text-muted max-w-[220px] truncate">
                  {c.subject || <em className="opacity-60">objet à définir</em>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: `${STATUS_COLOR[c.status]}1A`, color: STATUS_COLOR[c.status] }}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">{c.recipients_count || "—"}</td>
                <td className="px-4 py-3">
                  {c.sent_count > 0 || c.failed_count > 0 ? (
                    <span>
                      <span style={{ color: "#31845C" }}>{c.sent_count} envoyés</span>
                      {c.failed_count > 0 && (
                        <span style={{ color: "#DC2626" }}> · {c.failed_count} échecs</span>
                      )}
                      {/* 🆕 LOT 3 — open/click rate (si la migration stats est en place) */}
                      {campaignStats[c.id] && c.sent_count > 0 && (
                        <span className="text-muted">
                          {" · "}
                          {campaignStats[c.id].opens} ouverts (
                          {Math.round((campaignStats[c.id].opens / c.sent_count) * 100)}
                          %) · {campaignStats[c.id].clicks} clics
                        </span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {c.status === "scheduled"
                    ? `⏳ ${fmtDate(c.scheduled_at)}`
                    : fmtDate(c.sent_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      title="Voir le détail"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
                    >
                      <Eye className="h-4 w-4 text-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(c)}
                      title={c.status === "sent" ? "Modifier / Renvoyer" : "Modifier / Envoyer"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
                    >
                      <Pencil className="h-4 w-4 text-muted" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal création */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setCreating(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">Nouvelle campagne</h2>
              <button type="button" onClick={() => setCreating(false)} className="text-muted hover:text-ink"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text"
              placeholder="Nom interne (ex. Relance ebook)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Annuler</Button>
              <Button onClick={createCampaign} disabled={busy || !newName.trim()}>Créer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Éditeur / envoi */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">{editing.name}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-muted hover:text-ink"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Objet de l&apos;email</span>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ex. Votre accès est prêt 🎉"
                  className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Contenu — variables {"{{prenom}}"}, {"{{email}}"} utilisables dans le texte</span>
                <EmailRichEditor
                  value={form.content}
                  onChange={(html) => setForm({ ...form, content: html })}
                  placeholder="Bonjour {{prenom}}, merci pour votre confiance…"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Destinataires</span>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-[#08498D]"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>

              {/* 🆕 Mode d'envoi : maintenant ou programmé */}
              <div className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Envoi</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMode("now")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      sendMode === "now"
                        ? "border-[#08498D] bg-[#08498D]/10 text-[#08498D]"
                        : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    Envoyer maintenant
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("schedule")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      sendMode === "schedule"
                        ? "border-[#08498D] bg-[#08498D]/10 text-[#08498D]"
                        : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    Programmer
                  </button>
                  {sendMode === "schedule" && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      min={minScheduleValue()}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-[#08498D]"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={save} disabled={busy}>
                <Save className="h-4 w-4" /> Enregistrer
              </Button>
              {sendMode === "schedule" ? (
                <Button onClick={scheduleCampaign} disabled={busy || !resendReady}>
                  <Clock className="h-4 w-4" /> {busy ? "Programmation…" : "Programmer l'envoi"}
                </Button>
              ) : (
                <Button onClick={send} disabled={busy || !resendReady}>
                  <Send className="h-4 w-4" /> {busy ? "Envoi…" : "Envoyer maintenant"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vue détail (lecture seule) */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">{viewing.name}</h2>
              <button type="button" onClick={() => setViewing(null)} className="text-muted hover:text-ink"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Statut" value={STATUS_LABEL[viewing.status]} />
              <Stat label="Destinataires" value={String(viewing.recipients_count || 0)} />
              <Stat label="Envoyés" value={String(viewing.sent_count)} />
              <Stat label="Échecs" value={String(viewing.failed_count)} />
            </div>
            {/* 🆕 LOT 3 — Taux d'ouverture / de clic (messages distincts) */}
            {campaignStats[viewing.id] && viewing.sent_count > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <Stat
                  label="Ouvertures"
                  value={`${campaignStats[viewing.id].opens} (${Math.round(
                    (campaignStats[viewing.id].opens / viewing.sent_count) * 100,
                  )} %)`}
                />
                <Stat
                  label="Clics"
                  value={`${campaignStats[viewing.id].clicks} (${Math.round(
                    (campaignStats[viewing.id].clicks / viewing.sent_count) * 100,
                  )} %)`}
                />
              </div>
            )}
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Envoyée le</div>
            <div className="mb-4 text-sm text-ink">{fmtDate(viewing.sent_at)}</div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Objet</div>
            <div className="mb-4 text-sm font-medium text-ink">{viewing.subject || "—"}</div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Contenu</div>
            <div
              className="rounded-lg border border-line bg-[#FAFAFA] p-4 text-sm text-ink"
              dangerouslySetInnerHTML={{ __html: viewing.content || "<em>Vide</em>" }}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setViewing(null)}>Fermer</Button>
              <Button
                onClick={() => {
                  const c = viewing;
                  setViewing(null);
                  openEditor(c);
                }}
              >
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
