"use client";

// components/booking/BookingWidget.tsx
//
// Interface de réservation — utilisée À LA FOIS par la page publique
// /rdv/[slug] et par la section `booking` d'un tunnel. Un seul composant, donc
// un seul comportement à maintenir et à corriger.
//
// ── PARTI PRIS SUR LES FUSEAUX ─────────────────────────────────────────────
// Le fuseau du visiteur est détecté puis AFFICHÉ ET MODIFIABLE. Le détecter en
// silence suffirait dans 95 % des cas, mais quelqu'un qui réserve depuis un
// ordinateur mal réglé, un VPN ou en déplacement n'aurait aucun moyen de s'en
// apercevoir avant de manquer le rendez-vous. Rendre le fuseau visible et
// corrigeable coûte une ligne d'interface et supprime toute une classe de
// rendez-vous manqués.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  detectVisitorTimeZone,
  formatDateInZone,
  formatTimeInZone,
  sameWallClock,
  shortZoneLabel,
} from "@/lib/booking/timezones";

type Slot = { startsAt: string; endsAt: string };
type DaySlots = { day: string; slots: Slot[] };

type EventTypeView = {
  slug: string;
  name: string;
  description?: string | null;
  durationMin: number;
  locationKind: string;
  locationValue?: string | null;
  language: string;
  timezone: string;
  timezoneLabel: string;
};

type SlotsResponse = {
  ok: boolean;
  eventType?: EventTypeView;
  days?: DaySlots[];
  daylightNotice?: string | null;
  message?: string;
};

function locationText(kind: string, value?: string | null): string {
  if (kind === "visio") return value || "Visioconférence — lien envoyé par e-mail";
  if (kind === "phone") return value ? `Appel — ${value}` : "Appel téléphonique";
  if (kind === "in_person") return value || "En personne";
  return value || "";
}

