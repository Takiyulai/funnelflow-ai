"use client";

// components/booking/NewBookingTypeDialog.tsx
//
// 🆕 Création d'un type de rendez-vous à partir d'un préréglage métier.
//
// ── POURQUOI UN SEUL ÉCRAN, ET PAS UN WIZARD ────────────────────────────────
// La tentation était un parcours par étapes avec barre de progression. Deux
// raisons de ne pas le faire :
//
// 1. Pour quatre champs, un wizard est plus LENT qu'un formulaire. La barre de
//    progression donne une sensation d'avancement, mais elle ajoute des clics
//    et un sentiment d'effort. Un wizard se justifie au-delà de huit champs,
//    ou quand une étape dépend de la précédente. Ni l'un ni l'autre ici.
//
// 2. La création était instantanée (un clic, le type existe, on affine
//    ensuite). Mettre cinq écrans AVANT d'avoir quoi que ce soit inverse ce
//    rapport : l'utilisateur investit avant de voir un résultat, et c'est là
//    qu'on abandonne.
//
// Le préréglage n'enferme dans rien : tout reste modifiable après création,
// dans les onglets qui sont faits pour ça.

import { useState } from "react";
import { X, Loader2, Clock, MapPin, ListChecks } from "lucide-react";
import { BOOKING_PRESETS, type BookingPreset } from "@/lib/booking/presets";

export function NewBookingTypeDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (preset: BookingPreset, name: string, durationMin: number) => void;
}) {
  const [presetId, setPresetId] = useState<string>(BOOKING_PRESETS[0].id);
  const [name, setName] = useState<string>(BOOKING_PRESETS[0].defaultName);
  const [duration, setDuration] = useState<number>(BOOKING_PRESETS[0].durationMin);

  if (!open) return null;

  const preset =
    BOOKING_PRESETS.find((p) => p.id === presetId) ?? BOOKING_PRESETS[0];

  // Choisir un préréglage réécrit nom et durée : ce sont ses valeurs, et
  // l'utilisateur vient justement de dire qu'il les veut. S'il avait
  // personnalisé le nom, il le refait — c'est deux secondes, contre la
  // confusion d'un « Audit stratégique » de 15 minutes.
  const selectPreset = (p: BookingPreset) => {
    setPresetId(p.id);
    setName(p.defaultName);
    setDuration(p.durationMin);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ff-new-type-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="ff-new-type-title" className="text-lg font-bold text-ink">
              Nouveau type de rendez-vous
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Choisis un point de départ. Tout reste modifiable ensuite.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="shrink-0 rounded-lg border border-line p-1.5 text-muted transition hover:text-ink disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Préréglages ── */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {BOOKING_PRESETS.map((p) => {
            const selected = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p)}
                aria-pressed={selected}
                className={
                  "rounded-xl border p-3 text-left transition " +
                  (selected
                    ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-inset ring-violet-500/30"
                    : "border-line bg-canvas hover:border-violet-500/40")
                }
              >
                <span className="block text-sm font-semibold text-ink">{p.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                  {p.hint}
                </span>
                {/* Ce que le préréglage change réellement — sinon les cartes
                    ne seraient que des noms, exactement le reproche de départ. */}
                <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> {p.durationMin} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ListChecks size={11} /> {p.formFields.length} champs
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} />
                    {p.locationKind === "visio" ? "Visio" : p.locationKind}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Deux champs, pas davantage ── */}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Nom affiché au prospect
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Durée (min)
            </label>
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(e) =>
                setDuration(Math.max(5, Math.min(480, Number(e.target.value) || 30)))
              }
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <p className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] leading-relaxed text-muted">
          Des disponibilités par défaut sont créées (lundi à vendredi,
          9h–12h et 14h–17h) pour que ton lien affiche des créneaux
          immédiatement. Ajuste-les dans l&apos;onglet Disponibilités.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onCreate(preset, name.trim() || preset.defaultName, duration)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
            Créer le type
          </button>
        </div>
      </div>
    </div>
  );
}
