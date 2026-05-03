// components/ui/ConfirmDialog.tsx
"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "neutral",
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const danger = tone === "danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 animate-[fadeIn_0.15s_ease-out]"
    >
      <div className="w-full max-w-sm rounded-xl border border-line bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-start gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                danger ? "bg-red/10 text-red" : "bg-softBlue text-navy"
              }`}
            >
              <AlertTriangle size={16} />
            </span>
            <div className="min-w-0">
              <h3 id="confirm-title" className="text-base font-black text-ink">
                {title}
              </h3>
              {description && (
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-canvas"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3 rounded-b-xl">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
