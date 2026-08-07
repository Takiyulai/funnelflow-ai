"use client";

// components/booking/BookingSettingsTab.tsx
// Sous-onglet « Réglages » : nom, durée, battement, délai, horizon, pas, lieu.

import type { EventType } from "./types";

export function BookingSettingsTab({
  active,
  onPatch,
}: {
  active: EventType;
  onPatch: (patch: Partial<EventType>) => void;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        Nom du rendez-vous
        <input
          value={active.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Durée (min)
        <input
          type="number"
          min={5}
          max={480}
          value={active.durationMin}
          onChange={(e) => onPatch({ durationMin: Number(e.target.value) })}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Battement après (min)
        <input
          type="number"
          min={0}
          max={240}
          value={active.bufferMin}
          onChange={(e) => onPatch({ bufferMin: Number(e.target.value) })}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Délai minimum avant réservation (h)
        <input
          type="number"
          min={0}
          max={720}
          value={Math.round(active.minNoticeMin / 60)}
          onChange={(e) => onPatch({ minNoticeMin: Number(e.target.value) * 60 })}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Réservable jusqu&apos;à (jours)
        <input
          type="number"
          min={1}
          max={365}
          value={active.horizonDays}
          onChange={(e) => onPatch({ horizonDays: Number(e.target.value) })}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Pas de la grille (min)
        <input
          type="number"
          min={5}
          max={120}
          value={active.slotStepMin}
          onChange={(e) => onPatch({ slotStepMin: Number(e.target.value) })}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        Lieu / lien de visio
        <input
          value={active.locationValue ?? ""}
          onChange={(e) => onPatch({ locationValue: e.target.value })}
          placeholder="https://meet.google.com/… ou une adresse"
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
        />
        {/* Rappel : ce champ n'est JAMAIS affiché sur la page publique — un lien
            de visio public laisserait n'importe qui rejoindre la réunion. Il part
            dans l'e-mail de confirmation et le .ics. */}
        <span className="text-xs opacity-50">
          Envoyé uniquement dans l&apos;e-mail de confirmation, jamais affiché publiquement.
        </span>
      </label>
    </section>
  );
}

export default BookingSettingsTab;