export function BookingWidget({ slug }: { slug: string }) {
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ manageUrl: string; startsAt: string } | null>(null);

  // La détection ne peut avoir lieu qu'après montage : le rendu serveur ne
  // connaît pas le fuseau du visiteur, et deviner produirait une hydratation
  // incohérente.
  useEffect(() => {
    setTimezone(detectVisitorTimeZone());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/booking/${encodeURIComponent(slug)}/slots?tz=${encodeURIComponent(timezone)}&days=14`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as SlotsResponse;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Impossible de charger les créneaux.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Connexion impossible. Réessaie.");
    } finally {
      setLoading(false);
    }
  }, [slug, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  const hostTz = data?.eventType?.timezone ?? DEFAULT_TIMEZONE;

  const daysWithSlots = useMemo(
    () => (data?.days ?? []).filter((d) => d.slots.length > 0),
    [data],
  );

  async function submit() {
    if (!selected || submitting) return;
    if (!name.trim() || !email.trim()) {
      setFormError("Renseigne ton nom et ton e-mail.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(slug)}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: selected.startsAt,
          timezone,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setFormError(json.message ?? "Réservation impossible.");
        // Un créneau pris entre-temps : on recharge la grille pour que le
        // visiteur voie immédiatement ce qui reste, plutôt que de recliquer sur
        // un créneau qui n'existe plus.
        if (res.status === 409) {
          setSelected(null);
          void load();
        }
        return;
      }
      setDone({ manageUrl: json.manageUrl, startsAt: json.startsAt });
    } catch {
      setFormError("Connexion impossible. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const d = new Date(done.startsAt);
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-bold">C&apos;est confirmé !</h2>
        <p className="mt-2 text-sm opacity-70">
          {formatDateInZone(d, timezone)} à {formatTimeInZone(d, timezone)} ({shortZoneLabel(timezone)})
        </p>
        <p className="mt-4 text-sm opacity-70">
          Un e-mail de confirmation vient de partir, avec le fichier à ajouter à ton agenda.
        </p>
        <a
          href={done.manageUrl}
          className="mt-5 inline-block text-sm font-semibold underline underline-offset-4"
        >
          Gérer ou annuler ce rendez-vous
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {data?.eventType && (
        <header className="mb-6">
          <h1 className="text-2xl font-bold">{data.eventType.name}</h1>
          <p className="mt-1 text-sm opacity-70">
            {data.eventType.durationMin} min · {locationText(data.eventType.locationKind, data.eventType.locationValue)}
          </p>
          {data.eventType.description && (
            <p className="mt-3 text-sm leading-relaxed opacity-80">{data.eventType.description}</p>
          )}
        </header>
      )}

      {/* Fuseau : visible et corrigeable, jamais imposé en silence. */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <span className="opacity-70">Heures affichées pour</span>
        <select
          value={timezone}
          onChange={(e) => {
            setSelected(null);
            setTimezone(e.target.value);
          }}
          className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-sm"
        >
          {!TIMEZONE_OPTIONS.some((t) => t.id === timezone) && (
            <option value={timezone}>{shortZoneLabel(timezone)}</option>
          )}
          {TIMEZONE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {data?.eventType && !sameWallClock(new Date(), timezone, hostTz) && (
          <span className="opacity-60">
            · l&apos;organisateur est à {shortZoneLabel(hostTz)}
          </span>
        )}
      </div>

      {loading && <p className="py-10 text-center text-sm opacity-60">Chargement des créneaux…</p>}
      {error && <p className="py-10 text-center text-sm text-red-300">{error}</p>}

      {!loading && !error && daysWithSlots.length === 0 && (
        <p className="py-10 text-center text-sm opacity-60">
          Aucune disponibilité sur les deux prochaines semaines.
        </p>
      )}

      <div className="grid gap-5">
        {daysWithSlots.map((d) => {
          const first = new Date(d.slots[0].startsAt);
          return (
            <section key={d.day}>
              <h3 className="mb-2 text-sm font-semibold capitalize opacity-80">
                {formatDateInZone(first, timezone)}
              </h3>
              <div className="flex flex-wrap gap-2">
                {d.slots.map((s) => {
                  const utc = new Date(s.startsAt);
                  const isSel = selected?.startsAt === s.startsAt;
                  const differs = !sameWallClock(utc, timezone, hostTz);
                  return (
                    <button
                      key={s.startsAt}
                      type="button"
                      onClick={() => {
                        setSelected(s);
                        setFormError(null);
                      }}
                      className={
                        "rounded-lg border px-3 py-2 text-sm transition " +
                        (isSel
                          ? "border-violet-400 bg-violet-400/20 font-semibold"
                          : "border-white/15 hover:border-white/40")
                      }
                      // Double affichage au survol : la grille reste lisible,
                      // l'information de fuseau reste accessible.
                      title={
                        differs
                          ? `${formatTimeInZone(utc, timezone)} chez toi · ${formatTimeInZone(utc, hostTz)} chez l'organisateur (${shortZoneLabel(hostTz)})`
                          : undefined
                      }
                    >
                      {formatTimeInZone(utc, timezone)}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-base font-bold">Confirmer ce créneau</h3>
          <p className="mt-1 text-sm opacity-75">
            {formatDateInZone(new Date(selected.startsAt), timezone)} ·{" "}
            {formatTimeInZone(new Date(selected.startsAt), timezone)} ({shortZoneLabel(timezone)})
          </p>
          {!sameWallClock(new Date(selected.startsAt), timezone, hostTz) && (
            <p className="mt-1 text-xs opacity-60">
              Soit {formatTimeInZone(new Date(selected.startsAt), hostTz)} chez l&apos;organisateur (
              {shortZoneLabel(hostTz)}).
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton nom *"
              maxLength={120}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ton e-mail *"
              type="email"
              maxLength={200}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone (optionnel)"
              maxLength={40}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm sm:col-span-2"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Un mot sur ton besoin (optionnel)"
              rows={3}
              maxLength={1000}
              className="resize-y rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>

          {formError && <p className="mt-3 text-xs text-red-300">{formError}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-4 w-full rounded-lg bg-violet-400 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Réservation…" : "Confirmer le rendez-vous"}
          </button>
        </div>
      )}

      {data?.daylightNotice && (
        <p className="mt-6 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
          {data.daylightNotice}
        </p>
      )}
    </div>
  );
}

export default BookingWidget;
