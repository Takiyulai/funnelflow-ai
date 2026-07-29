// components/admin/AdminUserDetailModal.tsx
// 🆕 MODULE 4 — Fiche détail d'un utilisateur.
//
// Trois niveaux de gravité, séparés visuellement pour qu'on ne clique jamais
// sur le mauvais :
//   1. ÉDITION      — plan et licence : réversible, un simple « Enregistrer ».
//   2. ASSISTANCE   — envoi du lien de réinitialisation : sans effet de bord
//                     sur les données, mais part par email → confirmation.
//   3. ZONE DANGER  — désactivation (réversible) et suppression définitive
//                     (irréversible, exige de retaper l'email exact).
"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Ban,
  CheckCircle2,
  KeyRound,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PLANS, PLAN_ORDER, isPlanId } from "@/lib/billing/plans";
import type { AdminUserDetail } from "@/lib/admin/users";

const LICENSE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expirée" },
  { value: "revoked", label: "Révoquée" },
  { value: "invalid", label: "Invalide" },
];

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Date du jour + N jours, au format attendu par <input type="date">. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AdminUserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const [plan, setPlan] = useState("starter");
  const [licenseStatus, setLicenseStatus] = useState("active");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");

  // 🆕 Suppression définitive : `deleteMode` ouvre la saisie de confirmation,
  // `deleteEmail` doit correspondre EXACTEMENT à l'email du compte.
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json.ok) {
          const d: AdminUserDetail = { user: json.user, license: json.license, profile: json.profile };
          setDetail(d);
          // Un plan historique hors énumération (texte libre de l'ancienne
          // version) ne doit pas casser le <select> : on retombe sur starter.
          setPlan(isPlanId(d.user.plan) ? d.user.plan : "starter");
          setLicenseStatus(d.license?.status ?? "active");
          setLicenseExpiresAt(toDateInputValue(d.license?.expires_at ?? null));
        } else {
          setError(json.error || "Utilisateur introuvable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          license_status: licenseStatus,
          license_expires_at: licenseExpiresAt ? new Date(licenseExpiresAt).toISOString() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error === "invalid_plan" ? "Plan inconnu." : json.error || "Enregistrement impossible.");
        return;
      }
      setDetail({ user: json.user, license: json.license, profile: json.profile });
      setNotice("Modifications enregistrées.");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(active: boolean) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || "Action impossible.");
        return;
      }
      setDetail((cur) => (cur ? { ...cur, user: { ...cur.user, is_active: active } } : cur));
      setNotice(active ? "Compte réactivé." : "Compte désactivé.");
      onChanged();
    } finally {
      setSaving(false);
      setConfirmingDeactivate(false);
    }
  }

  async function sendPasswordReset() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || "Envoi impossible.");
        return;
      }
      setNotice(`Lien de réinitialisation envoyé à ${json.email}.`);
    } finally {
      setSaving(false);
      setConfirmingReset(false);
    }
  }

  async function deleteAccount() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleteEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(
          json.error === "email_mismatch"
            ? "L'email saisi ne correspond pas à ce compte."
            : json.error === "cannot_delete_self"
              ? "Vous ne pouvez pas supprimer votre propre compte administrateur."
              : json.error || "Suppression impossible.",
        );
        return;
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const emailMatches =
    !!detail && deleteEmail.trim().toLowerCase() === detail.user.email.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">Fiche utilisateur</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" disabled={saving}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
        ) : !detail ? (
          <p className="text-sm text-danger-ink">{error || "Introuvable."}</p>
        ) : (
          <div className="grid gap-4">
            <div>
              <p className="font-semibold text-ink">{detail.user.full_name || "—"}</p>
              <p className="text-sm text-muted">{detail.user.email}</p>
              <p className="mt-1 text-xs text-muted">
                Inscrit le {new Date(detail.user.created_at).toLocaleDateString("fr-FR")} · Dernière connexion{" "}
                {detail.user.last_login_at
                  ? new Date(detail.user.last_login_at).toLocaleString("fr-FR")
                  : "jamais"}
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger-ink">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg border border-success bg-success-soft px-3 py-2 text-xs text-success-ink">
                {notice}
              </p>
            )}

            {/* ── 1. Plan et licence ───────────────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Plan</span>
                {/* Liste fermée et non saisie libre : le plan pilote tous les
                    quotas (lib/billing/plans.ts). Une valeur hors énumération
                    laissait le compte sans limites reconnues. */}
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {PLAN_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {PLANS[id].name} — {PLANS[id].priceEur} €/mois
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Statut de licence</span>
                <select
                  value={licenseStatus}
                  onChange={(e) => setLicenseStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {LICENSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase text-muted">Expiration de la licence</span>
                <input
                  type="date"
                  value={licenseExpiresAt}
                  onChange={(e) => setLicenseExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                {/* Raccourcis : accorder un accès sans avoir à compter les jours
                    dans un calendrier — le geste le plus fréquent en support
                    (offrir un mois, prolonger un an, débloquer à vie). */}
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "+ 7 jours", value: inDays(7) },
                    { label: "+ 30 jours", value: inDays(30) },
                    { label: "+ 1 an", value: inDays(365) },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setLicenseExpiresAt(s.value);
                        setLicenseStatus("active");
                      }}
                      className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-accent hover:text-ink"
                    >
                      {s.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setLicenseExpiresAt("");
                      setLicenseStatus("active");
                    }}
                    className="rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-ink"
                  >
                    Sans expiration
                  </button>
                </span>
                <span className="mt-1.5 block text-[11px] text-muted">
                  Une date vide signifie « accès illimité ». Les raccourcis
                  repassent aussi la licence en « Active ».
                </span>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Fermer
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>

            {/* ── 2. Assistance ────────────────────────────────────────── */}
            <div className="border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Assistance</p>
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                disabled={saving}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                Envoyer un lien de réinitialisation
              </button>
              <p className="mt-1.5 text-[11px] text-muted">
                L&apos;utilisateur reçoit le même email que via « mot de passe
                oublié ». Vous ne voyez ni ne choisissez son mot de passe.
              </p>
            </div>

            {/* ── 3. Zone danger ───────────────────────────────────────── */}
            <div className="rounded-xl border border-danger bg-danger-soft p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-danger-ink">
                <AlertTriangle size={13} /> Zone danger
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                {detail.user.is_active ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeactivate(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-danger bg-surface px-3 py-2 text-sm font-semibold text-danger-ink transition hover:border-danger disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" />
                    Désactiver le compte
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleActive(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-success bg-surface px-3 py-2 text-sm font-semibold text-success-ink transition hover:opacity-80 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Réactiver le compte
                  </button>
                )}
                <span className="text-[11px] text-muted">Réversible à tout moment.</span>
              </div>

              <div className="mt-4 border-t border-line pt-3">
                {!deleteMode ? (
                  <button
                    type="button"
                    onClick={() => setDeleteMode(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger-ink underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer définitivement ce compte
                  </button>
                ) : (
                  <div>
                    <p className="text-xs leading-relaxed text-ink">
                      <strong>Cette action est irréversible.</strong> Le compte,
                      ses tunnels, ses contacts et ses automatisations seront
                      supprimés. Pour confirmer, retapez{" "}
                      <span className="font-mono font-bold">{detail.user.email}</span>.
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        autoFocus
                        value={deleteEmail}
                        onChange={(e) => setDeleteEmail(e.target.value)}
                        placeholder={detail.user.email}
                        autoComplete="off"
                        className="min-w-0 flex-1 rounded-lg border border-danger bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-danger"
                      />
                      <button
                        type="button"
                        onClick={deleteAccount}
                        disabled={saving || !emailMatches}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Supprimer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteMode(false);
                          setDeleteEmail("");
                        }}
                        disabled={saving}
                        className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDeactivate}
        title="Désactiver ce compte ?"
        description="L'utilisateur ne pourra plus se connecter tant qu'un administrateur ne réactive pas son compte. Cette action est réversible."
        confirmLabel="Désactiver"
        tone="danger"
        onConfirm={() => toggleActive(false)}
        onCancel={() => setConfirmingDeactivate(false)}
      />

      <ConfirmDialog
        open={confirmingReset}
        title="Envoyer le lien de réinitialisation ?"
        description={
          detail
            ? `Un email sera envoyé à ${detail.user.email} avec un lien permettant de définir un nouveau mot de passe.`
            : ""
        }
        confirmLabel="Envoyer"
        onConfirm={sendPasswordReset}
        onCancel={() => setConfirmingReset(false)}
      />
    </div>
  );
}

export default AdminUserDetailModal;
