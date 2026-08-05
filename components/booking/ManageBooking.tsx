"use client";

// components/booking/ManageBooking.tsx
// Consultation + annulation d'un RDV par son jeton de gestion.

import { useEffect, useState } from "react";

type BookingView = {
  eventName: string;
  status: string;
  startsAt: string;
  whenVisitor: string;
  visitorName: string;
};

export function ManageBooking({ token }: { token: string }) {
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.message ?? "Lien invalide.");
        } else {
          setBooking(json.booking);
          setCancelled(json.booking.status === "cancelled");
        }
      } catch {
        setError("Connexion impossible.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/booking/manage/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Annulation impossible.");
        return;
      }
      setCancelled(true);
      setConfirming(false);
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  const card = "w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-7 text-center";

  if (loading) return <div className={card}><p className="text-sm opacity-60">Chargement…</p></div>;
  if (error) return <div className={card}><p className="text-sm text-red-300">{error}</p></div>;
  if (!booking) return null;

  if (cancelled) {
    return (
      <div className={card}>
        <h1 className="text-lg font-bold">Rendez-vous annulé</h1>
        <p className="mt-2 text-sm opacity-70">{booking.eventName}</p>
        <p className="mt-1 text-sm opacity-50 line-through">{booking.whenVisitor}</p>
        <p className="mt-4 text-xs opacity-60">
          Le créneau est de nouveau disponible. Tu peux en réserver un autre à tout moment.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <h1 className="text-lg font-bold">{booking.eventName}</h1>
      <p className="mt-2 text-sm opacity-80">{booking.whenVisitor}</p>
      <p className="mt-1 text-xs opacity-50">Réservé par {booking.visitorName}</p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-6 w-full rounded-lg border border-red-400/30 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-400/10"
        >
          Annuler ce rendez-vous
        </button>
      ) : (
        <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/5 p-4">
          {/* Confirmation explicite : l'annulation est irréversible et libère
              le créneau pour quelqu'un d'autre. */}
          <p className="text-sm">Confirmer l&apos;annulation ? Le créneau sera libéré.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="flex-1 rounded-lg bg-red-400 px-3 py-2 text-sm font-bold text-zinc-950 disabled:opacity-50"
            >
              {busy ? "Annulation…" : "Oui, annuler"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm"
            >
              Garder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageBooking;
