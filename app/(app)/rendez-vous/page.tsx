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
import { isValidHexColor, resolveBookingColor } from "@/lib/booking/colors";
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

          // 🆕 Fiche hôte. Ce corps de requête est une LISTE BLANCHE explicite :
          // un champ absent d'ici n'est jamais persisté, quoi qu'affiche
          // l'interface. C'est le piège de cette fonction — il faut l'alimenter
          // à chaque nouveau champ.
          hostName: active.hostName ?? null,
          hostTitle: active.hostTitle ?? null,
          hostBio: active.hostBio ?? null,
          // Même précaution que pour la couleur : le serveur exige une URL
          // absolue http(s). Une saisie en cours (« exemple.com ») ferait
          // échouer TOUT l'enregistrement, y compris les disponibilités. On
          // envoie donc soit un effacement explicite, soit une URL valide,
          // soit rien du tout.
          ...(() => {
            const raw = (active.hostAvatarUrl ?? "").trim();
            if (raw === "") return { hostAvatarUrl: null };
            return /^https?:\/\//i.test(raw) ? { hostAvatarUrl: raw } : {};
          })(),
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
      {/* 🆕 RESPONSIVE : padding réduit sous 640 px — `px-4` fixe rognait déjà
          32 px sur un écran de 360 px de large. */}
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
        {/* 🆕 Le header était `flex items-center justify-between` sans repli :
            sur mobile, le titre et le bouton se disputaient la même ligne et le
            bouton finissait tronqué. Il passe dessous sous 640 px. */}
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
              <CalendarClock size={22} className="shrink-0" /> Rendez-vous
            </h1>
            <p className="mt-1 text-sm text-muted">
              Partage un lien, tes prospects réservent un créneau libre.
            </p>
          </div>
          <button
            type="button"
            onClick={createType}
            disabled={saving}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-50 sm:self-auto"
          >
            <Plus size={15} /> Nouveau type
          </button>
        </header>

        {/* Onglets — même motif que le module Emails.
            🆕 THÈME : les couleurs étaient codées en dur pour un fond sombre
            (`text-white`, `text-white/60`, `bg-white/5`). En mode CLAIR, les
            onglets inactifs devenaient blanc sur blanc — donc invisibles, comme
            signalé. On passe aux jetons `text-ink` / `text-muted` /
            `border-line`, qui basculent avec le thème.
            🆕 RESPONSIVE : `flex` au lieu de `inline-flex w-fit`, pour que la
            barre occupe la largeur disponible et défile proprement. */}
        <div className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-canvas p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={
                // L'onglet actif est signalé par la couleur de marque et un
                // liseré, pas par une inversion de fond : une pastille blanche
                // à texte noir attirait l'œil sur le fond plutôt que sur le
                // libellé.
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition sm:px-4 " +
                // ⚠️ Pas de variante `dark:` ici : le thème sombre est scopé par
                // la classe `.ff-theme-dark` sur le wrapper d'AppShell, et
                // `darkMode` n'est pas configuré dans tailwind.config.ts — une
                // classe `dark:*` ne s'appliquerait jamais. `text-ink` bascule
                // tout seul avec la rampe.
                (tab === t.id
                  ? "bg-violet-500/15 text-ink ring-1 ring-inset ring-violet-500/50 shadow-sm"
                  : "text-muted hover:bg-surface hover:text-ink")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sélecteur de type — affiché uniquement sur les onglets qui en
            dépendent, et seulement s'il y a plusieurs types. */}
        {needsActiveType && types.length > 1 && (
          // 🆕 Le sélecteur était une rangée de pastilles plates, toutes de même
          // poids : rien ne distinguait un type d'un autre au premier coup d'œil,
          // et la couleur choisie pour chaque type n'apparaissait nulle part côté
          // administration. On passe à des cartes : pastille de couleur (rappel
          // direct de ce que verra le prospect), nom en gras, durée en second
          // niveau, et une vraie élévation sur la carte sélectionnée.
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => {
              const selected = t.id === activeId;
              const dot = resolveBookingColor(t.color);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  aria-pressed={selected}
                  className={
                    "group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition " +
                    (selected
                      ? "border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-500/10 ring-1 ring-inset ring-violet-500/30"
                      : "border-line bg-surface hover:border-violet-500/40 hover:bg-canvas")
                  }
                >
                  <span
                    aria-hidden
                    className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dot }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {t.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {t.durationMin} min
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "reservations" && <HostBookingList />}

        {needsActiveType && (
          <>
            {loading && (
              <p className="py-10 text-center text-sm text-muted">Chargement…</p>
            )}

            {!loading && types.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center sm:p-10">
                <p className="text-sm text-muted">
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
