// components/admin/AdminUserDetailModal.tsx
// 🆕 MODULE 4 — Fiche détail d'un utilisateur : édition du plan et du statut
// de licence (action NON destructive), et activation/désactivation du compte
// (action DESTRUCTIVE — confirmation obligatoire via ConfirmDialog).
"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const [plan, setPlan] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("active");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");

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
          setPlan(d.user.plan);
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
        setError(json.error || "Enregistrement impossible.");
        return;
      }
      setDetail({ user: json.user, license: json.license, profile: json.profile });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(active: boolean) {
    setSaving(true);
    setError(null);
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
      onChanged();
    } finally {
      setSaving(false);
      setConfirmingDeactivate(false);
    }
  }

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
          <p className="text-sm text-red">{error || "Introuvable."}</p>
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
              <p className="rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-xs text-red">{error}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Plan</span>
                <input
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-navy/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Statut de licence</span>
                <select
                  value={licenseStatus}
                  onChange={(e) => setLicenseStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-navy/50 focus:outline-none"
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
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-navy/50 focus:outline-none"
                />
              </label>
            </div>

            {/* 📱 Responsive : colonne sur mobile (le bouton de désactivation +
                les 2 boutons d'action débordaient), ligne dès sm. */}
            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              {detail.user.is_active ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDeactivate(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red/40 px-3 py-2 text-sm font-semibold text-red hover:bg-red/5 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" />
                  Désactiver le compte
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleActive(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green/40 px-3 py-2 text-sm font-semibold text-green hover:bg-green/5 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Réactiver le compte
                </button>
              )}

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button variant="secondary" onClick={onClose} disabled={saving}>
                  Fermer
                </Button>
                <Button onClick={save} disabled={saving || !plan.trim()}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
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
    </div>
  );
}

export default AdminUserDetailModal;
