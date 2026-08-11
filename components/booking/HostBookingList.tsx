"use client";

// components/booking/HostBookingList.tsx
// Agenda de l'hôte : rendez-vous à venir / passés, avec annulation.

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

type HostBooking = {
  id: string;
  eventName: string;
  status: string;
  startsAt: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string | null;
  note?: string | null;
  manageToken: string;
  whenHost: string;
  visitorTimeLabel: string | null;
};

export function HostBookingList() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<HostBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/booking/bookings?scope=${scope}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setRows(json.bookings);
    } catch {
      /* silencieux : l'écran affiche simplement une liste vide */
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(token: string) {
    setCancelling(token);
    try {
      await fetch("/api/booking/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manageToken: token }),
      });
      setConfirmId(null);
      await load();
    } finally {
      setCancelling(null);
    }
  }

  return (
    // 🆕 THÈME : `bg-white/5` + `border-white/10` supposaient un fond sombre.
    // En mode clair, la carte devenait blanche sur blanc et le bloc de
    // réservation (`bg-black/20`, plus bas) virait au gris illisible.
    // Les jetons `bg-surface` / `border-line` / `text-ink` basculent seuls.
    // 🆕 RESPONSIVE : padding réduit sous 640 px.
    <section className="rounded-2xl border border-line bg-surface p-3 sm:p-5">
      {/* L'en-tête se replie sous 640 px : titre et sélecteur ne tiennent pas
          sur une seule ligne en 360 px de large. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Mes rendez-vous
        </h2>
        <div className="flex shrink-0 gap-1 self-start rounded-lg border border-line p-0.5 text-xs sm:self-auto">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={
                "rounded-md px-2.5 py-1 transition " +
                (scope === s
                  ? "bg-canvas font-semibold text-ink"
                  : "text-muted hover:text-ink")
              }
            >
              {s === "upcoming" ? "À venir" : "Passés"}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-6 text-center text-sm text-muted">Chargement…</p>}

      {!loading && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">
          {scope === "upcoming" ? "Aucun rendez-vous à venir." : "Aucun rendez-vous passé."}
        </p>
      )}

      <ul className="mt-3 grid gap-2">
        {rows.map((b) => {
          const isCancelled = b.status === "cancelled";
          return (
            <li
              key={b.id}
              className={
                // `bg-black/20` donnait un bloc gris illisible en mode clair.
                "rounded-xl border border-line bg-canvas p-3 text-sm text-ink " +
                (isCancelled ? "opacity-50" : "")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={"font-semibold " + (isCancelled ? "line-through" : "")}>
                    {b.whenHost}
                  </p>
                  <p className="mt-0.5 break-words text-muted">
                    {b.eventName} · {b.visitorName}{" "}
                    <a
                      href={`mailto:${b.visitorEmail}`}
                      className="break-all underline underline-offset-2"
                    >
                      {b.visitorEmail}
                    </a>
                    {b.visitorPhone ? ` · ${b.visitorPhone}` : ""}
                  </p>
                  {/* Rappel de l'heure vue par le participant : c'est ce qu'il
                      a noté dans son agenda, et donc ce dont il parlera. */}
                  {b.visitorTimeLabel && !isCancelled && (
                    <p className="mt-0.5 text-xs text-muted">{b.visitorTimeLabel}</p>
                  )}
                  {b.note && (
                    <p className="mt-1 break-words text-xs text-muted">« {b.note} »</p>
                  )}
                </div>

                {!isCancelled && scope === "upcoming" && (
                  confirmId === b.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cancel(b.manageToken)}
                        disabled={cancelling === b.manageToken}
                        className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                      >
                        {cancelling === b.manageToken ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          "Confirmer"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-xs"
                      >
                        Non
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(b.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs opacity-70 hover:opacity-100"
                    >
                      <X size={12} /> Annuler
                    </button>
                  )
                )}
                {isCancelled && <span className="text-xs opacity-60">Annulé</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default HostBookingList;
