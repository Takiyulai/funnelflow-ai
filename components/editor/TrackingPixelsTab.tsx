"use client";

// components/editor/TrackingPixelsTab.tsx
// 🆕 VAGUE 1 / LOT 4 — Panneau « Pixels publicitaires » : l'utilisateur colle
// ses identifiants (Meta, GA4, GTM, TikTok), sans toucher au code. Les scripts
// sont injectés automatiquement sur les pages PUBLIÉES uniquement.

import type { Funnel } from "@/lib/funnels/types";

interface Props {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
  onClose: () => void;
}

type Tracking = NonNullable<Funnel["tracking"]>;

const FIELDS: Array<{
  key: keyof Tracking;
  label: string;
  placeholder: string;
  help: string;
}> = [
  {
    key: "metaPixelId",
    label: "Meta Pixel ID (Facebook / Instagram)",
    placeholder: "1234567890123456",
    help: "Meta Events Manager → Sources de données → votre pixel → l'identifiant numérique affiché sous le nom.",
  },
  {
    key: "ga4Id",
    label: "Google Analytics 4 (ID de mesure)",
    placeholder: "G-XXXXXXXXXX",
    help: "Google Analytics → Administration → Flux de données → votre flux web → « ID de mesure » (commence par G-).",
  },
  {
    key: "gtmId",
    label: "Google Tag Manager (ID de conteneur)",
    placeholder: "GTM-XXXXXXX",
    help: "Google Tag Manager → votre conteneur → l'identifiant en haut à droite (commence par GTM-).",
  },
  {
    key: "tiktokPixelId",
    label: "TikTok Pixel ID",
    placeholder: "C9XXXXXXXXXXXXXXXX",
    help: "TikTok Ads Manager → Outils → Événements → Pixel → « Pixel ID ».",
  },
];

export default function TrackingPixelsTab({ funnel, onChange, onClose }: Props) {
  const current: Tracking = { ...(funnel.tracking ?? {}) };

  const update = (key: keyof Tracking, value: string) => {
    onChange({ tracking: { ...current, [key]: value } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Pixels publicitaires
            </h2>
            <p className="text-xs text-gray-500">
              Mesurez vos campagnes Meta, Google et TikTok. Les pixels ne se
              chargent que sur votre tunnel publié — jamais dans l&apos;éditeur.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Fermer
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Collez uniquement l&apos;<strong>identifiant</strong> (pas le code
            complet). Un identifiant au format invalide est ignoré sans casser
            la page. Laissez vide pour désactiver.
          </div>

          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-semibold uppercase text-gray-500">
                {f.label}
              </span>
              <input
                value={current[f.key] ?? ""}
                onChange={(e) => update(f.key, e.target.value.trim())}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="mt-1 block text-xs text-gray-500">{f.help}</span>
            </label>
          ))}

          <p className="text-xs text-gray-400">
            Rappel RGPD : si votre audience est en Europe, l&apos;usage de ces
            pixels peut nécessiter un bandeau de consentement selon votre
            situation. Vous restez responsable de la conformité de vos pages.
          </p>
        </div>

        <footer className="flex justify-end border-t px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Terminé
          </button>
        </footer>
      </div>
    </div>
  );
}
