// components/leads/CustomFieldsSettings.tsx
// 🆕 MODULE 3 — Gestion des champs personnalisés des leads (lead_custom_field_defs) :
// liste, création, suppression. Ces champs sont ensuite utilisables dans le
// mapping d'import et dans le templating {{...}} des emails/séquences.
"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CustomFieldDef } from "@/lib/crm/types";

export function CustomFieldsSettings({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/crm/custom-fields");
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json.ok) setFields(json.fields);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createField() {
    const trimmed = label.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error === "field_already_exists" ? "Ce champ existe déjà." : "Création impossible.");
        return;
      }
      setFields((cur) => [...cur, json.field]);
      setLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function removeField(id: string) {
    if (!window.confirm("Supprimer ce champ personnalisé ? Les valeurs déjà enregistrées sur les leads seront conservées mais ne seront plus modifiables via ce champ.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/custom-fields/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFields((cur) => cur.filter((f) => f.id !== id));
      } else {
        alert("Suppression impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">Champs personnalisés</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs text-muted">
          Utilisables dans l&apos;import de leads et dans vos emails via{" "}
          <code className="rounded bg-canvas px-1 py-0.5">{"{{nom_du_champ}}"}</code>.
        </p>

        {error && (
          <p className="mb-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-xs text-red">{error}</p>
        )}

        <div className="mb-4 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createField();
              }
            }}
            placeholder="Ex. Ville, Entreprise, Budget…"
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-navy/50 focus:outline-none"
            disabled={busy}
          />
          <Button onClick={createField} disabled={busy || !label.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
        ) : fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-canvas px-3 py-6 text-center text-xs text-muted">
            Aucun champ personnalisé pour l&apos;instant.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto rounded-lg border border-line">
            {fields.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between border-b border-line/60 px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{f.label}</p>
                  <p className="text-[11px] text-muted">{"{{" + f.field_key + "}}"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeField(f.id)}
                  disabled={busy}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-50"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default CustomFieldsSettings;
