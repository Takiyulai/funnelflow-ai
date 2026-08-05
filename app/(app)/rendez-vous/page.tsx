"use client";

// app/(app)/rendez-vous/page.tsx
//
// Écran de configuration du calendrier de RDV, côté hôte.
//
// Trois blocs : le fuseau (en premier, parce que TOUT en dépend), la grille de
// disponibilité hebdomadaire, puis les réglages fins et les fermetures.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Copy, Check, Plus, Trash2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { HostBookingList } from "@/components/booking/HostBookingList";
import {
  TIMEZONE_OPTIONS,
  daylightSavingNotice,
  detectVisitorTimeZone,
  shortZoneLabel,
} from "@/lib/booking/timezones";

type Rule = { weekday: number; startMin: number; endMin: number };
type Exception = { day: string; kind: "closed" | "window"; startMin?: number | null; endMin?: number | null };

type EventType = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  durationMin: number;
  bufferMin: number;
  minNoticeMin: number;
  horizonDays: number;
  slotStepMin: number;
  timezone: string;
  locationKind: "visio" | "phone" | "in_person" | "custom";
  locationValue?: string | null;
  active: boolean;
  availability: Rule[];
  exceptions: Exception[];
};

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function RendezVousPage() {
  const [types, setTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/booking/event-types", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setTypes(json.eventTypes);
        setActiveId((prev) => prev ?? json.eventTypes[0]?.id ?? null);
      } else {
        setMsg(json.message ?? "Chargement impossible.");
      }
    } catch {
      setMsg("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = types.find((t) => t.id === activeId) ?? null;

  function patchActive(patch: Partial<EventType>) {
    setTypes((prev) => prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));
  }

  async function createType() {
    setSaving(true);
    try {
      const res = await fetch("/api/booking/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Appel découverte",
          durationMin: 30,
          // On propose le fuseau détecté du navigateur : dans l'immense
          // majorité des cas c'est celui de l'hôte, et un mauvais fuseau ici
          // décale TOUS ses créneaux sans qu'il s'en aperçoive.
          timezone: detectVisitorTimeZone(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMsg(json.message ?? "Création impossible.");
        return;
      }
      await load();
      setActiveId(json.id);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/booking/event-types/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: active.name,
          description: active.description,
          durationMin: active.durationMin,
          bufferMin: active.bufferMin,
          minNoticeMin: active.minNoticeMin,
          horizonDays: active.horizonDays,
          slotStepMin: active.slotStepMin,
          timezone: active.timezone,
          locationKind: active.locationKind,
          locationValue: active.locationValue,
          active: active.active,
          availability: active.availability,
          exceptions: active.exceptions,
        }),
      });
      const json = await res.json();
      setMsg(json.ok ? "Enregistré." : (json.message ?? "Enregistrement impossible."));
    } catch {
      setMsg("Connexion impossible.");
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = active
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/rdv/${active.slug}`
    : "";

  const dstNotice = active ? daylightSavingNotice(active.timezone) : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarClock size={22} /> Rendez-vous
            </h1>
            <p className="mt-1 text-sm opacity-60">
              Partage un lien, tes prospects réservent un créneau libre.
            </p>
          </div>
          <button
            type="button"
            onClick={createType}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-400 px-3 py-2 text-sm font-bold text-zinc-950 disabled:opacity-50"
          >
            <Plus size={15} /> Nouveau type
          </button>
        </header>

        {/* L'agenda d'abord : c'est ce que l'hôte vient consulter au quotidien.
            La configuration ne se règle qu'une fois. */}
        <div className="mb-6">
          <HostBookingList />
        </div>

        {loading && <p className="py-10 text-center text-sm opacity-60">Chargement…</p>}

        {!loading && types.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
            <p className="text-sm opacity-70">
              Aucun type de rendez-vous. Crées-en un pour obtenir ton lien de réservation.
            </p>
          </div>
        )}

        {types.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={
                  "rounded-lg border px-3 py-1.5 text-sm " +
                  (t.id === activeId ? "border-violet-400 bg-violet-400/15" : "border-white/15")
                }
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {active && (
          <div className="grid gap-5">
            {/* Lien public */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">Lien public</h2>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-sm">
                  {publicUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(publicUrl);
                    setCopied(active.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="rounded-lg border border-white/15 p-2"
                  aria-label="Copier le lien"
                >
                  {copied === active.id ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active.active}
                  onChange={(e) => patchActive({ active: e.target.checked })}
                />
                Réservations ouvertes
              </label>
            </section>

            {/* Fuseau — en premier, car tout en dépend */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
                Ton fuseau horaire
              </h2>
              <p className="mt-1 text-xs opacity-60">
                Les horaires que tu définis ci-dessous sont TES heures locales. Chaque visiteur
                verra automatiquement l&apos;équivalent chez lui.
              </p>
              <select
                value={active.timezone}
                onChange={(e) => patchActive({ timezone: e.target.value })}
                className="mt-3 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
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

            {/* Disponibilités */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
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
                    <div key={weekday} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 text-sm opacity-70">{label}</span>
                      {rules.length === 0 && (
                        <span className="text-xs opacity-40">Fermé</span>
                      )}
                      {rules.map((r, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <input
                            type="time"
                            value={toHHMM(r.startMin)}
                            onChange={(e) =>
                              patchActive({
                                availability: active.availability.map((x) =>
                                  x === r ? { ...x, startMin: fromHHMM(e.target.value) } : x,
                                ),
                              })
                            }
                            className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm"
                          />
                          <span className="opacity-40">→</span>
                          <input
                            type="time"
                            value={toHHMM(r.endMin)}
                            onChange={(e) =>
                              patchActive({
                                availability: active.availability.map((x) =>
                                  x === r ? { ...x, endMin: fromHHMM(e.target.value) } : x,
                                ),
                              })
                            }
                            className="rounded border border-white/15 bg-black/30 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patchActive({
                                availability: active.availability.filter((x) => x !== r),
                              })
                            }
                            className="p-1 opacity-50 hover:opacity-100"
                            aria-label="Supprimer la plage"
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          patchActive({
                            availability: [
                              ...active.availability,
                              { weekday, startMin: 9 * 60, endMin: 12 * 60 },
                            ],
                          })
                        }
                        className="rounded border border-white/15 px-2 py-1 text-xs opacity-70 hover:opacity-100"
                      >
                        + plage
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Réglages fins */}
            <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Nom du rendez-vous
                <input
                  value={active.name}
                  onChange={(e) => patchActive({ name: e.target.value })}
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
                  onChange={(e) => patchActive({ durationMin: Number(e.target.value) })}
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
                  onChange={(e) => patchActive({ bufferMin: Number(e.target.value) })}
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
                  onChange={(e) => patchActive({ minNoticeMin: Number(e.target.value) * 60 })}
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
                  onChange={(e) => patchActive({ horizonDays: Number(e.target.value) })}
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
                  onChange={(e) => patchActive({ slotStepMin: Number(e.target.value) })}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Lieu / lien de visio
                <input
                  value={active.locationValue ?? ""}
                  onChange={(e) => patchActive({ locationValue: e.target.value })}
                  placeholder="https://meet.google.com/… ou une adresse"
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2"
                />
              </label>
            </section>

            {/* Fermetures */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
                Jours fermés
              </h2>
              <p className="mt-1 text-xs opacity-60">
                Congés, fêtes, imprévus — ces dates ne proposeront aucun créneau.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
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
                          patchActive({
                            exceptions: active.exceptions.filter((x) => x.day !== e.day),
                          })
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
                    patchActive({
                      exceptions: [...active.exceptions, { day, kind: "closed" }],
                    });
                    e.target.value = "";
                  }}
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-sm"
                />
              </div>
            </section>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-400 px-5 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                Enregistrer
              </button>
              {msg && <span className="text-sm opacity-70">{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
