"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Send, Save, AlertCircle, Eye, Pencil, Clock, FileText, Sparkles, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Campaign, CampaignStatus, CampaignSummary, LeadStatus } from "@/lib/crm/types";

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
  initialCampaigns: CampaignSummary[];
  contactsCount: number;
  resendReady: boolean;
  /** 🆕 LOT 3 — Ouvertures/clics par campagne (messages distincts). */
  campaignStats?: Record<string, { opens: number; clicks: number }>;
  /** 🆕 Tags CRM, pour cibler l'audience d'une campagne par tag (ex. « inscrits
   *  webinaire X ») plutôt que seulement par statut ou par « tous ». */
  tags?: { id: string; name: string }[];
  /** Listes CRM, disponibles comme audience au même titre que les tags. */
  lists?: { id: string; name: string; contactsCount: number }[];
};

export function CampaignsClient({
  initialCampaigns,
  contactsCount,
  resendReady,
  campaignStats = {},
  tags = [],
  lists = [],
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [startMode, setStartMode] = useState<"blank" | "ai">("blank");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [viewing, setViewing] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ subject: "", content: "" });
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);
  // 🆕 Mode d'envoi : maintenant ou programmé (date/heure).
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("campaign");
    const campaign = requested ? initialCampaigns.find((item) => item.id === requested) : null;
    if (campaign) void loadCampaign(campaign, "config");
    // Le paramètre est uniquement un point d'entrée au retour de l'éditeur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        router.push(`/emails/campaigns/${json.campaign.id}/edit${startMode === "ai" ? "?start=ai" : ""}`);
        router.refresh();
      } else {
        alert(json.error || "Création impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  function openEditor(c: CampaignSummary | Campaign) {
    router.push(`/emails/campaigns/${c.id}/edit`);
  }

  async function loadCampaign(c: CampaignSummary | Campaign, target: "config" | "view") {
    setBusy(true);
    try {
      const response = await fetch(`/api/crm/campaigns/${c.id}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Chargement impossible");
      const full = json.campaign as Campaign;
      if (target === "view") {
        setViewing(full);
        return;
      }
      setEditing(full);
      setForm({ subject: full.subject, content: full.content });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Chargement impossible");
      return;
    } finally {
      setBusy(false);
    }
    setAudience("all");
    setSendMode("now");
    setScheduledAt(defaultScheduleValue());
  }

  function audiencePayload() {
    if (audience === "all") return { type: "all" as const };
    if (audience.startsWith("tag:")) {
      return { type: "tag" as const, tagId: audience.slice(4) };
    }
    if (audience.startsWith("list:")) {
      return { type: "list" as const, listId: audience.slice(5) };
    }
    return { type: "status" as const, status: audience as LeadStatus };
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
          list_not_found: "Cette liste n’existe plus ou n’est plus accessible.",
          invalid_audience: "Le ciblage choisi n’est pas valide.",
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
      const res = await fetch(`/api/crm/campaigns/${editing.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: audiencePayload() }),
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
          list_not_found: "Cette liste n’existe plus ou n’est plus accessible.",
          invalid_audience: "Le ciblage choisi n’est pas valide.",
        };
        alert(map[json.error] || json.error || "Envoi impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-ink sm:text-3xl">Campagnes</h1>
          <p className="mt-2 text-sm text-muted">
            Envoyez des emails à vos {contactsCount} contact{contactsCount > 1 ? "s" : ""} via Resend.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">
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

      {/* Bureau : tableau dense. Mobile : cartes lisibles sans largeur minimale
          cachée, donc sans déborder horizontalement comme l'ancien tableau. */}
      <Card className="hidden overflow-hidden p-0 md:block">
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
                      onClick={() => void loadCampaign(c, "view")}
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
                    <button
                      type="button"
                      onClick={() => void loadCampaign(c, "config")}
                      title="Configurer l’audience et l’envoi"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
                    >
                      <Settings2 className="h-4 w-4 text-muted" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid min-w-0 gap-3 md:hidden">
        {initialCampaigns.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            Aucune campagne. Crée ta première campagne email.
          </Card>
        )}
        {initialCampaigns.map((campaign) => {
          const stats = campaignStats[campaign.id];
          return (
            <Card key={campaign.id} className="min-w-0 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-bold text-ink">{campaign.name}</h2>
                  <p className="mt-1 line-clamp-2 break-words text-sm text-muted">
                    {campaign.subject || <em className="opacity-60">objet à définir</em>}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: `${STATUS_COLOR[campaign.status]}1A`,
                    color: STATUS_COLOR[campaign.status],
                  }}
                >
                  {STATUS_LABEL[campaign.status]}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="Destinataires" value={String(campaign.recipients_count || "—")} />
                <Stat
                  label="Résultat"
                  value={
                    campaign.sent_count > 0 || campaign.failed_count > 0
                      ? `${campaign.sent_count} envoyé${campaign.sent_count > 1 ? "s" : ""}`
                      : "—"
                  }
                />
                <div className="col-span-2">
                  <Stat
                    label="Date"
                    value={
                      campaign.status === "scheduled"
                        ? fmtDate(campaign.scheduled_at)
                        : fmtDate(campaign.sent_at)
                    }
                  />
                </div>
              </div>
              {stats && campaign.sent_count > 0 && (
                <p className="mt-3 text-xs text-muted">
                  {stats.opens} ouvert{stats.opens > 1 ? "s" : ""} · {stats.clicks} clic
                  {stats.clicks > 1 ? "s" : ""}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2 border-t border-line/70 pt-3">
                <Button variant="secondary" size="sm" onClick={() => void loadCampaign(campaign, "view")}>
                  <Eye className="h-4 w-4" /> Voir
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openEditor(campaign)}>
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
                <Button size="sm" onClick={() => void loadCampaign(campaign, "config")}>
                  <Send className="h-4 w-4" /> Envoyer
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal création */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setCreating(false)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
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
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setStartMode("blank")} className={`rounded-xl border p-4 text-left transition ${startMode === "blank" ? "border-[color:var(--ff-accent)] bg-[color:var(--ff-accent-soft)]" : "border-line bg-canvas"}`}>
                <FileText className="h-5 w-5 text-[color:var(--ff-accent)]" />
                <div className="mt-2 text-sm font-black text-ink">Partir de zéro</div>
                <div className="mt-1 text-xs text-muted">Commence avec un canvas vide.</div>
              </button>
              <button type="button" onClick={() => setStartMode("ai")} className={`rounded-xl border p-4 text-left transition ${startMode === "ai" ? "border-[color:var(--ff-accent)] bg-[color:var(--ff-accent-soft)]" : "border-line bg-canvas"}`}>
                <Sparkles className="h-5 w-5 text-[color:var(--ff-accent)]" />
                <div className="mt-2 text-sm font-black text-ink">Générer avec l’IA</div>
                <div className="mt-1 text-xs text-muted">L’assistant s’ouvre dans l’éditeur.</div>
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Annuler</Button>
              <Button onClick={createCampaign} disabled={busy || !newName.trim()}>Créer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration de l'envoi — l'édition du contenu vit sur une page dédiée. */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setEditing(null)}>
          <div className="max-h-[90dvh] w-full min-w-0 max-w-2xl overflow-y-auto rounded-2xl bg-surface p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
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
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-ink">Contenu de l’email</div>
                  <p className="mt-1 text-xs text-muted">Le contenu se modifie dans l’espace d’édition plein écran.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEditor(editing)}><Pencil className="h-4 w-4" /> Ouvrir l’éditeur</Button>
              </div>
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
                  {tags.length > 0 && (
                    <optgroup label="Par tag">
                      {tags.map((t) => (
                        <option key={t.id} value={`tag:${t.id}`}>
                          Tag : {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {lists.length > 0 && (
                    <optgroup label="Par liste">
                      {lists.map((list) => (
                        <option key={list.id} value={`list:${list.id}`}>
                          Liste : {list.name} ({list.contactsCount})
                        </option>
                      ))}
                    </optgroup>
                  )}
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
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
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
            <iframe
              title={`Aperçu de ${viewing.name}`}
              sandbox=""
              srcDoc={viewing.content || "<!doctype html><html><body><em>Vide</em></body></html>"}
              className="h-[420px] w-full rounded-lg border border-line bg-white"
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
