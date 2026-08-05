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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">Mes rendez-vous</h2>
        <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 text-xs">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={"rounded-md px-2.5 py-1 " + (scope === s ? "bg-white/15 font-semibold" : "opacity-60")}
            >
              {s === "upcoming" ? "À venir" : "Passés"}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-6 text-center text-sm opacity-50">Chargement…</p>}

      {!loading && rows.length === 0 && (
        <p className="py-6 text-center text-sm opacity-50">
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
                "rounded-xl border border-white/10 bg-black/20 p-3 text-sm " +
                (isCancelled ? "opacity-45" : "")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={"font-semibold " + (isCancelled ? "line-through" : "")}>
                    {b.whenHost}
                  </p>
                  <p className="mt-0.5 opacity-70">
                    {b.eventName} · {b.visitorName}{" "}
                    <a href={`mailto:${b.visitorEmail}`} className="underline underline-offset-2">
                      {b.visitorEmail}
                    </a>
                    {b.visitorPhone ? ` · ${b.visitorPhone}` : ""}
                  </p>
                  {/* Rappel de l'heure vue par le participant : c'est ce qu'il
                      a noté dans son agenda, et donc ce dont il parlera. */}
                  {b.visitorTimeLabel && !isCancelled && (
                    <p className="mt-0.5 text-xs opacity-50">{b.visitorTimeLabel}</p>
                  )}
                  {b.note && <p className="mt-1 text-xs opacity-60">« {b.note} »</p>}
                </div>

                {!isCancelled && scope === "upcoming" && (
                  confirmId === b.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cancel(b.manageToken)}
                        disabled={cancelling === b.manageToken}
                        className="rounded-lg bg-red-400 px-2.5 py-1 text-xs font-bold text-zinc-950 disabled:opacity-50"
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
