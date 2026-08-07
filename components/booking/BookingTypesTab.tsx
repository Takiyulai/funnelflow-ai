"use client";

// components/booking/BookingTypesTab.tsx
// Sous-onglet « Types de RDV » : lien public, activation, couleur d'accent.

import { Check, Copy } from "lucide-react";
import {
  BOOKING_COLOR_PRESETS,
  isValidHexColor,
  readableTextOn,
  resolveBookingColor,
} from "@/lib/booking/colors";
import type { EventType } from "./types";

export function BookingTypesTab({
  active,
  publicUrl,
  copied,
  onCopy,
  onPatch,
}: {
  active: EventType;
  publicUrl: string;
  copied: boolean;
  onCopy: () => void;
  onPatch: (patch: Partial<EventType>) => void;
}) {
  const color = resolveBookingColor(active.color);

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">Lien public</h2>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-sm">
            {publicUrl}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-white/15 p-2"
            aria-label="Copier le lien"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active.active}
            onChange={(e) => onPatch({ active: e.target.checked })}
          />
          Réservations ouvertes
        </label>
      </section>

      {/* 🆕 Couleur d'accent. La colonne `color` existait en base sans jamais
          être exploitée : le calendrier public s'affichait toujours en violet,
          quel que soit l'univers visuel du tunnel qui y menait. */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
          Couleur du calendrier
        </h2>
        <p className="mt-1 text-xs opacity-60">
          Appliquée aux accents de ta page de réservation : bouton, créneau sélectionné,
          jour choisi. Aligne-la sur ton tunnel pour que le prospect ne change pas
          d&apos;univers en cliquant.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {BOOKING_COLOR_PRESETS.map((preset) => {
            const selected = color === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onPatch({ color: preset })}
                aria-label={`Couleur ${preset}`}
                aria-pressed={selected}
                className={
                  "h-8 w-8 rounded-full border-2 transition " +
                  (selected ? "border-white scale-110" : "border-white/20 hover:border-white/50")
                }
                style={{ backgroundColor: preset }}
              />
            );
          })}

          <label className="ml-2 flex items-center gap-2 text-xs opacity-70">
            Personnalisée
            <input
              type="color"
              value={color}
              onChange={(e) => onPatch({ color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
            />
          </label>

          <input
            type="text"
            value={active.color ?? ""}
            onChange={(e) => onPatch({ color: e.target.value })}
            placeholder={color}
            maxLength={7}
            className={
              "w-24 rounded-lg border bg-black/30 px-2 py-1 font-mono text-xs " +
              (active.color && !isValidHexColor(active.color)
                ? "border-red-400/60"
                : "border-white/15")
            }
          />
        </div>

        {active.color && !isValidHexColor(active.color) && (
          // Avertissement plutôt que blocage : la saisie est libre pendant la
          // frappe (« #a7 » est invalide mais en cours). Le serveur revalide,
          // et une valeur invalide retombe sur la couleur de marque.
          <p className="mt-2 text-xs text-amber-300">
            Format attendu : #a78bfa. En l&apos;état, la couleur de marque sera utilisée.
          </p>
        )}

        {/* Aperçu : ce que verra le prospect. */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <span className="text-xs opacity-50">Aperçu</span>
          <span
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: color, color: readableTextOn(color) }}
          >
            10:30
          </span>
          <span
            className="rounded-lg px-3 py-1.5 text-sm font-bold"
            style={{ backgroundColor: color, color: readableTextOn(color) }}
          >
            Confirmer le rendez-vous
          </span>
        </div>
      </section>
    </div>
  );
}

export default BookingTypesTab;
