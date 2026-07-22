"use client";

// components/account/DeleteAccountSection.tsx
//
// 🆕 RGPD (audit #2) — Zone de danger : suppression DÉFINITIVE du compte et de
// toutes les données. Double garde-fou : modale + saisie du mot « SUPPRIMER ».
// Appelle POST /api/account/delete puis renvoie vers l'accueil.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Loader2, X } from "lucide-react";

const CONFIRM_WORD = "SUPPRIMER";

export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText.trim() !== CONFIRM_WORD || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || "La suppression a échoué. Réessaie ou contacte le support.");
        setBusy(false);
        return;
      }
      // Compte supprimé → on quitte l'espace connecté.
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Connexion impossible. Réessaie.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 max-w-5xl">
      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-100 text-red-600">
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-red-800">Supprimer mon compte</h2>
            <p className="mt-1 text-sm text-red-700/80">
              Efface définitivement ton compte et toutes tes données (tunnels, leads, campagnes,
              séquences, médias…). Cette action est <strong>irréversible</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setConfirmText("");
                setError(null);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white"
            >
              <Trash2 size={14} /> Supprimer mon compte
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-ink">Confirmer la suppression</h3>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Fermer"
                className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-muted">
              Toutes tes données seront définitivement effacées. Pour confirmer, écris{" "}
              <strong className="text-ink">{CONFIRM_WORD}</strong> ci-dessous.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              disabled={busy}
              className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-red-400 disabled:opacity-60"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy || confirmText.trim() !== CONFIRM_WORD}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeleteAccountSection;
