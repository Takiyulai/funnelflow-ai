"use client";

// components/editor/tabs/BookingContentTab.tsx
//
// Onglet Contenu d'une section « Prise de rendez-vous ».
//
// Sans ce panneau, la section existait mais restait inerte : le renderer
// affichait « aucun type de rendez-vous rattaché » et rien dans l'éditeur ne
// permettait d'en rattacher un.

import { useEffect, useState } from "react";
import { CalendarClock, ExternalLink } from "lucide-react";
import type { FunnelSection } from "@/lib/funnels/types";

type EventTypeOption = {
  id: string;
  slug: string;
  name: string;
  durationMin: number;
  active: boolean;
};

export function BookingContentTab({
  section,
  onChange,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  const [options, setOptions] = useState<EventTypeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/booking/event-types", { cache: "no-store" });
        const json = await res.json();
        if (json.ok) setOptions(json.eventTypes);
      } catch {
        /* la liste reste vide : le message d'invite ci-dessous prend le relais */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = options.find((o) => o.slug === section.bookingSlug);

  return (
    <div className="space-y-4">
      <label className="grid gap-1 text-xs font-medium text-white/70">
        Titre affiché au-dessus du calendrier
        <input
          value={section.headline ?? ""}
          onChange={(e) => onChange({ headline: e.target.value })}
          placeholder="Réservez votre rendez-vous"
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"
        />
      </label>

      <div className="grid gap-1 text-xs font-medium text-white/70">
        Type de rendez-vous
        {loading ? (
          <p className="py-2 text-xs text-white/40">Chargement…</p>
        ) : options.length === 0 ? (
          // Cas fréquent au premier usage : l'utilisateur ajoute la section
          // avant d'avoir créé le moindre type de RDV. On l'envoie au bon
          // endroit plutôt que de lui montrer une liste vide sans explication.
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
            Tu n&apos;as pas encore de type de rendez-vous.
            <a
              href="/rendez-vous"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              En créer un <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <select
            value={section.bookingSlug ?? ""}
            onChange={(e) => onChange({ bookingSlug: e.target.value || undefined })}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"
          >
            <option value="">— Choisir —</option>
            {options.map((o) => (
              <option key={o.id} value={o.slug}>
                {o.name} ({o.durationMin} min){o.active ? "" : " — désactivé"}
              </option>
            ))}
          </select>
        )}
      </div>

      {selected && !selected.active && (
        // Une section pointant vers un type désactivé n'affiche aucun créneau.
        // Le signaler ici évite de croire à une panne du calendrier.
        <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
          Ce type de rendez-vous est actuellement désactivé : la section
          n&apos;affichera aucun créneau tant que tu ne l&apos;auras pas rouvert.
        </p>
      )}

      {selected && (
        <p className="flex items-center gap-1.5 text-xs text-white/50">
          <CalendarClock size={13} />
          Page publique : <code className="text-white/70">/rdv/{selected.slug}</code>
        </p>
      )}
    </div>
  );
}

export default BookingContentTab;
