"use client";

// components/booking/BookingAvailabilityTab.tsx
// Sous-onglet « Disponibilités » : fuseau, grille hebdo, jours fermés.

import { Trash2 } from "lucide-react";
import {
  TIMEZONE_OPTIONS,
  daylightSavingNotice,
  shortZoneLabel,
} from "@/lib/booking/timezones";
import { JOURS, fromHHMM, toHHMM, type EventType } from "./types";

export function BookingAvailabilityTab({
  active,
  onPatch,
}: {
  active: EventType;
  onPatch: (patch: Partial<EventType>) => void;
}) {
  const dstNotice = daylightSavingNotice(active.timezone);

  return (
    <div className="grid min-w-0 max-w-full gap-5">
      {/* Le fuseau EN PREMIER : les horaires saisis plus bas sont exprimés
          dans ce fuseau. L'ordre inverse ferait saisir des heures avant d'en
          connaître la référence. */}
      <section className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
          Ton fuseau horaire
        </h2>
        <p className="mt-1 text-xs opacity-60">
          Les horaires que tu définis ci-dessous sont TES heures locales. Chaque visiteur
          verra automatiquement l&apos;équivalent chez lui.
        </p>
        {/* 🆕 LISIBILITÉ DE LA LISTE DÉROULANTE.
            Les <option> d'un <select> natif sont dessinées par le SYSTÈME, pas
            par la page : aucune classe Tailwind ne les atteint. Sur un fond
            sombre, Windows rendait un menu gris pâle sur gris — d'où l'aspect
            flou et presque illisible, avec 40 fuseaux à parcourir.
            `color-scheme` est la seule propriété que le système écoute : elle
            lui fait dessiner un menu sombre natif, contrasté et net. */}
        <select
          value={active.timezone}
          onChange={(e) => onPatch({ timezone: e.target.value })}
          style={{ colorScheme: "dark" }}
          className="mt-3 w-full min-w-0 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {TIMEZONE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {dstNotice && (
          <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
            {dstNotice}
          </p>
        )}
      </section>

      <section className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
          Disponibilités hebdomadaires
          <span className="ml-2 font-normal normal-case opacity-70">
            (heure de {shortZoneLabel(active.timezone)})
          </span>
        </h2>
        <div className="mt-3 grid gap-3">
          {JOURS.map((label, weekday) => {
            const rules = active.availability.filter((r) => r.weekday === weekday);
            return (
              <div
                key={weekday}
                className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <span className="w-full text-sm opacity-70 sm:w-24">{label}</span>
                {rules.length === 0 && <span className="text-xs opacity-40">Fermé</span>}
                {rules.map((r, i) => (
                  <span
                    key={i}
                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:flex sm:w-auto"
                  >
                    <input
                      type="time"
                      value={toHHMM(r.startMin)}
                      onChange={(e) =>
                        onPatch({
                          availability: active.availability.map((x) =>
                            x === r ? { ...x, startMin: fromHHMM(e.target.value) } : x,
                          ),
                        })
                      }
                      className="w-full min-w-0 max-w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm sm:w-auto"
                    />
                    <span className="opacity-40">→</span>
                    <input
                      type="time"
                      value={toHHMM(r.endMin)}
                      onChange={(e) =>
                        onPatch({
                          availability: active.availability.map((x) =>
                            x === r ? { ...x, endMin: fromHHMM(e.target.value) } : x,
                          ),
                        })
                      }
                      className="w-full min-w-0 max-w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm sm:w-auto"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onPatch({ availability: active.availability.filter((x) => x !== r) })
                      }
                      className="col-span-3 justify-self-end p-1 opacity-50 hover:opacity-100 sm:col-auto"
                      aria-label="Supprimer la plage"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onPatch({
                      availability: [
                        ...active.availability,
                        { weekday, startMin: 9 * 60, endMin: 12 * 60 },
                      ],
                    })
                  }
                  className="self-start rounded border border-white/15 px-2 py-1 text-xs opacity-70 hover:opacity-100"
                >
                  + plage
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">Jours fermés</h2>
        <p className="mt-1 text-xs opacity-60">
          Congés, fêtes, imprévus — ces dates ne proposeront aucun créneau.
        </p>
        <div className="mt-3 flex min-w-0 max-w-full flex-wrap gap-2">
          {active.exceptions
            .filter((e) => e.kind === "closed")
            .map((e) => (
              <span
                key={e.day}
                className="flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-sm"
              >
                {e.day}
                <button
                  type="button"
                  onClick={() =>
                    onPatch({ exceptions: active.exceptions.filter((x) => x.day !== e.day) })
                  }
                  className="opacity-50 hover:opacity-100"
                  aria-label="Retirer"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          <input
            type="date"
            onChange={(e) => {
              const day = e.target.value;
              if (!day || active.exceptions.some((x) => x.day === day)) return;
              onPatch({ exceptions: [...active.exceptions, { day, kind: "closed" }] });
              e.target.value = "";
            }}
            className="min-w-0 max-w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-sm"
          />
        </div>
      </section>
    </div>
  );
}

export default BookingAvailabilityTab;
