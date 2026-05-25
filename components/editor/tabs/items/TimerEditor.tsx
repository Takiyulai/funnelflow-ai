"use client";

import { Plus, Trash2, Timer as TimerIcon } from "lucide-react";
import type {
  FunnelSection,
  SectionItem,
  TimerItem,
  TimerMode,
  TimerStyle,
  TimerSize,
  TimerExpireBehavior,
} from "@/lib/funnels/types";
import { makeDefaultTimer } from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

export function TimerEditor({ section, onChange }: Props) {
  const timers = (section.items || []).filter(
    (it): it is SectionItem & { kind: "timer" } => it.kind === "timer",
  );
  const others = (section.items || []).filter((it) => it.kind !== "timer");

  const addTimer = () => {
    const timer = makeDefaultTimer();
    onChange({ items: [...(section.items || []), { kind: "timer", data: timer }] });
  };

  const updateTimer = (idx: number, patch: Partial<TimerItem>) => {
    const newTimers = [...timers];
    newTimers[idx] = { kind: "timer", data: { ...timers[idx].data, ...patch } };
    onChange({ items: [...others, ...newTimers] });
  };

  const removeTimer = (idx: number) => {
    const newTimers = timers.filter((_, i) => i !== idx);
    onChange({ items: [...others, ...newTimers] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimerIcon className="h-4 w-4 text-amber-300" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
            Timer d'urgence
          </h3>
        </div>
        <button
          type="button"
          onClick={addTimer}
          className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30"
        >
          <Plus className="h-3 w-3" />
          Ajouter
        </button>
      </div>

      {timers.length === 0 && (
        <div className="rounded-md border border-dashed border-white/15 bg-white/[0.02] px-3 py-4 text-center text-[11px] italic text-white/40">
          Aucun timer. Cliquez sur « Ajouter » pour insérer un compte à rebours.
        </div>
      )}

      {timers.map((t, idx) => (
        <TimerCard
          key={t.data.id}
          timer={t.data}
          onChange={(patch) => updateTimer(idx, patch)}
          onRemove={() => removeTimer(idx)}
        />
      ))}
    </div>
  );
}

function TimerCard({
  timer,
  onChange,
  onRemove,
}: {
  timer: TimerItem;
  onChange: (patch: Partial<TimerItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-white/70">Configuration</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-400/60 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mode */}
      <Field label="Mode">
        <div className="flex flex-wrap gap-1.5">
          <ModeBtn active={timer.mode === "countdown-duration"} onClick={() => onChange({ mode: "countdown-duration" })}>
            Durée fixe
          </ModeBtn>
          <ModeBtn active={timer.mode === "countdown-date"} onClick={() => onChange({ mode: "countdown-date" })}>
            Date précise
          </ModeBtn>
          <ModeBtn active={timer.mode === "seats-counter"} onClick={() => onChange({ mode: "seats-counter" })}>
            Places restantes
          </ModeBtn>
        </div>
      </Field>

      {/* Champs spécifiques au mode */}
      {timer.mode === "countdown-duration" && (
        <Field label="Durée (heures)">
          <input
            type="number"
            min={1}
            max={720}
            value={timer.durationHours ?? 24}
            onChange={(e) => onChange({ durationHours: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="mt-1 text-[10px] text-white/40">
            Chaque visiteur démarre son propre compte à rebours dès son arrivée.
          </p>
        </Field>
      )}

      {timer.mode === "countdown-date" && (
        <Field label="Date et heure cible">
          <input
            type="datetime-local"
            value={timer.targetDate ? toLocalInput(timer.targetDate) : ""}
            onChange={(e) => onChange({ targetDate: fromLocalInput(e.target.value) })}
            className={inputClass}
          />
        </Field>
      )}

      {timer.mode === "seats-counter" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Total places">
            <input
              type="number"
              min={1}
              value={timer.seatsTotal ?? 100}
              onChange={(e) => onChange({ seatsTotal: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Restantes">
            <input
              type="number"
              min={0}
              value={timer.seatsRemaining ?? 0}
              onChange={(e) => onChange({ seatsRemaining: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {/* Label */}
      <Field label="Texte au-dessus">
        <input
          type="text"
          value={timer.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Offre expire dans"
          className={inputClass}
        />
      </Field>

      {/* Style (sauf seats) */}
      {timer.mode !== "seats-counter" && (
        <Field label="Style d'affichage">
          <div className="flex flex-wrap gap-1.5">
            <ModeBtn active={(timer.style ?? "cards") === "cards"} onClick={() => onChange({ style: "cards" })}>
              Cartes
            </ModeBtn>
            <ModeBtn active={timer.style === "digital"} onClick={() => onChange({ style: "digital" })}>
              Digital
            </ModeBtn>
            <ModeBtn active={timer.style === "inline"} onClick={() => onChange({ style: "inline" })}>
              Inline
            </ModeBtn>
          </div>
        </Field>
      )}

      {/* Taille */}
      <Field label="Taille">
        <div className="flex flex-wrap gap-1.5">
          {(["sm", "md", "lg", "xl"] as TimerSize[]).map((s) => (
            <ModeBtn key={s} active={(timer.size ?? "md") === s} onClick={() => onChange({ size: s })}>
              {s.toUpperCase()}
            </ModeBtn>
          ))}
        </div>
      </Field>

      {/* Couleur */}
      <Field label="Couleur des chiffres">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={timer.color ?? "#2563eb"}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
          />
          <input
            type="text"
            value={timer.color ?? ""}
            onChange={(e) => onChange({ color: e.target.value })}
            placeholder="#2563eb (vide = accent du thème)"
            className={inputClass}
          />
          {timer.color && (
            <button
              type="button"
              onClick={() => onChange({ color: undefined })}
              className="text-[11px] text-white/50 hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </Field>

      {/* Fond optionnel */}
      <Field label="Fond du timer (optionnel)">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={timer.backgroundColor ?? "#000000"}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
          />
          <input
            type="text"
            value={timer.backgroundColor ?? ""}
            onChange={(e) => onChange({ backgroundColor: e.target.value || undefined })}
            placeholder="Aucun fond"
            className={inputClass}
          />
          {timer.backgroundColor && (
            <button
              type="button"
              onClick={() => onChange({ backgroundColor: undefined })}
              className="text-[11px] text-white/50 hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </Field>

      {/* Options countdown */}
      {timer.mode !== "seats-counter" && (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={timer.showDays ?? false}
              onChange={(e) => onChange({ showDays: e.target.checked })}
              className="h-3.5 w-3.5 accent-amber-300"
            />
            Afficher les jours
          </label>

          <Field label="À expiration">
            <select
              value={timer.onExpire ?? "keep-zero"}
              onChange={(e) => onChange({ onExpire: e.target.value as TimerExpireBehavior })}
              className={inputClass}
            >
              <option value="keep-zero">Garder à 00:00:00</option>
              <option value="show-message">Afficher un message</option>
              <option value="hide">Masquer le timer</option>
            </select>
          </Field>

          {timer.onExpire === "show-message" && (
            <Field label="Message d'expiration">
              <input
                type="text"
                value={timer.expiredMessage ?? ""}
                onChange={(e) => onChange({ expiredMessage: e.target.value })}
                placeholder="Offre terminée"
                className={inputClass}
              />
            </Field>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Helpers UI ─── */

const inputClass =
  "w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-white/70">{label}</label>
      {children}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* Convert ISO ↔ datetime-local input */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}
