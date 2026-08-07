"use client";

// app/(app)/rendez-vous/page.tsx
//
// Écran « Rendez-vous » — routeur de sous-onglets.
//
// ── POURQUOI CE DÉCOUPAGE ──────────────────────────────────────────────────
// La page empilait tout verticalement : l'agenda (consulté chaque jour) et la
// configuration (réglée une fois). Il fallait défiler devant la grille horaire
// pour voir ses rendez-vous du lendemain.
//
// Les quatre sous-onglets séparent la consultation de la configuration.
// « Réservations » est l'onglet par défaut : c'est la raison quotidienne
// d'ouvrir cet écran.
//
// ── ONGLET DANS L'URL ──────────────────────────────────────────────────────
// L'onglet actif est reflété dans `?tab=`, via `history.replaceState` plutôt
// que `useSearchParams` : ce hook impose une frontière Suspense sous Next 15 et
// provoquerait un rendu supplémentaire à chaque changement d'onglet. Ici on
// veut seulement que l'URL soit partageable et survive à un rafraîchissement —
// `replaceState` suffit, sans toucher au routeur ni à l'historique.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Loader2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { HostBookingList } from "@/components/booking/HostBookingList";
import { BookingTypesTab } from "@/components/booking/BookingTypesTab";
import { BookingAvailabilityTab } from "@/components/booking/BookingAvailabilityTab";
import { BookingSettingsTab } from "@/components/booking/BookingSettingsTab";
import { detectVisitorTimeZone } from "@/lib/booking/timezones";
import { isValidHexColor } from "@/lib/booking/colors";
import type { EventType } from "@/components/booking/types";

const TABS = [
  { id: "reservations", label: "Réservations" },
  { id: "types", label: "Types de RDV" },
  { id: "disponibilites", label: "Disponibilités" },
  { id: "reglages", label: "Réglages" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

export default function RendezVousPage() {
  const [tab, setTab] = useState<TabId>("reservations");
  const [types, setTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Lecture de `?tab=` au montage seulement. La lire pendant le rendu
  // provoquerait une incohérence d'hydratation (le serveur ne connaît pas
  // l'URL du client au moment du rendu initial).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTabId(fromUrl)) setTab(fromUrl);
  }, []);

  function selectTab(next: TabId) {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* URL indisponible : l'onglet fonctionne quand même, sans partage. */
    }
  }

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
      selectTab("types");
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
          // 🆕 Une couleur en cours de frappe (« #a7 ») n'est pas envoyée :
          // le serveur la refuserait et bloquerait tout l'enregistrement.
          ...(isValidHexColor(active.color) ? { color: active.color } : {}),
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

  // Les trois onglets de configuration n'ont de sens qu'avec un type actif.
  const needsActiveType = tab !== "reservations";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-5 flex items-center justify-between gap-4">
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

        {/* Onglets — même motif que le module Emails. */}
        <div className="mb-5 inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={
                "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition " +
                (tab === t.id ? "bg-white text-zinc-950" : "opacity-60 hover:opacity-100")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sélecteur de type — affiché uniquement sur les onglets qui en
            dépendent, et seulement s'il y a plusieurs types. */}
        {needsActiveType && types.length > 1 && (
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

        {tab === "reservations" && <HostBookingList />}

        {needsActiveType && (
          <>
            {loading && <p className="py-10 text-center text-sm opacity-60">Chargement…</p>}

            {!loading && types.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
                <p className="text-sm opacity-70">
                  Aucun type de rendez-vous. Crées-en un pour obtenir ton lien de réservation.
                </p>
              </div>
            )}

            {active && (
              <>
                {tab === "types" && (
                  <BookingTypesTab
                    active={active}
                    publicUrl={publicUrl}
                    copied={copied}
                    onCopy={() => {
                      void navigator.clipboard.writeText(publicUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    onPatch={patchActive}
                  />
                )}
                {tab === "disponibilites" && (
                  <BookingAvailabilityTab active={active} onPatch={patchActive} />
                )}
                {tab === "reglages" && (
                  <BookingSettingsTab active={active} onPatch={patchActive} />
                )}

                {/* Barre d'enregistrement commune aux trois onglets de config :
                    les modifications vivent dans le même état, un seul PATCH
                    les persiste toutes. */}
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-400 px-5 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"
                  >
                    {saving && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
                    Enregistrer
                  </button>
                  {msg && <span className="text-sm opacity-70">{msg}</span>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
