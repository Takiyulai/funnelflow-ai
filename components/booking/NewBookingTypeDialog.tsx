"use client";

// components/booking/NewBookingTypeDialog.tsx
//
// 🆕 Création d'un type de rendez-vous — parcours en 3 étapes.
//
// ── POURQUOI UN WIZARD ICI, ET PAS AILLEURS ─────────────────────────────────
// Un parcours par étapes ne se justifie que si une étape DÉPEND de la
// précédente. C'est le cas : le mode choisi à l'étape 1 change la nature de
// l'étape 2.
//
//   • consultation / recurring → tu définis une DURÉE, le client choisit son
//     créneau dans tes disponibilités ;
//   • event                    → tu publies des DATES, avec un nombre de places.
//
// Ce ne sont pas les mêmes questions. Les poser toutes sur un écran unique
// obligerait à en masquer la moitié selon un choix fait plus haut — ce qui est
// un wizard, mais mal fait.
//
// En revanche on reste à 3 étapes, pas 6 : au-delà, on remplace une création
// instantanée par une corvée, et c'est là qu'on abandonne.

import { useState } from "react";
import {
  X,
  Loader2,
  Clock,
  MapPin,
  ListChecks,
  Users,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { BOOKING_PRESETS, type BookingPreset } from "@/lib/booking/presets";
import { usesFixedSessions, isGroupMode } from "@/lib/booking/types";

/** Séance saisie dans le wizard (mode `event`). */
export type DraftSession = { day: string; time: string; durationMin: number };

export interface NewTypePayload {
  preset: BookingPreset;
  name: string;
  durationMin: number;
  capacity?: number;
  sessions?: DraftSession[];
}

const STEPS = ["Format", "Planning", "Formulaire"] as const;

export function NewBookingTypeDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: NewTypePayload) => void;
}) {
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState<string>(BOOKING_PRESETS[0].id);
  const [name, setName] = useState<string>(BOOKING_PRESETS[0].defaultName);
  const [duration, setDuration] = useState<number>(BOOKING_PRESETS[0].durationMin);
  const [capacity, setCapacity] = useState<number>(30);
  const [sessions, setSessions] = useState<DraftSession[]>([]);

  if (!open) return null;

  const preset =
    BOOKING_PRESETS.find((p) => p.id === presetId) ?? BOOKING_PRESETS[0];
  const isEvent = usesFixedSessions(preset.mode);
  const isGroup = isGroupMode(preset.mode);

  const selectPreset = (p: BookingPreset) => {
    setPresetId(p.id);
    setName(p.defaultName);
    setDuration(p.durationMin);
    if (p.capacity) setCapacity(p.capacity);
  };

  const addSession = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setSessions((prev) => [
      ...prev,
      { day: d.toISOString().slice(0, 10), time: "09:00", durationMin: duration },
    ]);
  };

  // Une séance sans date est inexploitable ; un atelier sans aucune séance
  // n'afficherait rien au public. On bloque plutôt que de créer un type mort.
  const canContinue =
    step === 0
      ? true
      : step === 1
        ? isEvent
          ? sessions.length > 0
          : duration >= 5
        : name.trim().length > 0;

  const reset = () => {
    setStep(0);
    setSessions([]);
  };

  const submit = () => {
    onCreate({
      preset,
      name: name.trim() || preset.defaultName,
      durationMin: duration,
      capacity: isGroup ? capacity : undefined,
      sessions: isEvent ? sessions : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          reset();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        {/* ── En-tête + progression ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">Nouveau type de rendez-vous</h2>
            <p className="mt-0.5 text-xs text-muted">
              Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
            aria-label="Fermer"
            className="shrink-0 rounded-lg border border-line p-1.5 text-muted transition hover:text-ink disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progression : segments pleins, pas un pourcentage inventé. */}
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-violet-500" : "bg-line"
              }`}
            />
          ))}
        </div>

        {/* ── ÉTAPE 1 — Format ── */}
        {step === 0 && (
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
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {p.durationMin} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ListChecks size={11} /> {p.formFields.length} champs
                    </span>
                    {p.capacity ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-violet-500">
                        <Users size={11} /> {p.capacity} places
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> Individuel
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── ÉTAPE 2 — Planning (dépend du mode) ── */}
        {step === 1 && (
          <div className="mt-4 grid gap-3">
            {isEvent ? (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Tu fixes les dates, les participants s&apos;inscrivent. Ajoute
                  au moins une séance — sans date, ta page publique n&apos;aurait
                  rien à proposer.
                </p>

                <div className="grid gap-2">
                  {sessions.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-canvas p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                          Date
                        </label>
                        <input
                          type="date"
                          value={s.day}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)),
                            )
                          }
                          style={{ colorScheme: "dark" }}
                          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none"
                        />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                          Heure
                        </label>
                        <input
                          type="time"
                          value={s.time}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)),
                            )
                          }
                          style={{ colorScheme: "dark" }}
                          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none"
                        />
                      </div>
                      <div className="w-20">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                          Durée
                        </label>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={s.durationMin}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, durationMin: Math.max(5, Number(e.target.value) || 60) }
                                  : x,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessions((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="Retirer cette séance"
                        className="rounded-md p-1.5 text-muted transition hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
                      Aucune séance. Ajoute la première date de ton atelier.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addSession}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-violet-500/50"
                >
                  <Plus size={13} /> Ajouter une séance
                </button>
              </>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Le client choisit son créneau dans tes disponibilités. Des
                  horaires par défaut sont créés (lundi à vendredi, 9h–12h et
                  14h–17h) : tu les ajusteras dans l&apos;onglet Disponibilités.
                </p>
                <div className="w-40">
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
              </>
            )}

            {isGroup && (
              <div className="w-40">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Places par séance
                </label>
                <input
                  type="number"
                  min={2}
                  max={10000}
                  value={capacity}
                  onChange={(e) =>
                    setCapacity(Math.max(2, Math.min(10000, Number(e.target.value) || 30)))
                  }
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                />
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 3 — Nom + récapitulatif du formulaire ── */}
        {step === 2 && (
          <div className="mt-4 grid gap-3">
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

            <div className="rounded-lg border border-line bg-canvas p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Ce qui sera demandé au participant
              </p>
              <ul className="mt-2 grid gap-1">
                {preset.formFields.map((f) => (
                  <li key={f.name} className="flex items-center gap-2 text-xs text-ink">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-violet-500" />
                    {f.label || f.name}
                    {f.required && <span className="text-[10px] text-muted">obligatoire</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Modifiable après création, dans l&apos;onglet Types de RDV.
              </p>
            </div>

            {isEvent && (
              <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas p-3 text-[11px] leading-relaxed text-muted">
                <CalendarDays size={13} className="mt-0.5 shrink-0" />
                {sessions.length} séance{sessions.length > 1 ? "s" : ""} ·{" "}
                {capacity} places chacune.
              </p>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => (step === 0 ? (reset(), onClose()) : setStep((s) => s - 1))}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
          >
            {step === 0 ? "Annuler" : (<><ArrowLeft size={14} /> Retour</>)}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={busy || !canContinue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
            >
              Continuer <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={busy || !canContinue}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
              Créer le type
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
